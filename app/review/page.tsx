'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import type { ReviewScheduleWithQuestion } from '@/lib/types';
import { sm2, gradeFromAttempt } from '@/lib/sm2';
import { xpToLevel } from '@/lib/utils';
import { playSound } from '@/lib/audio';
import {
  ArrowLeft, Award, Lightbulb, ChevronRight, Clock, CalendarCheck, Zap, Brain,
  Search, SlidersHorizontal, History, Calendar, CheckSquare, ChevronDown, ChevronUp
} from 'lucide-react';

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

interface SelectedForecastItem {
  stem: string;
  difficulty: number;
  bloomLevel: string;
  theoryTitle: string;
}

interface SelectedDayDetails {
  title: string;
  count: number;
  items: SelectedForecastItem[];
}

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action');
  const { profile, loading: authLoading } = useProfile();

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'forecast' | 'browse' | 'history'>('forecast');

  // Review data (due questions)
  const [dueItems, setDueItems] = useState<ReviewScheduleWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);

  // Spaced forecast calendar details
  const [forecastData, setForecastData] = useState<{
    dateStr: string;
    dayName: string;
    dayLabel: string;
    count: number;
    theories: string[];
  }[]>([]);
  const [overdueData, setOverdueData] = useState<{
    count: number;
    theories: string[];
  }>({ count: 0, theories: [] });

  // Interactive Forecast Details Popover State
  const [allForecastSchedules, setAllForecastSchedules] = useState<ForecastScheduleItem[]>([]);
  const [selectedForecastDay, setSelectedForecastDay] = useState<SelectedDayDetails | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ left: string; right?: string; top: string } | null>(null);

  // Browse Schedules state
  const [allSchedules, setAllSchedules] = useState<BrowseScheduleItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheory, setSelectedTheory] = useState('');
  const [theoryOptions, setTheoryOptions] = useState<string[]>([]);
  const [expandedStems, setExpandedStems] = useState<Record<string, boolean>>({});

  // History state
  const [historyAttempts, setHistoryAttempts] = useState<HistoryAttemptItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Active quiz session states
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

      // Format query results to handle array representation from PostgREST joins
      const formattedForecast: ForecastScheduleItem[] = (forecastSchedules ?? []).map((rawItem: unknown) => {
        const s = rawItem as {
          due_at: string | null;
          questions: unknown;
        };
        const rawQ = Array.isArray(s.questions)
          ? (s.questions[0] as { id: string; stem: string; difficulty: number; bloom_level: string; theories: unknown } | undefined)
          : (s.questions as { id: string; stem: string; difficulty: number; bloom_level: string; theories: unknown } | null);
        const rawTheory = rawQ && Array.isArray(rawQ.theories)
          ? (rawQ.theories[0] as { title: string } | undefined)
          : (rawQ?.theories as { title: string } | null);

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

      setAllForecastSchedules(formattedForecast);

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
          const q = s.questions as unknown as { theories: { title: string } | null } | null;
          const tTitle = q?.theories?.title;
          if (tTitle) overdueTheories.add(tTitle);
        }
      });

      setOverdueData({
        count: overdueCount,
        theories: Array.from(overdueTheories),
      });

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

      const forecast = days.map((day) => {
        const dayStart = new Date(day.dateStr + 'T00:00:00');
        const dayEnd = new Date(day.dateStr + 'T23:59:59.999');
        
        let count = 0;
        const theoriesDue = new Set<string>();
        
        (forecastSchedules ?? []).forEach(s => {
          if (!s.due_at) return;
          const due = new Date(s.due_at);
          
          const q = s.questions as unknown as { theories: { title: string } | null } | null;
          const tTitle = q?.theories?.title;

          // Days strictly count items falling on their respective date bounds
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
        questionStartTime.current = Date.now();
      });
    }
  }, [actionParam, loading, dueItems, started]);

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

  const handleForecastCardClick = (
    e: React.MouseEvent<HTMLDivElement>,
    title: string,
    items: SelectedForecastItem[]
  ) => {
    const target = e.currentTarget;
    const parent = target.parentElement;
    if (!parent) return;

    const leftOffset = target.offsetLeft;
    const topOffset = target.offsetTop + target.offsetHeight + 8; // 8px space below card
    const containerWidth = parent.offsetWidth || 800;

    // Check if the popover overflows the container (width ~320px)
    if (leftOffset + 320 > containerWidth) {
      setPopoverPosition({
        left: 'auto',
        right: `${Math.max(0, containerWidth - (leftOffset + target.offsetWidth))}px`,
        top: `${topOffset}px`
      });
    } else {
      setPopoverPosition({
        left: `${leftOffset}px`,
        top: `${topOffset}px`
      });
    }

    setSelectedForecastDay({
      title,
      count: items.length,
      items
    });
  };

  const toggleStem = (qId: string) => {
    setExpandedStems(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const getDueStatus = (dueAtStr: string) => {
    const due = new Date(dueAtStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Overdue', color: 'text-rose-600 bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20' };
    if (diffDays === 0) return { label: 'Due Today', color: 'text-amber-600 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20' };
    return { label: `Due in ${diffDays}d`, color: 'text-muted-foreground bg-secondary/80 border-border/60' };
  };

  // Helper: Render forecast grid
  const renderForecast = () => {
    if (forecastData.length === 0) return null;

    return (
      <div className="bg-card border border-border/85 rounded-2xl p-5 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.01)] text-left backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Review Forecast & Spaced Study Load
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Missed reviews card */}
          <div
            onClick={(e) => {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);

              const items = allForecastSchedules
                .filter(s => s.due_at && new Date(s.due_at) < todayStart && s.questions)
                .map(s => ({
                  stem: s.questions!.stem,
                  difficulty: s.questions!.difficulty,
                  bloomLevel: s.questions!.bloom_level,
                  theoryTitle: s.questions!.theories?.title ?? 'General'
                }));

              handleForecastCardClick(e, 'Missed Reviews', items);
            }}
            role="button"
            tabIndex={0}
            className={`p-3 rounded-xl border text-center flex flex-col justify-between min-h-[105px] transition-all duration-250 hover:shadow-sm cursor-pointer hover:border-rose-500/40 hover:scale-[1.02] active:scale-[0.98] ${
              overdueData.count > 0
                ? 'border-rose-500/25 bg-rose-500/[0.02] dark:bg-rose-500/[0.04]'
                : 'border-border/80 bg-card/50'
            }`}
          >
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider">
                Missed
              </p>
              <p className={`text-xs font-bold mt-0.5 ${overdueData.count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                {overdueData.count > 0 ? 'Overdue' : 'All Clear'}
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div
                className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  overdueData.count > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                }`}
              >
                {overdueData.count > 0 ? `${overdueData.count} missed` : '0 missed'}
              </div>
              {overdueData.count > 0 && overdueData.theories.length > 0 && (
                <p className="text-[8px] text-rose-600/90 dark:text-rose-400/90 font-bold uppercase tracking-wider leading-tight line-clamp-2 pt-1">
                  {overdueData.theories.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Forecast Days */}
          {forecastData.map((day, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                const dayStart = new Date(day.dateStr + 'T00:00:00');
                const dayEnd = new Date(day.dateStr + 'T23:59:59.999');

                const items = allForecastSchedules
                  .filter(s => {
                    if (!s.due_at) return false;
                    const due = new Date(s.due_at);
                    return due >= dayStart && due <= dayEnd && s.questions;
                  })
                  .map(s => ({
                    stem: s.questions!.stem,
                    difficulty: s.questions!.difficulty,
                    bloomLevel: s.questions!.bloom_level,
                    theoryTitle: s.questions!.theories?.title ?? 'General'
                  }));

                handleForecastCardClick(
                  e,
                  `Forecast for ${day.dayName === 'Today' ? 'Today' : day.dayName === 'Tomorrow' ? 'Tomorrow' : day.dayLabel}`,
                  items
                );
              }}
              role="button"
              tabIndex={0}
              className={`p-3 rounded-xl border text-center flex flex-col justify-between min-h-[105px] transition-all duration-250 hover:shadow-sm cursor-pointer hover:border-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] ${
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

        {/* Floating absolute popover for forecast details */}
        {selectedForecastDay && popoverPosition && (
          <>
            {/* Transparent backdrop to intercept click outs */}
            <div 
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => {
                setSelectedForecastDay(null);
                setPopoverPosition(null);
              }}
            />
            <div 
              style={{
                position: 'absolute',
                top: popoverPosition.top,
                left: popoverPosition.left !== 'auto' ? popoverPosition.left : undefined,
                right: popoverPosition.right ? popoverPosition.right : undefined,
              }}
              className="z-50 w-72 sm:w-80 bg-card border border-border/90 rounded-2xl shadow-xl p-4 animate-scale-in text-left space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground font-display flex items-center gap-1.5">
                    <span>📅</span>
                    {selectedForecastDay.title}
                  </h4>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                    {selectedForecastDay.count} {selectedForecastDay.count === 1 ? 'review item' : 'review items'} due
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedForecastDay(null);
                    setPopoverPosition(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                  aria-label="Close"
                >
                  <span className="text-[10px] font-bold font-mono">✕</span>
                </button>
              </div>

              {/* Scrollable Questions list */}
              <div className="space-y-2">
                <p className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider pl-0.5">Scheduled Questions</p>
                {selectedForecastDay.count === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-[10px] border border-dashed border-border rounded-xl">
                    0 reviews scheduled
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                    {selectedForecastDay.items.map((item, idx) => (
                      <div key={idx} className="bg-secondary/20 border border-border/40 rounded-xl p-2.5 space-y-1.5 transition-all hover:border-border">
                        <div className="flex items-center flex-wrap gap-1 text-[8px] font-extrabold uppercase">
                          <span className="px-1 py-0.2 bg-secondary text-foreground rounded">
                            {item.theoryTitle}
                          </span>
                          <span className="px-1 py-0.2 bg-blue-500/10 text-blue-600 rounded">
                            {item.bloomLevel}
                          </span>
                          <span className="px-1 py-0.2 bg-amber-500/10 text-amber-600 rounded">
                            L{item.difficulty}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-foreground leading-relaxed line-clamp-2">
                          {item.stem}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

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
  if (sessionFinished) {
    const totalQ = sessionAttempts.length;
    const correctCount = sessionAttempts.filter((a) => a.isCorrect).length;
    const finalAccuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const totalXpEarned = sessionAttempts.reduce((sum, a) => sum + (a.isCorrect ? 10 : 2), 0);

    return (
      <div className="w-full max-w-md mx-auto py-8 text-center space-y-6 animate-fade-in relative">
        <ConfettiShower />
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
            onClick={() => {
              setStarted(false);
              setSessionFinished(false);
              setCurrentIdx(0);
              setSelectedIdx(null);
              setIsSubmitted(false);
              setSessionAttempts([]);
              setElapsedSeconds(0);
              fetchDueItems();
            }}
            className="flex-1 py-3 px-4 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-md shadow-primary/10"
          >
            Review Center
          </button>
        </div>
      </div>
    );
  }

  // ── Active Question ──
  if (started && dueItems.length > 0) {
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
            onClick={() => setStarted(false)}
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

  // ── Dashboard Mode (Quiz not active) ──
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
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-display text-foreground tracking-tight flex items-center gap-2">
            <Brain className="w-7 h-7 text-indigo-500 shrink-0" />
            Review Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
            Strengthen long-term concepts. Tracks card repetition intervals and manages scheduled memory retention.
          </p>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-border/60">
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-6 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
            activeTab === 'forecast'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Forecast & Stats
          </div>
        </button>
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-6 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
            activeTab === 'browse'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            Browse Schedules
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
            activeTab === 'history'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Review History
          </div>
        </button>
      </div>

      {/* ── Tab Content: Forecast & Stats ── */}
      {activeTab === 'forecast' && (
        <div className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status overview */}
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  {dueItems.length === 0 ? 'All Caught Up!' : `${dueItems.length} reviews due today`}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {dueItems.length === 0 
                    ? 'Congratulations! You have completed all scheduled card reviews. New items will become due as their intervals elapse.'
                    : 'These questions are scheduled to resurface today. Repetition reinforcing keeps them fresh in your memory.'
                  }
                </p>
              </div>

              {dueItems.length > 0 && (
                <button
                  onClick={() => {
                    setStarted(true);
                    questionStartTime.current = Date.now();
                  }}
                  className="py-3 px-4 rounded-xl bg-indigo-500 text-white font-bold text-xs hover:bg-indigo-600 transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1"
                >
                  Launch Daily Review Deck
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Theory Breakdown
              </h3>
              {dueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <CalendarCheck className="w-8 h-8 mb-2 opacity-40 text-emerald-500" />
                  <p className="text-xs font-semibold">No pending reviews</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {Object.values(theoryGroups).map((group, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{group.title}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                        {group.count} due
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Forecast */}
          {renderForecast()}
        </div>
      )}

      {/* ── Tab Content: Browse Schedules ── */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-secondary/30 border border-border/80 p-4 rounded-2xl">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search review questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-card border border-border focus:border-indigo-500 outline-none transition-all placeholder:text-muted-foreground/70"
              />
            </div>
            {/* Theory select dropdown */}
            <div className="relative min-w-[200px]">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedTheory}
                onChange={(e) => setSelectedTheory(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-card border border-border appearance-none focus:border-indigo-500 outline-none transition-all cursor-pointer font-medium"
              >
                <option value="">All Theories</option>
                {theoryOptions.map((title, idx) => (
                  <option key={idx} value={title}>{title}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Items count summary */}
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
            Total items tracked: {allSchedules.length}
          </div>

          {/* Schedules list */}
          {loadingSchedules ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (() => {
            const filtered = allSchedules.filter(item => {
              if (!item.questions) return false;
              const matchesSearch = item.questions.stem.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesTheory = selectedTheory === '' || item.questions.theories?.title === selectedTheory;
              return matchesSearch && matchesTheory;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground">
                  <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-35" />
                  <p className="text-xs font-semibold">No tracked items matching your criteria</p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filtered.map((item, idx) => {
                  const q = item.questions!;
                  const isExpanded = expandedStems[q.id] || false;
                  const status = getDueStatus(item.due_at);

                  return (
                    <div key={idx} className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-all flex flex-col justify-between space-y-3 shadow-sm relative">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Question Stem */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5 text-[9px] font-extrabold uppercase">
                            <span className="px-2 py-0.5 rounded bg-secondary text-foreground tracking-wider">
                              {q.theories?.title}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 tracking-wider">
                              {q.bloom_level}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
                              L{q.difficulty}
                            </span>
                          </div>

                          <div className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                            {isExpanded ? q.stem : (
                              <p className="line-clamp-2">{q.stem}</p>
                            )}
                          </div>

                          {q.stem.length > 150 && (
                            <button
                              onClick={() => toggleStem(q.id)}
                              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer mt-1"
                            >
                              {isExpanded ? (
                                <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                              ) : (
                                <>Expand Question <ChevronDown className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Due status pill */}
                        <div className={`text-[10px] font-extrabold px-3 py-1 rounded-full border self-start shrink-0 font-mono ${status.color}`}>
                          {status.label}
                        </div>
                      </div>

                      {/* SM-2 intervals state */}
                      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 border-t border-border/40 text-[10px] font-bold text-muted-foreground/80 font-mono">
                        <div className="flex items-center gap-1">
                          <span>Interval:</span>
                          <span className="text-foreground font-extrabold">{item.interval_days}d</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Repetitions:</span>
                          <span className="text-foreground font-extrabold">{item.repetitions}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Ease Factor:</span>
                          <span className="text-foreground font-extrabold">{item.ease_factor}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:ml-auto">
                          <span>Next Review:</span>
                          <span className="text-foreground font-extrabold">
                            {new Date(item.due_at).toLocaleDateString(undefined, { dateStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Tab Content: Review History ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : historyAttempts.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-2 opacity-35" />
              <p className="text-xs font-semibold">No recent review attempts found</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {historyAttempts.map((attempt, idx) => {
                const isCorrect = attempt.is_correct;
                const formattedDate = new Date(attempt.created_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                });
                const q = attempt.questions;

                return (
                  <div key={idx} className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-all flex flex-col justify-between space-y-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        {/* Domain tag */}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-secondary text-foreground tracking-wider">
                            {q?.theories?.title ?? 'Review'}
                          </span>
                          <span className="text-[10px] text-muted-foreground/75 font-medium">{formattedDate}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-foreground font-semibold leading-relaxed line-clamp-1">
                          {q?.stem}
                        </p>
                      </div>

                      {/* Correct / Incorrect pill */}
                      <div className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                        isCorrect 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isCorrect ? 'Correct (+10 XP)' : 'Incorrect (+2 XP)'}
                      </div>
                    </div>

                    {/* Meta speeds */}
                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground/70 border-t border-border/40 pt-2 font-mono">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                        <span>Speed: {(attempt.response_ms / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
