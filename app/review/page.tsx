'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import type { ReviewScheduleWithQuestion } from '@/lib/types';
import { sm2, gradeFromAttempt } from '@/lib/sm2';
import { xpToLevel } from '@/lib/utils';
import { playSound } from '@/lib/audio';
import {
  ArrowLeft, BookOpen, Award, Lightbulb, ChevronRight, Clock, CalendarCheck, Zap,
} from 'lucide-react';

export default function ReviewPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useProfile();

  // Review data
  const [dueItems, setDueItems] = useState<ReviewScheduleWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);
  const [forecastData, setForecastData] = useState<{
    dayName: string;
    dayLabel: string;
    count: number;
    theories: string[];
  }[]>([]);

  // Session state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<{ isCorrect: boolean; responseMs: number }[]>([]);
  const [sessionFinished, setSessionFinished] = useState(false);

  // Timer
  const questionStartTime = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Timer
  useEffect(() => {
    if (!started || loading || sessionFinished || isSubmitted) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [started, loading, sessionFinished, isSubmitted, currentIdx]);

  // Fetch due items
  const fetchDueItems = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_schedule')
        .select(`
          *,
          questions (
            id,
            stem,
            options,
            correct_index,
            explanation,
            difficulty,
            bloom_level,
            source_excerpt,
            theories (
              id,
              title
            )
          )
        `)
        .eq('user_id', profile.id)
        .lte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true });

      if (error) throw error;

      // Filter out items where the question was deleted
      const validItems = (data ?? []).filter(
        (item: ReviewScheduleWithQuestion) => item.questions !== null
      );
      setDueItems(validItems as ReviewScheduleWithQuestion[]);

      // Fetch all schedules for forecast calculation
      const { data: forecastSchedules } = await supabase
        .from('review_schedule')
        .select(`
          due_at,
          questions (
            theories (
              title
            )
          )
        `)
        .eq('user_id', profile.id);

      // Compute local 7-day forecast
      const days = [];
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        days.push({
          dateStr: d.toISOString().split('T')[0], // YYYY-MM-DD
          dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
          dayLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        });
      }

      const forecast = days.map((day, idx) => {
        const dayStart = new Date(day.dateStr + 'T00:00:00');
        const dayEnd = new Date(day.dateStr + 'T23:59:59.999');
        
        let count = 0;
        const theoriesDue = new Set<string>();
        
        (forecastSchedules ?? []).forEach(s => {
          if (!s.due_at) return;
          const due = new Date(s.due_at);
          
          const q = s.questions as unknown as { theories: { title: string } | null } | null;
          const tTitle = q?.theories?.title;

          if (idx === 0) {
            // Today includes everything due now or overdue
            if (due <= dayEnd) {
              count++;
              if (tTitle) theoriesDue.add(tTitle);
            }
          } else {
            // Future days only include items scheduled for that specific day
            if (due >= dayStart && due <= dayEnd) {
              count++;
              if (tTitle) theoriesDue.add(tTitle);
            }
          }
        });

        return {
          dayName: day.dayName,
          dayLabel: day.dayLabel,
          count,
          theories: Array.from(theoriesDue),
        };
      });

      setForecastData(forecast);
    } catch (err) {
      console.error('[Foundations] Error fetching review items:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        fetchDueItems();
      });
    }
  }, [profile, fetchDueItems]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  // Submit answer
  const handleSubmitAnswer = useCallback(async () => {
    if (selectedIdx === null || isSubmitted || !profile) return;

    const item = dueItems[currentIdx];
    const question = item.questions!;
    const isCorrect = selectedIdx === question.correct_index;
    const responseMs = Date.now() - questionStartTime.current;

    setIsSubmitted(true);

    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }

    try {
      // Record attempt
      await supabase.from('attempts').insert({
        user_id: profile.id,
        question_id: question.id,
        chosen_index: selectedIdx,
        is_correct: isCorrect,
        response_ms: responseMs,
      });

      // XP
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

      // Update SM-2 schedule
      const quality = gradeFromAttempt(isCorrect, responseMs);
      const result = sm2(
        {
          easeFactor: item.ease_factor,
          intervalDays: item.interval_days,
          repetitions: item.repetitions,
        },
        quality
      );

      await supabase
        .from('review_schedule')
        .upsert(
          {
            user_id: profile.id,
            question_id: question.id,
            ease_factor: result.easeFactor,
            interval_days: result.intervalDays,
            repetitions: result.repetitions,
            due_at: result.dueAt.toISOString(),
          },
          { onConflict: 'user_id,question_id' }
        );

      setSessionAttempts((prev) => [...prev, { isCorrect, responseMs }]);
    } catch (err) {
      console.error('[Foundations] Review answer error:', err);
    }
  }, [selectedIdx, isSubmitted, profile, dueItems, currentIdx]);

  // Keyboard navigation
  useEffect(() => {
    if (!started || isSubmitted || sessionFinished || loading) return;

    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const idx = key.charCodeAt(0) - 65;
      const question = dueItems[currentIdx]?.questions;
      if (question && idx >= 0 && idx < question.options.length) {
        setSelectedIdx(idx);
      }
      if (e.key === 'Enter' && selectedIdx !== null && !isSubmitted) {
        handleSubmitAnswer();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [started, currentIdx, isSubmitted, sessionFinished, loading, selectedIdx, dueItems, handleSubmitAnswer]);

  const handleNext = () => {
    if (currentIdx + 1 < dueItems.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedIdx(null);
      setIsSubmitted(false);
      setElapsedSeconds(0);
      questionStartTime.current = Date.now();
    } else {
      setSessionFinished(true);
    }
  };

  const renderForecast = () => {
    if (forecastData.length === 0) return null;

    return (
      <div className="bg-card border border-border/85 rounded-2xl p-5 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.01)] text-left backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            7-Day Review Forecast
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {forecastData.map((day, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-center flex flex-col justify-between min-h-[105px] transition-all duration-200 hover:shadow-sm ${
                day.count > 0
                  ? 'border-indigo-500/20 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.04]'
                  : 'border-border/80 bg-card/50'
              }`}
            >
              <div>
                <p className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider">
                  {day.dayName}
                </p>
                <p className="text-xs font-bold text-foreground mt-0.5">{day.dayLabel}</p>
              </div>
              <div className="mt-2 space-y-1">
                <div
                  className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    day.count > 0
                      ? 'bg-indigo-500 text-white'
                      : 'bg-secondary text-muted-foreground/80'
                  }`}
                >
                  {day.count} {day.count === 1 ? 'due' : 'due'}
                </div>
                {day.theories.length > 0 && (
                  <p className="text-[8px] text-muted-foreground/90 font-bold uppercase tracking-wider leading-tight line-clamp-2 pt-1">
                    {day.theories.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Auth loading ──
  if (authLoading || !profile) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading review deck…</p>
        </div>
      </div>
    );
  }

  // ── Empty state (no items due) ──
  if (!started && dueItems.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 space-y-8 animate-fade-in">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 mb-2">
            <CalendarCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">All Caught Up!</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
              You have no questions due for review right now. Keep practicing to build your review deck — items will appear here as they become due.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-95 transition-all shadow-md shadow-primary/15 cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

        {renderForecast()}
      </div>
    );
  }

  // ── Start screen ──
  if (!started) {
    // Group by theory for the overview
    const theoryGroups: Record<string, { title: string; count: number }> = {};
    dueItems.forEach((item) => {
      const theory = item.questions?.theories;
      if (theory) {
        if (!theoryGroups[theory.id]) {
          theoryGroups[theory.id] = { title: theory.title, count: 0 };
        }
        theoryGroups[theory.id].count += 1;
      }
    });

    return (
      <div className="w-full max-w-2xl mx-auto py-8 space-y-8 animate-fade-in">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-500 mb-2">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground">Daily Review</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {dueItems.length} {dueItems.length === 1 ? 'question is' : 'questions are'} due for spaced review.
              These items are scheduled to reinforce your long-term retention.
            </p>
          </div>

          {/* Theory breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Review Breakdown</h3>
            {Object.values(theoryGroups).map((group, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground">{group.title}</span>
                <span className="text-muted-foreground font-mono">{group.count} due</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setStarted(true);
              questionStartTime.current = Date.now();
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-xs hover:opacity-95 transition-all cursor-pointer shadow-md shadow-indigo-500/15 flex items-center justify-center gap-1.5"
          >
            Start Review Session
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-2.5 px-4 rounded-xl border border-border bg-card font-bold text-xs hover:bg-secondary transition-all cursor-pointer text-muted-foreground"
          >
            Back to Dashboard
          </button>
        </div>

        {renderForecast()}
      </div>
    );
  }

  // ── Session Finished ──
  if (sessionFinished) {
    const totalQ = sessionAttempts.length;
    const correctCount = sessionAttempts.filter((a) => a.isCorrect).length;
    const finalAccuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const totalXpEarned = sessionAttempts.reduce((sum, a) => sum + (a.isCorrect ? 10 : 2), 0);

    return (
      <div className="w-full max-w-md mx-auto py-8 text-center space-y-6 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 mb-2">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Review Complete</h2>
          <p className="text-xs text-muted-foreground mt-1">
            You reviewed <strong className="text-primary font-semibold">{totalQ}</strong> questions.
            Items have been rescheduled based on your performance.
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">XP Earned</p>
            <p className="text-base sm:text-lg font-bold text-primary mt-1">+{totalXpEarned} XP</p>
          </div>
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Correct</p>
            <p className="text-base sm:text-lg font-bold text-emerald-500 mt-1">{correctCount}/{totalQ}</p>
          </div>
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Accuracy</p>
            <p className={`text-base sm:text-lg font-bold mt-1 ${finalAccuracy >= 80 ? 'text-emerald-500' : finalAccuracy >= 50 ? 'text-amber-500' : 'text-destructive'}`}>
              {finalAccuracy}%
            </p>
          </div>
        </div>

        <div className="flex gap-3">
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
  const currentItem = dueItems[currentIdx];
  const currentQ = currentItem.questions!;
  const theoryTitle = currentQ.theories?.title ?? 'Review';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Level Up Dialog */}
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

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            Exit{' '}
            <span className="font-serif italic font-semibold text-primary">Review</span>
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
            <span>Spaced Review</span>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="overflow-hidden border border-border bg-card rounded-2xl shadow-sm relative pt-1">
        {/* Session Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${((currentIdx + (isSubmitted ? 1 : 0)) / dueItems.length) * 100}%` }}
          />
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Progress and tags */}
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Review {currentIdx + 1} of {dueItems.length}
            </span>
            <div className="flex gap-1.5 text-[9px] font-bold">
              <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 uppercase">
                {theoryTitle}
              </span>
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

          {/* Explanation */}
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
                {currentIdx + 1 < dueItems.length ? 'Next Review' : 'Complete Review'}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
