'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import type { Journey, UserProgress } from '@/lib/types';
import { ArrowLeft, Search, BookOpen, ArrowRight } from 'lucide-react';

function JourneysContent() {
  const router = useRouter();
  const { profile, loading: authLoading } = useProfile();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeyQuestionCounts, setJourneyQuestionCounts] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
        const [journeysRes, jqRes, progressRes, attemptsRes] = await Promise.all([
          supabase
            .from('journeys')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: true }),
          supabase.from('journey_questions').select('journey_id'),
          supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle(),
          supabase
            .from('attempts')
            .select('is_correct')
            .eq('user_id', profile.id)
        ]);

        if (isMounted) {
          if (journeysRes.data) setJourneys(journeysRes.data);

          if (jqRes.data) {
            const counts: Record<string, number> = {};
            jqRes.data.forEach((row) => {
              counts[row.journey_id] = (counts[row.journey_id] || 0) + 1;
            });
            setJourneyQuestionCounts(counts);
          }

          if (progressRes.data) setProgress(progressRes.data);

          if (attemptsRes.data && attemptsRes.data.length > 0) {
            const correctCount = attemptsRes.data.filter((a) => a.is_correct).length;
            setOverallAccuracy(Math.round((correctCount / attemptsRes.data.length) * 100));
          }
        }
      } catch (err) {
        console.error('[Foundations] Error fetching journeys page data:', err);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
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

  const filteredJourneys = journeys.filter((j) =>
    j.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        description="Explore structured learning pathways designed to guide you through theories step-by-step."
      />

      {/* Section Heading & Search */}
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
            <h2 className="text-lg italic font-serif text-foreground">Journeys</h2>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search journeys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 font-serif bg-card border border-border rounded-xl text-xs outline-none focus:ring-3 focus:ring-primary text-foreground placeholder:text-muted-foreground/60 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Journeys Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-32 rounded-2xl" />
            ))}
          </div>
        ) : filteredJourneys.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card">
            <BookOpen className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-semibold font-serif text-muted-foreground text-sm">
              {searchQuery ? `No journeys found matching "${searchQuery}"` : 'No journeys available right now.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredJourneys.map((journey, idx) => {
              const qCount = journeyQuestionCounts[journey.id] || 0;
              const isPlayable = qCount > 0;
              const isOpening = openingCardId === journey.id;
              const staggerClass = `stagger-${Math.min(12, idx + 1)}`;

              return (
                <div
                  key={journey.id}
                  onClick={() => handleCardClick(journey.id, `/practice?journeyId=${journey.id}`, isPlayable)}
                  className={`group premium-card p-4 flex flex-col justify-between cursor-pointer overflow-hidden transition-all duration-300 active:scale-95 hover:-translate-y-1 hover:shadow-lg ${
                    isOpening ? 'animate-card-app-open' : 'animate-fade-in'
                  } ${staggerClass}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="space-y-3 relative z-10">
                    <h3 className="text-sm font-bold font-inria text-foreground group-hover:text-primary transition-colors">{journey.title}</h3>
                  </div>

                  <div className="mt-3 pt-3 flex items-center justify-between gap-2 relative z-10 border-t border-border/60">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {qCount} {qCount === 1 ? 'Question' : 'Questions'}
                      </span>
                      {isPlayable && (
                        <span className="text-[9px] font-bold text-primary dark:text-violet-400 bg-[#DCF1FF] dark:bg-violet-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          +{qCount * 2} to +{qCount * 10} XP
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-primary group-hover:text-primary transition-colors flex items-center gap-0.5 whitespace-nowrap shrink-0">
                      <span>Start</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
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

export default function JourneysPage() {
  return (
    <Suspense fallback={<div className="w-full py-12 text-center font-serif text-muted-foreground">Loading Journeys...</div>}>
      <JourneysContent />
    </Suspense>
  );
}
