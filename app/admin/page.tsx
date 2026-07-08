'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter as useNextRouter, useSearchParams as useNextSearchParams } from 'next/navigation';
import { supabase, getCurrentProfile } from '@/lib/supabase';
import type { Theory, Profile, QuestionWithTheory, Journey } from '@/lib/types';
import {
  BookOpen, HelpCircle, Layers, Compass, ShieldAlert,
} from 'lucide-react';

// Import modular tab components
import ManageTheories from './components/ManageTheories';
import ManageMCQs from './components/ManageMCQs';
import ReviewQueue from './components/ReviewQueue';
import ManageJourneys from './components/ManageJourneys';

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <AdminPageContent />
    </Suspense>
  );
}

function AdminPageContent() {
  const router = useNextRouter();
  const searchParams = useNextSearchParams();
  const tabParam = searchParams.get('tab');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // DB lists
  const [theories, setTheories] = useState<Theory[]>([]);
  const [questions, setQuestions] = useState<QuestionWithTheory[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Active tab
  const [activeTab, setActiveTab] = useState<'theories' | 'questions' | 'review' | 'journeys'>('theories');

  useEffect(() => {
    if (tabParam === 'theories' || tabParam === 'questions' || tabParam === 'review' || tabParam === 'journeys') {
      Promise.resolve().then(() => {
        setActiveTab(tabParam);
      });
    }
  }, [tabParam]);

  const loadDbData = useCallback(async () => {
    setLoadingLists(true);
    try {
      const { data: theoryData, error: tErr } = await supabase
        .from('theories')
        .select('*')
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;
      setTheories((theoryData as Theory[]) ?? []);

      const { data: questionData, error: qErr } = await supabase
        .from('questions')
        .select('*, theories(title)')
        .order('created_at', { ascending: false });

      if (qErr) throw qErr;
      setQuestions((questionData as QuestionWithTheory[]) ?? []);

      const { data: journeyData, error: jErr } = await supabase
        .from('journeys')
        .select('*')
        .order('created_at', { ascending: false });

      if (jErr) throw jErr;
      setJourneys((journeyData as Journey[]) ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Foundations] Error loading admin lists:', message);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  const isFirstLoad = useRef(true);
  const fetchProfileAndData = useCallback(async () => {
    if (isFirstLoad.current) {
      setAuthLoading(true);
    }

    const p = await getCurrentProfile();
    setProfile(p);

    if (isFirstLoad.current) {
      setAuthLoading(false);
      isFirstLoad.current = false;
    }

    if (p?.role === 'admin') {
      await loadDbData();
    }
  }, [loadDbData]);

  useEffect(() => {
    (async () => {
      if (isFirstLoad.current) {
        setAuthLoading(true);
      }
      const p = await getCurrentProfile();
      setProfile(p);
      if (isFirstLoad.current) {
        setAuthLoading(false);
        isFirstLoad.current = false;
      }

      if (p?.role === 'admin') {
        await loadDbData();
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchProfileAndData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Guards ───

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto animate-fade-in">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4 animate-pulse-glow" />
        <h3 className="text-xl font-bold font-display">Access Denied</h3>
        <p className="text-muted-foreground mt-2">You must be logged in to access the Admin Panel.</p>
        <button
          onClick={() => router.push('/auth')}
          className="mt-4 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  if (profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto p-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 animate-fade-in">
        <ShieldAlert className="w-12 h-12 text-amber-500 mb-4 animate-pulse" />
        <h3 className="text-xl font-bold font-display text-amber-600">
          Admin Authorization Required
        </h3>
        <p className="text-muted-foreground mt-2">
          Your current role is <strong className="uppercase">{profile.role}</strong>. Only
          administrators can use this interface.
        </p>
      </div>
    );
  }

  const approvedQuestions = questions.filter((q) => q.status === 'approved');
  const draftQuestions = questions.filter((q) => q.status === 'draft');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <span>Admin Console</span>
          </div>
          <h1 className="text-3xl font-bold font-display mt-1 text-primary">
            Theory &amp; MCQ Manager
          </h1>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Theories */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Theories
            </p>
            <h4 className="text-lg font-bold text-foreground mt-0.5">{theories.length}</h4>
          </div>
        </div>

        {/* Questions */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 text-violet-500 rounded-xl">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Approved MCQs
            </p>
            <h4 className="text-lg font-bold text-foreground mt-0.5">{approvedQuestions.length}</h4>
          </div>
        </div>

        {/* Review Queue */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-3">
          <div className={`p-2 rounded-xl ${draftQuestions.length > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Review Queue
            </p>
            <h4 className="text-lg font-bold text-foreground mt-0.5">{draftQuestions.length} draft</h4>
          </div>
        </div>

        {/* Journeys */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Active Journeys
            </p>
            <h4 className="text-lg font-bold text-foreground mt-0.5">{journeys.length} active</h4>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {activeTab === 'theories' && (
          <ManageTheories
            theories={theories}
            loadingLists={loadingLists}
            loadDbData={loadDbData}
          />
        )}

        {activeTab === 'questions' && (
          <ManageMCQs
            theories={theories}
            questions={questions}
            loadingLists={loadingLists}
            loadDbData={loadDbData}
          />
        )}

        {activeTab === 'review' && (
          <ReviewQueue
            questions={questions}
            loadingLists={loadingLists}
            loadDbData={loadDbData}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'journeys' && (
          <ManageJourneys
            journeys={journeys}
            questions={questions}
            loadingLists={loadingLists}
            loadDbData={loadDbData}
          />
        )}
      </div>
    </div>
  );
}
