'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import type { ReviewScheduleWithQuestion } from '@/lib/types';
import { Award } from 'lucide-react';

// Modular Child Components
import ReviewSession from './components/ReviewSession';
import ForecastTab from './components/ForecastTab';
import BrowseTab from './components/BrowseTab';
import HistoryTab from './components/HistoryTab';






interface RawQuestion {
  id: string;
  stem: string;
  difficulty: number | string;
  bloom_level: string;
  theories: unknown;
}

interface RawTheory {
  id: string;
  title: string;
}

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action');
  const { profile, loading: authLoading } = useProfile();

  // Navigation Tab
  const activeTabParam = searchParams.get('tab') || 'forecast';
  const activeTab = (['forecast', 'browse', 'history'].includes(activeTabParam) ? activeTabParam : 'forecast') as 'forecast' | 'browse' | 'history';

  // Review data (due questions)
  const [dueItems, setDueItems] = useState<ReviewScheduleWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);

  // Spaced forecast calendar details
  const [forecastData, setForecastData] = useState<{
    dateStr: string;
    dayName: string;
    dayLabel: string;
    count: number;
    theories: string[];
  }[]>([]);

  // AI Diagnostics weak theories state
  const [weakTheories, setWeakTheories] = useState<{ id: string; title: string; accuracy: number; total: number }[]>([]);





  // Completed Session Metrics
  const [completedAttempts, setCompletedAttempts] = useState<{ isCorrect: boolean; responseMs: number }[] | null>(null);

  // Extra dashboard metrics
  const [streak, setStreak] = useState(0);
  const [weeklyHistory, setWeeklyHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [recentDays, setRecentDays] = useState<{ dateLabel: string; count: number; xp: number }[]>([]);
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [nextWeekCount, setNextWeekCount] = useState(0);

  // Fetch due review items
  const fetchDueItems = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const [
        dueRes,
        forecastRes,
        attemptsRes,
        progressRes,
        recentAttemptsRes,
        historyRes
      ] = await Promise.all([
        supabase
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
          .lte('due_at', endOfToday.toISOString())
          .order('due_at', { ascending: true }),
        supabase
          .from('review_schedule')
          .select(`
            due_at,
            questions (
              theories (
                title
              )
            )
          `)
          .eq('user_id', profile.id),
        supabase
          .from('attempts')
          .select(`
            id,
            is_correct,
            questions (
              theories (
                id,
                title
              )
            )
          `)
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase
          .from('attempts')
          .select('created_at, is_correct')
          .eq('user_id', profile.id)
          .gte('created_at', sevenDaysAgo.toISOString()),
        supabase
          .from('attempts')
          .select('created_at, is_correct')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(150)
      ]);

      if (dueRes.error) throw dueRes.error;

      // Filter out items where the question was deleted
      const validItems = (dueRes.data ?? []).filter(
        (item: ReviewScheduleWithQuestion) => item.questions !== null
      );
      setDueItems(validItems as ReviewScheduleWithQuestion[]);

      const theoryStats: Record<string, { id: string; title: string; correct: number; total: number }> = {};
      if (attemptsRes.data) {
        (attemptsRes.data ?? []).forEach((rawAttempt: unknown) => {
          const attempt = rawAttempt as {
            is_correct: boolean;
            questions: unknown;
          };
          const isCorrect = attempt.is_correct;
          const rawQ = attempt.questions ? (Array.isArray(attempt.questions) ? (attempt.questions[0] as RawQuestion) : (attempt.questions as RawQuestion)) : null;
          const rawTheory = rawQ && rawQ.theories ? (Array.isArray(rawQ.theories) ? (rawQ.theories[0] as RawTheory) : (rawQ.theories as RawTheory)) : null;

          if (rawTheory && rawTheory.title && rawTheory.id) {
            const tId = rawTheory.id;
            const tTitle = rawTheory.title;
            if (!theoryStats[tTitle]) {
              theoryStats[tTitle] = { id: tId, title: tTitle, correct: 0, total: 0 };
            }
            theoryStats[tTitle].total += 1;
            if (isCorrect) {
              theoryStats[tTitle].correct += 1;
            }
          }
        });
      }

      const computedWeak = Object.values(theoryStats)
        .map((stats) => ({
          id: stats.id,
          title: stats.title,
          accuracy: Math.round((stats.correct / stats.total) * 100),
          total: stats.total
        }))
        .filter(t => t.accuracy < 80)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 2);

      setWeakTheories(computedWeak);

      // Compute local 7-day forecast
      const days = [];
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        days.push({
          dateStr: d.toISOString().split('T')[0],
          dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
          dayLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        });
      }

      const forecast = days.map((day) => {
        const dayStart = new Date(day.dateStr + 'T00:00:00');
        const dayEnd = new Date(day.dateStr + 'T23:59:59.999');
        
        let count = 0;
        const theoriesDue = new Set<string>();
        
        (forecastRes.data ?? []).forEach(s => {
          if (!s.due_at) return;
          const due = new Date(s.due_at);
          const q = s.questions ? (Array.isArray(s.questions) ? (s.questions[0] as RawQuestion) : (s.questions as RawQuestion)) : null;
          const rawTheory = q && q.theories ? (Array.isArray(q.theories) ? (q.theories[0] as RawTheory) : (q.theories as RawTheory)) : null;
          const tTitle = rawTheory?.title;

          if (due >= dayStart && due <= dayEnd) {
            count++;
            if (tTitle) theoriesDue.add(tTitle);
          }
        });

        return {
          dateStr: day.dateStr,
          dayName: day.dayName,
          dayLabel: day.dayLabel,
          count,
          theories: Array.from(theoriesDue),
        };
      });

      setForecastData(forecast);

      if (progressRes.data) {
        setStreak(progressRes.data.streak_days ?? 0);
      }

      const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];
      if (recentAttemptsRes.data) {
        recentAttemptsRes.data.forEach((att) => {
          const date = new Date(att.created_at);
          const day = date.getDay();
          const index = day === 0 ? 6 : day - 1;
          weeklyCounts[index] += 1;
        });
      }
      setWeeklyHistory(weeklyCounts);

      const dateGroups: Record<string, { count: number; xp: number }> = {};
      if (historyRes.data) {
        historyRes.data.forEach((att) => {
          const dateStr = new Date(att.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          if (!dateGroups[dateStr]) {
            dateGroups[dateStr] = { count: 0, xp: 0 };
          }
          dateGroups[dateStr].count += 1;
          dateGroups[dateStr].xp += att.is_correct ? 10 : 2;
        });
      }

      const formattedHistory = Object.entries(dateGroups).map(([dateLabel, val]) => {
        const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        let displayLabel = dateLabel;
        if (dateLabel === todayStr) displayLabel = 'Today';
        else if (dateLabel === yesterdayStr) displayLabel = 'Yesterday';

        return {
          dateLabel: displayLabel,
          count: val.count,
          xp: val.xp
        };
      }).slice(0, 3);
      setRecentDays(formattedHistory);

      // 4. Calculate upcoming review counts for Today, Tomorrow, This Week, and Next Week
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(todayStart);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      const endOfNextWeek = new Date(todayStart);
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 14);

      let thisWeekVal = 0;
      let nextWeekVal = 0;

      (forecastRes.data ?? []).forEach(s => {
        if (!s.due_at) return;
        const due = new Date(s.due_at);
        if (due >= todayStart && due < endOfWeek) {
          thisWeekVal++;
        } else if (due >= endOfWeek && due < endOfNextWeek) {
          nextWeekVal++;
        }
      });

      setThisWeekCount(thisWeekVal);
      setNextWeekCount(nextWeekVal);
    } catch (err) {
      console.error('[Foundations] Error fetching review items:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);



  // Trigger loads based on active tab
  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        if (activeTab === 'forecast') {
          fetchDueItems();
        } else {
          setLoading(false);
        }
      });
    }
  }, [profile, activeTab, fetchDueItems]);

  // Handle auto-start action
  useEffect(() => {
    if (actionParam === 'start' && !loading && dueItems.length > 0 && !started) {
      Promise.resolve().then(() => {
        setStarted(true);
        router.replace('/review');
      });
    }
  }, [actionParam, loading, dueItems, started, router]);

  const handleExitReview = useCallback(() => {
    setStarted(false);
    setCompletedAttempts(null);
    router.replace('/review');
  }, [router]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  // ── Loading state — modern skeleton shimmer ──
  if (loading && !started) {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="border-b border-border/80 pb-6">
          <div className="skeleton h-8 w-36 mb-2" />
          <div className="skeleton h-3 w-64 mt-2" />
        </div>

        {/* Hero banner skeleton */}
        <div className="rounded-3xl border border-border/40 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1 space-y-3 w-full">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3 w-72" />
            <div className="skeleton h-10 w-40 mt-4" />
          </div>
          <div className="flex gap-4 shrink-0">
            <div className="skeleton h-20 w-20 rounded-2xl" />
            <div className="skeleton h-20 w-20 rounded-2xl" />
            <div className="skeleton h-20 w-20 rounded-2xl" />
          </div>
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 p-4 space-y-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="rounded-2xl border border-border/40 p-6 space-y-4">
          <div className="skeleton h-4 w-40" />
          <div className="flex items-end justify-between gap-3 h-28">
            {[45, 75, 60, 90, 50, 80, 65].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="skeleton w-full rounded-lg" style={{ height: `${h}%` }} />
                <div className="skeleton h-2 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Session Finished ──
  if (completedAttempts) {
    const totalQ = completedAttempts.length;
    const correctCount = completedAttempts.filter((a) => a.isCorrect).length;
    const finalAccuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const totalXpEarned = completedAttempts.reduce((sum, a) => sum + (a.isCorrect ? 10 : 2), 0);

    return (
      <div className="w-full max-w-md mx-auto py-8 text-center space-y-6 animate-fade-in relative">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 mb-2"><Award className="w-8 h-8" /></div>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Review Complete</h2>
          <p className="text-xs text-muted-foreground mt-1">You reviewed <strong className="text-primary font-semibold">{totalQ}</strong> questions. Items have been rescheduled based on your performance.</p>
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
            <p className={`text-base sm:text-lg font-bold mt-1 ${finalAccuracy >= 80 ? 'text-emerald-500' : finalAccuracy >= 50 ? 'text-amber-500' : 'text-destructive'}`}>{finalAccuracy}%</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => {
              setStarted(false);
              setCompletedAttempts(null);
              fetchDueItems();
            }}
            className="flex-1 py-3 px-4 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-md shadow-primary/10">Go Back</button>
        </div>
      </div>
    );
  }

  // ── Active Quiz Review Session ──
  if (started && dueItems.length > 0 && profile) {
    return (
      <ReviewSession
        profile={profile}
        dueItems={dueItems}
        onExit={handleExitReview}
        onCompleteSession={(attempts) => setCompletedAttempts(attempts)}
      />
    );
  }

  // ── Dashboard View (Tabs list) ──
  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-primary font-inria text-foreground tracking-tight flex items-center gap-2">Review</h1>
          <p className="text-xs text-primary font-inria text-muted-foreground mt-1 leading-relaxed max-w-md">Tracks card repetition intervals and manages scheduled memory retention.</p>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'forecast' && (
        <ForecastTab
          dueItems={dueItems}
          forecastData={forecastData}
          weakTheories={weakTheories}
          onStartPractice={() => setStarted(true)}
          streak={streak}
          weeklyHistory={weeklyHistory}
          recentDays={recentDays}
          thisWeekCount={thisWeekCount}
          nextWeekCount={nextWeekCount}
        />
      )}

      {activeTab === 'browse' && (
        <BrowseTab />
      )}

      {activeTab === 'history' && (
        <HistoryTab />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="w-full space-y-6 animate-fade-in">
        <div className="border-b border-border/80 pb-6">
          <div className="skeleton h-8 w-36 mb-2" />
          <div className="skeleton h-3 w-64 mt-2" />
        </div>
        <div className="rounded-3xl border border-border/40 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1 space-y-3 w-full">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3 w-72" />
          </div>
        </div>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
