'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import type { Theory, AttemptWithQuestion, UserProgress, Journey } from '@/lib/types';
import {
  BookOpen,
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
  const [loadingData, setLoadingData] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!profile) return;

    setLoadingData(true);
    try {
      // Fetch published theories
      const { data: theoryData, error: tErr } = await supabase
        .from('theories')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: true });

      if (tErr) throw tErr;
      setTheories(theoryData ?? []);

      // Fetch approved question counts per theory
      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .select('id, theory_id')
        .eq('status', 'approved');

      if (qErr) throw qErr;

      const counts: Record<string, number> = {};
      qData?.forEach((q) => {
        counts[q.theory_id] = (counts[q.theory_id] || 0) + 1;
      });
      setTheoryQuestionCounts(counts);

      // Fetch published journeys
      const { data: journeyData, error: jErr } = await supabase
        .from('journeys')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: true });

      if (jErr) throw jErr;
      setJourneys(journeyData ?? []);

      // Fetch journey question counts
      const { data: jqData, error: jqErr } = await supabase
        .from('journey_questions')
        .select('journey_id');

      if (jqErr) throw jqErr;

      const jCounts: Record<string, number> = {};
      jqData?.forEach((jq) => {
        jCounts[jq.journey_id] = (jCounts[jq.journey_id] || 0) + 1;
      });
      setJourneyQuestionCounts(jCounts);

      // Fetch user's attempts with joined question & theory details (capped for performance)
      const { data: attData, error: aErr } = await supabase
        .from('attempts')
        .select('*, question:questions(stem, theories(id, title))')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (aErr) throw aErr;
      setAttempts((attData as unknown[] as AttemptWithQuestion[]) ?? []);

      // Fetch user progress (XP / level / streak)
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      setProgress(progressData as UserProgress | null);
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

  const dailySuggestion = (() => {
    if (theories.length === 0) return null;

    // Find theories with 0 attempts first
    const unattempted = theories.filter(t => !theoryStats[t.id] || theoryStats[t.id].total === 0);
    if (unattempted.length > 0) {
      return {
        theory: unattempted[0],
        reason: "You haven't practiced this domain yet! Start a session to build baseline mastery.",
      };
    }

    // Otherwise, find the one with the lowest accuracy
    const statsArray = theories
      .map(t => ({ theory: t, stats: theoryStats[t.id] }))
      .filter(item => item.stats)
      .sort((a, b) => a.stats.accuracy - b.stats.accuracy);

    if (statsArray.length > 0) {
      return {
        theory: statsArray[0].theory,
        reason: `Your current accuracy is ${statsArray[0].stats.accuracy}%. Focus here to raise your mastery level!`,
      };
    }

    return {
      theory: theories[0],
      reason: 'Perfect baseline cleared! Keep practicing to secure your clinical streak.',
    };
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
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Stats ──
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  const xp = progress?.xp ?? 0;
  const streak = progress?.streak_days ?? 0;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 animate-fade-in">
      <StatsHeader
        role={profile?.role}
        streak={streak}
        accuracy={accuracy}
        xp={xp}
        description="Pick up where you left off and continue your learning journey."
      />

      {/* ─── Two Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (2/3 width) - Journeys and Theories */}
        <div className="lg:col-span-2 space-y-8">

          {/* CURATED JOURNEYS */}
          {loadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : journeys.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg italic font-serif text-foreground flex items-center gap-2 border-b border-border pb-2">
                Journeys
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {journeys.map((journey) => {
                  const qCount = journeyQuestionCounts[journey.id] || 0;
                  const isPlayable = qCount > 0;

                  return (
                    <div
                      key={journey.id}
                      onClick={() => isPlayable && router.push(`/practice?journeyId=${journey.id}`)}
                      className={`group border border-border bg-card hover:border-primary/40 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden`}
                    >
                      {/* Interactive category background glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-start">
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                            {journey.title}
                          </h3>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                            {qCount} {qCount === 1 ? 'Question' : 'Questions'}
                          </span>
                          {isPlayable && (
                            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/5 dark:bg-violet-500/10 px-2 py-0.5 rounded-full">
                              +{qCount * 2} to +{qCount * 10} XP
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
                          Start Pathway →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* PRACTICE BY DOMAIN */}
          <div className="space-y-4">
            <h2 className="text-lg italic font-serif text-foreground flex items-center gap-2 border-b border-border pb-2">
              Practice by Theory
            </h2>
            {loadingData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : theories.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-card">
                <BookOpen className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground text-xs">No theories available right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {theories.map((theory) => {
                  const qCount = theoryQuestionCounts[theory.id] || 0;
                  const isPlayable = qCount > 0;
                  const stats = theoryStats[theory.id];
                  const attemptsCount = stats?.total || 0;
                  const accuracyVal = stats?.accuracy || 0;

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
                      onClick={() => isPlayable && router.push(`/practice?theoryId=${theory.id}`)}
                      className={`group border border-border bg-card rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${glowClass} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                      <div className="space-y-3.5 relative z-10 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${pillClass}`}>
                              {theory.domain}
                            </span>
                            {attemptsCount > 0 && (
                              <span className="text-[9px] font-bold text-muted-foreground">
                                {attemptsCount} attempts • {accuracyVal}% acc
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-foreground group-hover:text-foreground/90 transition-colors leading-snug">
                            {theory.title}
                          </h3>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                            {theory.body_text}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {qCount} {qCount === 1 ? 'Question' : 'Questions'} available
                            </span>
                            {isPlayable && (
                              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/5 dark:bg-violet-500/10 px-2 py-0.5 rounded-full">
                                +{qCount * 2} to +{qCount * 10} XP
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Practice Now →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>)}
          </div>
        </div>

        <div className="space-y-6">
          {/* Dynamic Suggestion Card */}
          {dailySuggestion && (
            <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Today&rsquo;s Challenge
                </h3>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground">
                  {dailySuggestion.theory.title}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {dailySuggestion.reason}
                </p>
              </div>

              <button
                onClick={() => router.push(`/practice?theoryId=${dailySuggestion.theory.id}`)}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm shadow-amber-500/10">
                Accept Challenge</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
