'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import type { Theory, UserProgress } from '@/lib/types';
import { ArrowLeft, Search, BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react';

function TheoriesContent() {
  const router = useRouter();
  const { profile, loading: authLoading } = useProfile();
  const [theories, setTheories] = useState<Theory[]>([]);
  const [theoryQuestionCounts, setTheoryQuestionCounts] = useState<Record<string, number>>({});
  const [theoryStats, setTheoryStats] = useState<Record<string, { total: number; correct: number; accuracy: number }>>({});
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [openingCardId, setOpeningCardId] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  useEffect(() => {
    if (authLoading || !profile) return;
    let isMounted = true;

    async function loadData() {
      if (!profile) return;
      try {
        const [theoriesRes, questionsRes, progressRes, attemptsRes] = await Promise.all([
          supabase
            .from('theories')
            .select('*')
            .eq('status', 'published')
            .order('domain', { ascending: true }),
          supabase.from('questions').select('theory_id'),
          supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle(),
          supabase
            .from('attempts')
            .select('is_correct, question:questions(theory_id)')
            .eq('user_id', profile.id)
        ]);

        if (isMounted) {
          if (theoriesRes.data) setTheories(theoriesRes.data);

          if (questionsRes.data) {
            const counts: Record<string, number> = {};
            questionsRes.data.forEach((q) => {
              counts[q.theory_id] = (counts[q.theory_id] || 0) + 1;
            });
            setTheoryQuestionCounts(counts);
          }

          if (progressRes.data) setProgress(progressRes.data);

          if (attemptsRes.data) {
            const totalAtts = attemptsRes.data.length;
            if (totalAtts > 0) {
              const correctCount = attemptsRes.data.filter((a) => a.is_correct).length;
              setOverallAccuracy(Math.round((correctCount / totalAtts) * 100));
            }

            const statsMap: Record<string, { total: number; correct: number; accuracy: number }> = {};
            (attemptsRes.data as unknown as { is_correct: boolean; question: { theory_id: string } | null }[]).forEach((att) => {
              const thId = att.question?.theory_id;
              if (thId) {
                if (!statsMap[thId]) {
                  statsMap[thId] = { total: 0, correct: 0, accuracy: 0 };
                }
                statsMap[thId].total += 1;
                if (att.is_correct) statsMap[thId].correct += 1;
              }
            });

            Object.keys(statsMap).forEach((thId) => {
              const s = statsMap[thId];
              s.accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            });
            setTheoryStats(statsMap);
          }
        }
      } catch (err) {
        console.error('[Foundations] Error fetching theories page data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [authLoading, profile]);

  if (authLoading || !profile) {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        <div className="skeleton h-12 w-64 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  const handleCardClick = (id: string, targetUrl: string, isPlayable: boolean) => {
    if (!isPlayable || openingCardId) return;
    setOpeningCardId(id);
    setTimeout(() => {
      router.push(targetUrl);
    }, 320);
  };

  const domains = ['All', ...Array.from(new Set(theories.map((t) => t.domain))).filter(Boolean)];

  const filteredTheories = theories.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.body_text && t.body_text.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDomain = selectedDomain === 'All' || t.domain === selectedDomain;
    return matchesSearch && matchesDomain;
  });

  return (
    <div className="w-full space-y-5 animate-fade-in relative">
      {/* App Launch Screen Overlay */}
      {openingCardId && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40 animate-app-launch-backdrop pointer-events-none" />
      )}

      {/* Top Header Banner */}
      <StatsHeader
        role={profile?.role as 'admin' | 'learner'}
        streak={progress?.streak_days || 0}
        accuracy={overallAccuracy}
        xp={progress?.xp || 0}
        description="Select any theory domain to initiate targeted practice sessions and build durable knowledge."
      />

      {/* Section Heading & Filters */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <h2 className="text-lg italic font-serif text-foreground">Practice by Theory</h2>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search theories or domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground/60 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Domain Filter Pills */}
        {domains.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {domains.map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedDomain === dom
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>
        )}

        {/* Theories Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : filteredTheories.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card">
            <BookOpen className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-semibold font-serif text-muted-foreground text-sm">
              {searchQuery || selectedDomain !== 'All'
                ? 'No theories match your selected filters.'
                : 'No theories published yet.'}
            </p>
            {(searchQuery || selectedDomain !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDomain('All');
                }}
                className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Reset Search Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredTheories.map((theory, idx) => {
              const qCount = theoryQuestionCounts[theory.id] || 0;
              const isPlayable = qCount > 0;
              const isOpening = openingCardId === theory.id;
              const stats = theoryStats[theory.id];
              const attemptsCount = stats?.total || 0;
              const accuracyVal = stats?.accuracy || 0;
              const staggerClass = `stagger-${Math.min(12, idx + 1)}`;

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
                  className={`group premium-card p-4 flex flex-col justify-between cursor-pointer overflow-hidden transition-all duration-300 active:scale-95 hover:-translate-y-1 hover:shadow-lg ${
                    isOpening ? 'animate-card-app-open' : 'animate-fade-in'
                  } ${staggerClass}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${glowClass} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                  <div className="space-y-3 relative z-10 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase border ${pillClass}`}>
                          {theory.domain}
                        </span>
                        {attemptsCount > 0 && (
                          <span className="text-[10px] font-serif italic text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>{attemptsCount} attempts • {accuracyVal}% acc</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold font-inria text-foreground group-hover:text-primary transition-colors">
                        {theory.title}
                      </h3>
                      {theory.body_text && (
                        <p className="text-xs font-serif text-muted-foreground line-clamp-2 leading-relaxed">
                          {theory.body_text}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {qCount} {qCount === 1 ? 'Question' : 'Questions'} available
                        </span>
                        {isPlayable && (
                          <span className="text-[9px] font-bold text-primary dark:text-violet-400 bg-[#DCF1FF] dark:bg-violet-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                            +{qCount * 2} to +{qCount * 10} XP
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-bold text-primary group-hover:text-primary transition-colors flex items-center gap-0.5 whitespace-nowrap shrink-0">
                        <span>Practice Now</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TheoriesPage() {
  return (
    <Suspense fallback={<div className="w-full py-12 text-center font-serif text-muted-foreground">Loading Theories...</div>}>
      <TheoriesContent />
    </Suspense>
  );
}
