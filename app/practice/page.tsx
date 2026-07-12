'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import type { Theory, Question } from '@/lib/types';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { xpToLevel } from '@/lib/utils';
import { getTargetDifficulty, sortByAdaptiveDifficulty } from '@/lib/adaptive';
import { sm2, gradeFromAttempt, DEFAULT_SM2_STATE } from '@/lib/sm2';
import {
  ArrowLeft, Zap, Award, AlertCircle, Lightbulb, ChevronRight, RefreshCw, Clock,
} from 'lucide-react';
import { playSound } from '@/lib/audio';

// Practice Session Content

function PracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theoryId = searchParams.get('theoryId');
  const journeyId = searchParams.get('journeyId');
  const daily = searchParams.get('daily') === 'true';
  const { profile, loading: authLoading } = useProfile();

  // Core data
  const [theory, setTheory] = useState<Theory | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);

  // Session state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<{ qId: string; isCorrect: boolean; responseMs: number }[]>([]);
  const [recommendation, setRecommendation] = useState<{ title: string; accuracy: number } | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);

  // Exit confirm dialog
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Timer
  const questionStartTime = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Timer Effect
  useEffect(() => {
    if (loading || sessionFinished || isSubmitted) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIdx, isSubmitted, sessionFinished, loading]);

  // Initial data load — inline IIFE to satisfy set-state-in-effect lint rule.
  useEffect(() => {
    (async () => {
      if (!theoryId && !journeyId && !daily) {
        setErrorMsg('No theory ID, journey ID, or daily flag was provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg('');
      try {
        if (journeyId) {
          // Load journey
          const { data: jData, error: jErr } = await supabase
            .from('journeys')
            .select('*')
            .eq('id', journeyId)
            .single();

          if (jErr) throw jErr;
          if (!jData) throw new Error('Journey not found.');

          setTheory({ title: jData.title } as Theory);

          // Load questions via journey_questions junction
          const { data: jqData, error: jqErr } = await supabase
            .from('journey_questions')
            .select('sort_order, question_id, questions:questions(*)')
            .eq('journey_id', journeyId)
            .order('sort_order', { ascending: true });

          if (jqErr) throw jqErr;

          const qList = (jqData ?? [])
            .map((row) => (row as unknown as { questions: Question | null }).questions)
            .filter((q): q is Question => q !== null);

          if (qList.length === 0) {
            setErrorMsg('No approved questions were found for this journey.');
          } else {
            setQuestions(qList);
            questionStartTime.current = Date.now();
          }
        } else if (daily) {
          setTheory({ title: 'Daily Practice Deck' } as Theory);

          // Load published theories
          const { data: theoryList, error: tErr } = await supabase
            .from('theories')
            .select('id')
            .eq('status', 'published');

          if (tErr) throw tErr;
          if (!theoryList || theoryList.length === 0) {
            throw new Error('No published theories found.');
          }

          // Load approved questions from those theories
          const { data: qData, error: qErr } = await supabase
            .from('questions')
            .select('*')
            .in('theory_id', theoryList.map((t) => t.id))
            .eq('status', 'approved');

          if (qErr) throw qErr;

          if (!qData || qData.length === 0) {
            setErrorMsg('No approved questions were found.');
          } else {
            // Shuffle and select 10 questions
            const shuffled = [...qData].sort(() => 0.5 - Math.random());
            setQuestions(shuffled.slice(0, 10) as Question[]);
            questionStartTime.current = Date.now();
          }
        } else {
          // Load theory
          const { data: tData, error: tErr } = await supabase
            .from('theories')
            .select('*')
            .eq('id', theoryId)
            .single();

          if (tErr) throw tErr;
          setTheory(tData as Theory);

          const { data: qData, error: qErr } = await supabase
            .from('questions')
            .select('*')
            .eq('theory_id', theoryId)
            .eq('status', 'approved');

          if (qErr) throw qErr;

          if (!qData || qData.length === 0) {
            setErrorMsg('No approved questions were found for this theory.');
          } else {
            // Apply adaptive difficulty ordering
            let ordered = qData as Question[];
            try {
              const { data: recentAttempts } = await supabase
                .from('attempts')
                .select('is_correct')
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
                .in('question_id', qData.map(q => q.id))
                .order('created_at', { ascending: false })
                .limit(20);

              if (recentAttempts && recentAttempts.length > 0) {
                const target = getTargetDifficulty(recentAttempts);
                ordered = sortByAdaptiveDifficulty(ordered, target);
              } else {
                // New learner — shuffle and start easy
                ordered = sortByAdaptiveDifficulty(ordered, 1);
              }
            } catch {
              // Fallback: use DB order if adaptive query fails
            }

            setQuestions(ordered);
            questionStartTime.current = Date.now();
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Foundations] Error loading practice session:', message);
        setErrorMsg(message || 'Failed to load practice questions.');
      } finally {
        setLoading(false);
      }
    })();
  }, [theoryId, journeyId, daily]);

  // Submit answer — declared before keyboard effect that references it.
  const handleSubmitAnswer = useCallback(async () => {
    if (selectedIdx === null || isSubmitted || !theory) return;

    const currentQuestion = questions[currentIdx];
    const isCorrect = selectedIdx === currentQuestion.correct_index;
    const responseMs = Date.now() - questionStartTime.current;

    setIsSubmitted(true);

    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }

    try {
      if (profile) {
        await supabase.from('attempts').insert({
          user_id: profile.id,
          question_id: currentQuestion.id,
          chosen_index: selectedIdx,
          is_correct: isCorrect,
          response_ms: responseMs,
        });

        // Update user progress atomically via database RPC
        const xpEarned = isCorrect ? 10 : 2;

        const { data: progressData } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        const currentXp = progressData?.xp ?? 0;
        const currentLevel = progressData?.level ?? 1;
        const newXp = currentXp + xpEarned;
        const newLevel = xpToLevel(newXp).level;

        if (newLevel > currentLevel) {
          setLeveledUpTo(newLevel);
          playSound('level-up');
        }

        await supabase.rpc('increment_xp', {
          p_user_id: profile.id,
          p_xp_earned: xpEarned,
          p_last_active_at: new Date().toISOString(),
        });

        // SM-2 spaced repetition: schedule this question for future review
        try {
          const { data: existingSchedule } = await supabase
            .from('review_schedule')
            .select('ease_factor, interval_days, repetitions')
            .eq('user_id', profile.id)
            .eq('question_id', currentQuestion.id)
            .maybeSingle();

          const currentState = existingSchedule
            ? {
                easeFactor: existingSchedule.ease_factor,
                intervalDays: existingSchedule.interval_days,
                repetitions: existingSchedule.repetitions,
              }
            : DEFAULT_SM2_STATE;

          const quality = gradeFromAttempt(isCorrect, responseMs);
          const result = sm2(currentState, quality);

          await supabase
            .from('review_schedule')
            .upsert({
              user_id: profile.id,
              question_id: currentQuestion.id,
              ease_factor: result.easeFactor,
              interval_days: result.intervalDays,
              repetitions: result.repetitions,
              due_at: result.dueAt.toISOString(),
            }, { onConflict: 'user_id,question_id' });
        } catch (scheduleErr) {
          console.error('[Foundations] SM-2 schedule update failed:', scheduleErr);
        }
      }

      setSessionAttempts((prev) => [...prev, { qId: currentQuestion.id, isCorrect, responseMs }]);
    } catch (err: unknown) {
      console.error('[Foundations] Failed to log attempt:', err);
    }
  }, [selectedIdx, isSubmitted, theory, questions, currentIdx, profile]);

  // Keyboard navigation for MCQ options
  useEffect(() => {
    if (isSubmitted || sessionFinished || loading) return;

    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const idx = key.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      if (idx >= 0 && idx < (questions[currentIdx]?.options.length ?? 0)) {
        setSelectedIdx(idx);
      }
      if (e.key === 'Enter' && selectedIdx !== null && !isSubmitted) {
        handleSubmitAnswer();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [currentIdx, isSubmitted, sessionFinished, loading, selectedIdx, questions, handleSubmitAnswer]);

  // Load review recommendation when session completes
  useEffect(() => {
    if (!sessionFinished || !profile) return;

    const loadRecommendation = async () => {
      const { data } = await supabase
        .from('attempts')
        .select(`
          is_correct,
          questions (
            theories (
              id,
              title
            )
          )
        `)
        .eq('user_id', profile.id);

      if (data) {
        const theoryStats: Record<string, { title: string; total: number; correct: number }> = {};
        for (const rawAtt of data as unknown[]) {
          const att = rawAtt as {
            is_correct: boolean;
            questions: {
              theories: {
                id: string;
                title: string;
              } | null;
            } | null;
          };
          const theory = att.questions?.theories;
          if (theory && theory.id && theory.title) {
            if (!theoryStats[theory.id]) {
              theoryStats[theory.id] = { title: theory.title, total: 0, correct: 0 };
            }
            theoryStats[theory.id].total += 1;
            if (att.is_correct) {
              theoryStats[theory.id].correct += 1;
            }
          }
        }

        const statsArray = Object.values(theoryStats)
          .map(s => ({ title: s.title, accuracy: Math.round((s.correct / s.total) * 100) }))
          .sort((a, b) => a.accuracy - b.accuracy);

        if (statsArray.length > 0 && statsArray[0].accuracy < 85) {
          setRecommendation(statsArray[0]);
        }
      }
    };

    loadRecommendation();
  }, [sessionFinished, profile]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  const handleNext = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedIdx(null);
      setIsSubmitted(false);
      setElapsedSeconds(0);
      questionStartTime.current = Date.now();
    } else {
      setSessionFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedIdx(null);
    setIsSubmitted(false);
    setSessionAttempts([]);
    setSessionFinished(false);
    setElapsedSeconds(0);
    questionStartTime.current = Date.now();
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading practice session…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (errorMsg || !theory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto animate-fade-in">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-xl font-bold font-display">Practice Error</h3>
        <p className="text-muted-foreground mt-2">{errorMsg || 'Could not launch practice session.'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Session Finished Screen ──
  if (sessionFinished) {
    const totalQ = questions.length;
    const correctCount = sessionAttempts.filter((a) => a.isCorrect).length;
    const finalAccuracy = Math.round((correctCount / totalQ) * 100);
    const totalXpEarned = sessionAttempts.reduce((sum, a) => sum + (a.isCorrect ? 10 : 2), 0);

    const validTimes = sessionAttempts.filter((a) => a.responseMs !== undefined && a.responseMs > 0);
    const avgTime = validTimes.length > 0
      ? ((validTimes.reduce((sum, a) => sum + a.responseMs, 0) / validTimes.length) / 1000).toFixed(1)
      : '—';

    return (
      <div className="w-full max-w-md mx-auto py-8 text-center space-y-6 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 mb-2">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Session Complete</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Finished practice for <strong className="text-primary font-semibold">{theory.title}</strong>
          </p>
        </div>

        {/* 3-Column Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">XP Earned</p>
            <p className="text-base sm:text-lg font-bold text-primary mt-1">+{totalXpEarned} XP</p>
          </div>
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Avg Speed</p>
            <p className="text-base sm:text-lg font-bold text-foreground mt-1">{avgTime}s</p>
          </div>
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Accuracy</p>
            <p className={`text-base sm:text-lg font-bold mt-1 ${finalAccuracy >= 80 ? 'text-emerald-500' : finalAccuracy >= 50 ? 'text-amber-500' : 'text-destructive'}`}>
              {finalAccuracy}%
            </p>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-3 shadow-sm text-left text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-muted-foreground font-semibold">Questions Answered</span>
            <span className="font-bold text-foreground">{totalQ}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-muted-foreground font-semibold">Correct Answers</span>
            <span className="font-bold text-emerald-500">{correctCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-semibold">Incorrect Answers</span>
            <span className="font-bold text-destructive">{totalQ - correctCount}</span>
          </div>
        </div>

        {/* Review Recommendation Card */}
        {recommendation ? (
          <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl text-left space-y-2 animate-scale-in">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <h4 className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Recommended Focus Area
              </h4>
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-foreground leading-tight">
                {recommendation.title}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your historical accuracy in this domain is currently <strong className="text-amber-600 dark:text-amber-400 font-bold">{recommendation.accuracy}%</strong>. We suggest spending more time practicing this theory to strengthen your mastery.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl text-left space-y-1.5 animate-scale-in">
            <div className="flex items-center gap-2">
              <span className="text-base">🌟</span>
              <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Mastery Status
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Superb performance! All clinical domains are currently evaluated at master level. Keep up the clean streak!
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 py-3 px-4 rounded-full border border-border bg-card font-bold hover:bg-secondary transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restart
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-3 px-4 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-md shadow-primary/10"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Active Question ──
  const currentQ = questions[currentIdx];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Level Up Celebration Dialog */}
      {leveledUpTo !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-sm w-full mx-4 text-center space-y-6 shadow-2xl animate-scale-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary animate-bounce">
              <Award className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold font-display text-foreground">Level Up!</h3>
              <p className="text-sm text-muted-foreground">
                Congratulations! You have reached <strong className="text-primary font-bold">Level {leveledUpTo}</strong>.
              </p>
            </div>
            <button
              onClick={() => setLeveledUpTo(null)}
              className="w-full py-3 px-4 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-95 transition-all cursor-pointer text-sm shadow-lg shadow-primary/10"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        open={showExitConfirm}
        title="Exit Practice?"
        description="Your progress in this session will not be saved. Are you sure you want to leave?"
        confirmLabel="Exit"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => router.push('/dashboard')}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            Back to{' '}
            <span className="font-serif italic font-semibold text-primary">Journeys</span>
          </span>
        </button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary/80 text-foreground font-mono">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{elapsedSeconds}s</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-primary fill-current" />
            <span>Active Session</span>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="overflow-hidden border border-border bg-card rounded-2xl shadow-sm relative pt-1">
        {/* Session Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${((currentIdx + (isSubmitted ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        {/* Card body */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Progress and tags */}
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Question {currentIdx + 1} of {questions.length}
            </span>
            <div className="flex gap-1.5 text-[9px] font-bold">
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 uppercase">
                {currentQ.bloom_level}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                L{currentQ.difficulty}
              </span>
            </div>
          </div>

          {/* Question text */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-bold font-display text-foreground leading-snug">
              {currentQ.stem}
            </h3>
          </div>

          {/* Options */}
          <div className="space-y-2.5 pt-2" role="radiogroup" aria-label="Answer choices">
            {currentQ.options.map((option, idx) => {
              const optionLetter = String.fromCharCode(65 + idx);

              let optionStyle = 'border-border hover:bg-secondary/50';
              let badgeStyle = 'bg-secondary text-secondary-foreground';

              if (selectedIdx === idx) {
                optionStyle = 'border-primary bg-primary/5';
                badgeStyle = 'bg-primary text-primary-foreground';
              }

              if (isSubmitted) {
                if (idx === currentQ.correct_index) {
                  optionStyle = 'border-emerald-500 bg-emerald-500/5 text-emerald-900 font-semibold';
                  badgeStyle = 'bg-emerald-500 text-white';
                } else if (selectedIdx === idx) {
                  optionStyle = 'border-destructive bg-destructive/5 text-destructive font-semibold';
                  badgeStyle = 'bg-destructive text-white';
                } else {
                  optionStyle = 'border-border opacity-50 pointer-events-none';
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isSubmitted}
                  onClick={() => setSelectedIdx(idx)}
                  className={`relative w-full flex items-center gap-3.5 p-3.5 text-left border rounded-xl transition-all duration-200 text-xs sm:text-sm cursor-pointer ${optionStyle}`}
                  role="radio"
                  aria-checked={selectedIdx === idx}
                  aria-label={`Option ${optionLetter}: ${option}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all ${badgeStyle}`}
                  >
                    {optionLetter}
                  </span>
                  <span>{option}</span>
                  {isSubmitted && selectedIdx === idx && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-bold text-primary animate-float-xp">
                      +{idx === currentQ.correct_index ? 10 : 2} XP
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation (shown after submit) */}
          {isSubmitted && (
            <div className="pt-4 border-t border-border/50 space-y-4 animate-fade-in" aria-live="polite">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Analysis:</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {currentQ.explanation}
                </p>
              </div>

              {currentQ.source_excerpt && (
                <p className="text-[10px] text-muted-foreground/70 italic pl-1">
                  <strong>Theory Reference:</strong> &ldquo;{currentQ.source_excerpt}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Submit / Next */}
          <div className="pt-6 border-t border-border flex justify-between items-center">
            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
              {!isSubmitted && 'Press A–D to select, Enter to submit'}
            </p>
            {!isSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedIdx === null}
                className="py-3 px-6 rounded-full font-bold bg-primary text-primary-foreground text-xs hover:opacity-95 transition-all shadow-md shadow-primary/10 cursor-pointer disabled:opacity-50"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="py-3 px-6 rounded-full font-bold bg-primary text-primary-foreground text-xs hover:opacity-95 transition-all shadow-md shadow-primary/10 cursor-pointer flex items-center gap-1"
              >
                {currentIdx + 1 < questions.length ? 'Next Question' : 'Complete Journey'}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center min-h-[50vh]">
          <div className="space-y-3 text-center">
            <div className="w-10 h-10 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Preparing practice session…</p>
          </div>
        </div>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}
