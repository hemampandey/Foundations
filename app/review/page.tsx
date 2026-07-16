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

interface BrowseScheduleItem {
  user_id: string;
  question_id: string;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  repetitions: number;
  created_at: string;
  questions: {
    id: string;
    stem: string;
    difficulty: number;
    bloom_level: string;
    theories: {
      id: string;
      title: string;
    } | null;
  } | null;
}

interface HistoryAttemptItem {
  id: string;
  is_correct: boolean;
  response_ms: number;
  created_at: string;
  questions: {
    stem: string;
    theories: {
      title: string;
    } | null;
  } | null;
}

interface ForecastScheduleItem {
  due_at: string | null;
  questions: {
    id: string;
    stem: string;
    difficulty: number;
    bloom_level: string;
    theories: {
      title: string;
    } | null;
  } | null;
}

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

function ConfettiShower() {
  const [particles] = useState(() => {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
    return Array.from({ length: 65 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: `${Math.random() * 1.2}s`,
      duration: `${2.2 + Math.random() * 1.8}s`,
    }));
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
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

  // Browse Schedules state
  const [allSchedules, setAllSchedules] = useState<BrowseScheduleItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [theoryOptions, setTheoryOptions] = useState<string[]>([]);

  // History state
  const [historyAttempts, setHistoryAttempts] = useState<HistoryAttemptItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
            id,
            stem,
            difficulty,
            bloom_level,
            theories (
              title
            )
          )
        `)
        .eq('user_id', profile.id);

      // Format query results
      const formattedForecast = (forecastSchedules ?? []).map((rawItem: unknown) => {
        const s = rawItem as { due_at: string | null; questions: unknown };
        const rawQ = s.questions ? (Array.isArray(s.questions) ? (s.questions[0] as RawQuestion) : (s.questions as RawQuestion)) : null;
        const rawTheory = rawQ && rawQ.theories ? (Array.isArray(rawQ.theories) ? (rawQ.theories[0] as RawTheory) : (rawQ.theories as RawTheory)) : null;

        return {
          due_at: s.due_at,
          questions: rawQ ? {
            id: rawQ.id,
            stem: rawQ.stem,
            difficulty: Number(rawQ.difficulty),
            bloom_level: rawQ.bloom_level,
            theories: rawTheory ? {
              title: rawTheory.title
            } : null
          } : null
        };
      });


      // Fetch user attempts to compute weak theories diagnostics
      const { data: attemptsData } = await supabase
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
        .eq('user_id', profile.id);

      const theoryStats: Record<string, { id: string; title: string; correct: number; total: number }> = {};
      if (attemptsData) {
        (attemptsData ?? []).forEach((rawAttempt: unknown) => {
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

      // Compute overdue/missed reviews (scheduled before today)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let overdueCount = 0;
      const overdueTheories = new Set<string>();
      
      (forecastSchedules ?? []).forEach(s => {
        if (!s.due_at) return;
        const due = new Date(s.due_at);
        if (due < todayStart) {
          overdueCount++;
          const q = s.questions ? (Array.isArray(s.questions) ? (s.questions[0] as RawQuestion) : (s.questions as RawQuestion)) : null;
          const rawTheory = q && q.theories ? (Array.isArray(q.theories) ? (q.theories[0] as RawTheory) : (q.theories as RawTheory)) : null;
          const tTitle = rawTheory?.title;
          if (tTitle) overdueTheories.add(tTitle);
        }
      });


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
        
        (forecastSchedules ?? []).forEach(s => {
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

      // 1. Fetch user progress for streak
      const { data: progData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (progData) {
        setStreak(progData.streak_days ?? 0);
      }

      // 2. Fetch attempts in the last 7 days for the weekly history bar chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentAttempts } = await supabase
        .from('attempts')
        .select('created_at, is_correct')
        .eq('user_id', profile.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const weeklyCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon = 0, Tue = 1 ... Sun = 6
      if (recentAttempts) {
        recentAttempts.forEach((att) => {
          const date = new Date(att.created_at);
          const day = date.getDay(); // Sun = 0, Mon = 1 ... Sat = 6
          const index = day === 0 ? 6 : day - 1;
          weeklyCounts[index] += 1;
        });
      }
      setWeeklyHistory(weeklyCounts);

      // 3. Group attempts by date for recent history feed (last 3 active days)
      const { data: allHistory } = await supabase
        .from('attempts')
        .select('created_at, is_correct')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      const dateGroups: Record<string, { count: number; xp: number }> = {};
      if (allHistory) {
        allHistory.forEach((att) => {
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
      const endOfWeek = new Date(todayStart);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      const endOfNextWeek = new Date(todayStart);
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 14);

      let thisWeekVal = 0;
      let nextWeekVal = 0;

      (forecastSchedules ?? []).forEach(s => {
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

  // Fetch all schedules for browsing
  const fetchAllSchedules = useCallback(async () => {
    if (!profile) return;
    setLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from('review_schedule')
        .select(`
          user_id,
          question_id,
          ease_factor,
          interval_days,
          due_at,
          repetitions,
          created_at,
          questions (
            id,
            stem,
            difficulty,
            bloom_level,
            theories (
              id,
              title
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('due_at', { ascending: true });

      if (error) throw error;

      const valid = (data as unknown as BrowseScheduleItem[] ?? []).filter(item => item.questions !== null);
      setAllSchedules(valid);

      // Extract unique theory options
      const theories = new Set<string>();
      valid.forEach((s) => {
        const title = s.questions?.theories?.title;
        if (title) theories.add(title);
      });
      setTheoryOptions(Array.from(theories));
    } catch (err) {
      console.error('[Foundations] Error loading all schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, [profile]);

  // Fetch history attempts
  const fetchHistoryAttempts = useCallback(async () => {
    if (!profile) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('attempts')
        .select(`
          id,
          is_correct,
          response_ms,
          created_at,
          questions (
            stem,
            theories (
              title
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistoryAttempts(data as unknown as HistoryAttemptItem[] ?? []);
    } catch (err) {
      console.error('[Foundations] Error loading review history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [profile]);

  // Trigger loads based on active tab
  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        if (activeTab === 'forecast') {
          fetchDueItems();
        } else if (activeTab === 'browse') {
          fetchAllSchedules();
        } else if (activeTab === 'history') {
          fetchHistoryAttempts();
        }
      });
    }
  }, [profile, activeTab, fetchDueItems, fetchAllSchedules, fetchHistoryAttempts]);

  // Handle auto-start action
  useEffect(() => {
    if (actionParam === 'start' && !loading && dueItems.length > 0 && !started) {
      Promise.resolve().then(() => {
        setStarted(true);
      });
    }
  }, [actionParam, loading, dueItems, started]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  // ── Loading state ──
  if (loading && !started) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading review deck…</p>
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
        <ConfettiShower />
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
        onExit={() => setStarted(false)}
        onCompleteSession={(attempts) => setCompletedAttempts(attempts)}
      />
    );
  }

  // ── Dashboard View (Tabs list) ──
  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 gap-4">
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
        <BrowseTab
          allSchedules={allSchedules}
          loadingSchedules={loadingSchedules}
          theoryOptions={theoryOptions}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          historyAttempts={historyAttempts}
          loadingHistory={loadingHistory}
        />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
