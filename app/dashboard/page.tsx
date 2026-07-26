'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import type { Theory, AttemptWithQuestion, UserProgress, Journey } from '@/lib/types';
import {
  ArrowRight,
  ChevronUp
} from 'lucide-react';

function CardSkeleton() {
  return (
    <div className="overflow-hidden border border-border rounded-2xl bg-card">
      <div className="skeleton h-48 w-full rounded-none" />
      <div className="p-6 space-y-4">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
        <div className="skeleton h-10 w-full mt-4 rounded-full" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useProfile();

  // DB data
  const [theories, setTheories] = useState<Theory[]>([]);
  const [theoryQuestionCounts, setTheoryQuestionCounts] = useState<Record<string, number>>({});
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeyQuestionCounts, setJourneyQuestionCounts] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<AttemptWithQuestion[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [reviewDueCount, setReviewDueCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [openingCardId, setOpeningCardId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!profile) return;

    setLoadingData(true);
    try {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const [
        theoriesRes,
        questionsRes,
        journeysRes,
        jqRes,
        attemptsRes,
        progressRes,
        reviewRes
      ] = await Promise.all([
        supabase
          .from('theories')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('questions')
          .select('id, theory_id')
          .eq('status', 'approved'),
        supabase
          .from('journeys')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('journey_questions')
          .select('journey_id'),
        supabase
          .from('attempts')
          .select('*, question:questions(stem, theories(id, title))')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase
          .from('review_schedule')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .lte('due_at', endOfToday.toISOString())
      ]);

      if (theoriesRes.error) throw theoriesRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (journeysRes.error) throw journeysRes.error;
      if (jqRes.error) throw jqRes.error;
      if (attemptsRes.error) throw attemptsRes.error;
      if (progressRes.error) throw progressRes.error;

      // Theories
      setTheories(theoriesRes.data ?? []);

      // Question counts
      const counts: Record<string, number> = {};
      questionsRes.data?.forEach((q) => {
        counts[q.theory_id] = (counts[q.theory_id] || 0) + 1;
      });
      setTheoryQuestionCounts(counts);

      // Journeys
      setJourneys(journeysRes.data ?? []);

      // Journey question counts
      const jCounts: Record<string, number> = {};
      jqRes.data?.forEach((jq) => {
        jCounts[jq.journey_id] = (jCounts[jq.journey_id] || 0) + 1;
      });
      setJourneyQuestionCounts(jCounts);

      // Attempts
      setAttempts((attemptsRes.data as unknown[] as AttemptWithQuestion[]) ?? []);

      // User Progress
      setProgress(progressRes.data as UserProgress | null);

      // Review Due Count
      setReviewDueCount(reviewRes.count ?? 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Foundations] Error loading dashboard data:', message);
    } finally {
      setLoadingData(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        fetchDashboardData();
      });
    }
  }, [profile, fetchDashboardData]);

  // Calculate per-theory attempts count and accuracy
  const theoryStats = (() => {
    const stats: Record<string, { total: number; correct: number; accuracy: number }> = {};
    attempts.forEach((att) => {
      const theory = att.question?.theories;
      if (theory && theory.id) {
        if (!stats[theory.id]) {
          stats[theory.id] = { total: 0, correct: 0, accuracy: 0 };
        }
        stats[theory.id].total += 1;
        if (att.is_correct) {
          stats[theory.id].correct += 1;
        }
      }
    });
    Object.keys(stats).forEach((id) => {
      stats[id].accuracy = Math.round((stats[id].correct / stats[id].total) * 100);
    });
    return stats;
  })();



  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  // Auth loading or redirecting
  if (authLoading || !profile) {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 gap-4">
          <div className="space-y-2">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-3 w-64" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-28 rounded-full" />
            <div className="skeleton h-9 w-28 rounded-full" />
          </div>
        </div>

        {/* Hero banner skeleton */}
        <div className="rounded-3xl border border-border/40 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1 space-y-3 w-full">
            <div className="skeleton h-5 w-56" />
            <div className="skeleton h-3 w-80" />
            <div className="skeleton h-10 w-36 mt-4" />
          </div>
          <div className="skeleton h-24 w-24 rounded-2xl shrink-0" />
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton h-6 w-36" />
            <div className="rounded-2xl border border-border/40 p-5 space-y-3">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-2/3" />
            </div>
            <div className="rounded-2xl border border-border/40 p-5 space-y-3">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-3 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="skeleton h-6 w-32" />
            <div className="rounded-2xl border border-border/40 p-5 space-y-4">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Stats ──
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  const xp = progress?.xp ?? 0;
  const streak = progress?.streak_days ?? 0;

  const estMinutes = Math.max(1, Math.round(reviewDueCount * 1.2));
  const xpReward = reviewDueCount * 10;

  const hasRightColumn = reviewDueCount > 0;

  const handleCardClick = (id: string, targetUrl: string, isPlayable: boolean) => {
    if (!isPlayable || openingCardId) return;
    setOpeningCardId(id);
    setTimeout(() => {
      router.push(targetUrl);
    }, 320);
  };

  return (
    <div className="w-full space-y-5 animate-fade-in relative">
      {/* App Launch Screen Overlay */}
      {openingCardId && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40 animate-app-launch-backdrop pointer-events-none" />
      )}

      <StatsHeader
        role={profile?.role}
        streak={streak}
        accuracy={accuracy}
        xp={xp}
        description="Pick up where you left off and continue your learning journey."
      />

      {/* ─── Two Column Layout ─── */}
      <div className={hasRightColumn ? "grid grid-cols-1 lg:grid-cols-4 gap-6" : "w-full"}>

        {/* Left Column (3/4 width) - Journeys and Theories */}
        <div className={hasRightColumn ? "lg:col-span-3 space-y-6" : "w-full space-y-6"}>

          {/* CURATED JOURNEYS */}
          {loadingData ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-6">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : journeys.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h2 className="text-lg italic font-serif text-foreground flex items-center gap-2">Journeys</h2>
                <Link href="/journeys" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 transition-colors">
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {journeys.map((journey, idx) => {
                  const qCount = journeyQuestionCounts[journey.id] || 0;
                  const isPlayable = qCount > 0;
                  const isOpening = openingCardId === journey.id;
                  const staggerClass = `stagger-${Math.min(12, idx + 1)}`;

                  return (
                    <div
                      key={journey.id}
                      onClick={() => handleCardClick(journey.id, `/practice?journeyId=${journey.id}`, isPlayable)}
                      className={`group premium-card p-4 flex flex-col justify-between cursor-pointer overflow-hidden transition-all duration-700 active:scale-95 hover:-translate-y-1 hover:shadow-lg ${
                        isOpening ? 'animate-card-app-open' : 'animate-fade-in'
                      } ${staggerClass}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                      <div className="space-y-3 relative z-10">
                        <h3 className="text-sm font-bold font-inria text-foreground group-hover:text-primary transition-colors">{journey.title}</h3>
                      </div>

                      <div className="mt-3 pt-3 flex items-center justify-between gap-2 relative z-10 border-t border-border/60">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full whitespace-nowrap">{qCount} {qCount === 1 ? 'Question' : 'Questions'}</span>
                          {isPlayable && (
                            <span className="text-[9px] font-bold text-primary dark:text-violet-400 bg-[#DCF1FF] dark:bg-violet-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">+{qCount * 2} to +{qCount * 10} XP</span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-primary group-hover:text-primary transition-colors flex items-center gap-0.5 whitespace-nowrap shrink-0">Start →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* PRACTICE BY DOMAIN */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h2 className="text-lg italic font-serif text-foreground flex items-center gap-2">Practice by Theory</h2>
              <Link href="/theories" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 transition-colors">
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loadingData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : theories.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-card">
                <p className="font-semibold font-serif text-muted-foreground text-sm">No theories available right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {theories.map((theory, idx) => {
                  const qCount = theoryQuestionCounts[theory.id] || 0;
                  const isPlayable = qCount > 0;
                  const isOpening = openingCardId === theory.id;
                  const stats = theoryStats[theory.id];
                  const attemptsCount = stats?.total || 0;
                  const accuracyVal = stats?.accuracy || 0;
                  const staggerClass = `stagger-${Math.min(12, journeys.length + idx + 1)}`;

                  let glowClass = 'group-hover:border-primary/40 from-primary/5';
                  let pillClass = 'bg-primary/5 text-primary border-primary/10';
                  const domainLower = theory.domain.toLowerCase();
                  if (domainLower.includes('cbt') || domainLower.includes('cognit')) {
                    glowClass = 'group-hover:border-indigo-500/40 from-indigo-500/5';
                    pillClass = 'bg-indigo-500/5 text-indigo-600 border-indigo-500/10';
                  } else if (domainLower.includes('human') || domainLower.includes('gestalt')) {
                    glowClass = 'group-hover:border-emerald-500/40 from-emerald-500/5';
                    pillClass = 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10';
                  } else if (domainLower.includes('psycho')) {
                    glowClass = 'group-hover:border-rose-500/40 from-rose-500/5';
                    pillClass = 'bg-rose-500/5 text-rose-600 border-rose-500/10';
                  }

                  return (
                    <div
                      key={theory.id}
                      onClick={() => handleCardClick(theory.id, `/practice?theoryId=${theory.id}`, isPlayable)}
                      className={`group premium-card p-4 flex flex-col justify-between cursor-pointer overflow-hidden transition-all duration-700 active:scale-95 hover:-translate-y-1 hover:shadow-lg ${
                        isOpening ? 'animate-card-app-open' : 'animate-fade-in'
                      } ${staggerClass}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${glowClass} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                      <div className="space-y-3 relative z-10 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase border ${pillClass}`}>{theory.domain}</span>
                            {attemptsCount > 0 && (
                              <span className="text-[10px] font-serif italic font-bold text-muted-foreground">{attemptsCount} attempts • {accuracyVal}% acc</span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold font-inria text-foreground group-hover:text-primary transition-colors">{theory.title}</h3>
                          <p className="text-[11px] font-inria text-muted-foreground line-clamp-3">{theory.body_text}</p>
                        </div>

                        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground">{qCount} {qCount === 1 ? 'Question' : 'Questions'} available</span>
                            {isPlayable && (
                              <span className="text-[10px] font-bold text-primary dark:text-violet-400 bg-[#DCF1FF] dark:bg-violet-500/10 px-2 py-0.5 rounded-full">+{qCount * 2} to +{qCount * 10} XP</span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">Practice Now →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {hasRightColumn && (
          <div className="space-y-3">
            {/* Due for Review Card */}
            {reviewDueCount > 0 && (
              <div 
                onClick={() => handleCardClick('due-for-review', '/review', true)} 
                className={`p-4 border border-[#e0e7ff] bg-[#f5f8ff] rounded-[1rem] shadow-[0_8px_30px_rgb(0,0,0,0.01)] relative overflow-hidden group hover:border-[#cbd5e1] hover:shadow-md transition-all space-y-4 cursor-pointer ${
                  openingCardId === 'due-for-review' ? 'animate-card-app-open' : 'animate-scale-in'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 flex items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <span className="text-xl font-extrabold text-primary">{reviewDueCount}</span>
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-primary font-serif">Questions Due for Review</span>
                  </div>
                  <ChevronUp className="w-4 h-4 text-primary font-bold" />
                </div>

                {/* Compact Content */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="space-y-2">
                    <p className="text-[11px] font-serif text-slate-500">Strengthen your due concepts</p>
                    <button 
                      className="py-2.5 px-4 rounded-sm bg-[#264D8E] font-serif dark:bg-primary/70 text-white font-extrabold hover:bg-[#1f3e73] active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/10 whitespace-nowrap"
                    >
                      <span>Start Review</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Vertical Divider */}
                  <div className="border-l border-slate-200 h-10 shrink-0" />

                  {/* Right metrics */}
                  <div className="space-y-2 shrink-0">
                    <div>
                      <p className="text-xs font-extrabold text-slate-800 whitespace-nowrap">≈ {estMinutes} min</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Est. time</p>
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-primary font-serif whitespace-nowrap">+{xpReward} XP</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Reward</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
