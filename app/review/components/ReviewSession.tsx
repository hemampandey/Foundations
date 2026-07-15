'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ReviewScheduleWithQuestion } from '@/lib/types';
import { sm2, gradeFromAttempt } from '@/lib/sm2';
import { xpToLevel } from '@/lib/utils';
import { playSound } from '@/lib/audio';
import {
  ArrowLeft, Award, Lightbulb, ChevronRight, Clock, Zap
} from 'lucide-react';

interface ReviewSessionProps {
  profile: { id: string };
  dueItems: ReviewScheduleWithQuestion[];
  onExit: () => void;
  onCompleteSession: (attempts: { isCorrect: boolean; responseMs: number }[]) => void;
}

export default function ReviewSession({
  profile,
  dueItems,
  onExit,
  onCompleteSession
}: ReviewSessionProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<{ isCorrect: boolean; responseMs: number }[]>([]);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);

  // Timer state
  const questionStartTime = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Timer
  useEffect(() => {
    if (isSubmitted) return;

    questionStartTime.current = Date.now();

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - questionStartTime.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIdx, isSubmitted]);

  // Submit answer
  const handleSubmitAnswer = useCallback(async () => {
    if (selectedIdx === null || isSubmitted || !profile) return;

    const item = dueItems[currentIdx];
    const question = item.questions;
    if (!question) return;

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

      // XP Calculations
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
    if (isSubmitted) return;

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
  }, [currentIdx, isSubmitted, selectedIdx, dueItems, handleSubmitAnswer]);

  const handleNext = () => {
    if (currentIdx + 1 < dueItems.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedIdx(null);
      setIsSubmitted(false);
      setElapsedSeconds(0);
    } else {
      onCompleteSession(sessionAttempts);
    }
  };

  const currentItem = dueItems[currentIdx];
  const currentQ = currentItem ? currentItem.questions : null;
  const theoryTitle = currentQ?.theories?.title ?? 'Review';

  if (!currentQ) return null;

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
          onClick={onExit}
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
      <div key={currentIdx} className="overflow-hidden border border-border bg-card rounded-2xl shadow-sm relative pt-1 animate-scale-in">
        {/* Session Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
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
              <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 uppercase font-bold">
                {theoryTitle}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 uppercase font-bold">
                {currentQ.bloom_level}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
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
              let animationClass = '';

              if (selectedIdx === idx) {
                optionStyle = 'border-primary bg-primary/5';
                badgeStyle = 'bg-primary text-primary-foreground';
              }

              if (isSubmitted) {
                if (idx === currentQ.correct_index) {
                  optionStyle = 'border-emerald-500 bg-emerald-500/5 text-emerald-900 font-semibold';
                  badgeStyle = 'bg-emerald-500 text-white';
                  animationClass = 'animate-correct-pulse';
                } else if (selectedIdx === idx) {
                  optionStyle = 'border-destructive bg-destructive/5 text-destructive font-semibold';
                  badgeStyle = 'bg-destructive text-white';
                  animationClass = 'animate-shake';
                } else {
                  optionStyle = 'border-border opacity-50 pointer-events-none';
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isSubmitted}
                  onClick={() => setSelectedIdx(idx)}
                  className={`relative w-full flex items-center gap-3.5 p-3.5 text-left border rounded-xl transition-all duration-200 text-xs sm:text-sm cursor-pointer ${optionStyle} ${animationClass}`}
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
