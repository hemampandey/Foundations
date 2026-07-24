'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter as useNextRouter, useSearchParams as useNextSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import type { Theory, QuestionWithTheory, Journey } from '@/lib/types';
import {
  BookOpen, HelpCircle, Layers, Compass, ShieldAlert,
} from 'lucide-react';

import ManageTheories from './components/ManageTheories';
import ManageMCQs from './components/ManageMCQs';
import ReviewQueue from './components/ReviewQueue';
import ManageJourneys from './components/ManageJourneys';

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="w-full space-y-6 animate-fade-in">
        <div className="border-b border-border/80 pb-6">
          <div className="skeleton h-8 w-44 mb-2" />
          <div className="skeleton h-3 w-72" />
        </div>
        <div className="skeleton h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 skeleton h-80 rounded-2xl" />
          <div className="lg:col-span-7 skeleton h-80 rounded-2xl" />
        </div>
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

  const { profile, loading: authLoading } = useProfile();

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

  const loadDbData = useCallback(async (silent: boolean | unknown = false) => {
    const isSilent = silent === true;
    if (!isSilent) setLoadingLists(true);
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
      if (!isSilent) setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') {
      Promise.resolve().then(() => {
        loadDbData();
      });
    }
  }, [profile, loadDbData]);

  // ─── Guards ───

  if (authLoading) {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        <div className="border-b border-border/80 pb-6">
          <div className="skeleton h-8 w-44 mb-2" />
          <div className="skeleton h-3 w-72" />
        </div>
        <div className="skeleton h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 skeleton h-80 rounded-2xl" />
          <div className="lg:col-span-7 skeleton h-80 rounded-2xl" />
        </div>
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
          className="mt-4 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer">Go to Sign In</button>
      </div>
    );
  }

  if (profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto p-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 animate-fade-in">
        <ShieldAlert className="w-12 h-12 text-amber-500 mb-4 animate-pulse" />
        <h3 className="text-xl font-bold font-display text-amber-600">Admin Authorization Required</h3>
        <p className="text-muted-foreground mt-2">
          Your current role is <strong className="uppercase">{profile.role}</strong>. Only
          administrators can use this interface.</p>
      </div>
    );
  }

  const approvedQuestions = questions.filter((q) => q.status === 'approved');
  const draftQuestions = questions.filter((q) => q.status === 'draft');

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Top Banner with compact stats inline */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border/80 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-extrabold font-inria text-foreground">Theory & MCQ Manager</h1>
          <div className="px-2.5 py-0.5 text-[9px] font-extrabold text-primary bg-primary/10 border border-primary/20 rounded-full uppercase tracking-wider select-none shrink-0">Admin Console</div>
        </div>

        <div className="hidden md:flex flex-wrap items-center gap-4 sm:gap-6 bg-card border border-border/85 rounded-2xl p-2.5 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.015)] shrink-0 relative overflow-hidden backdrop-blur-sm glass-card">
          {/* Total Theories */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 select-none">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-sm font-serif font-bold text-foreground leading-tight">{theories.length}</div>
              <p className="text-[9px] text-muted-foreground/80 font-serif font-bold uppercase ">Total Theories</p>
            </div>
          </div>

          <div className="border-l border-border/80 h-7" />

          {/* Approved MCQs */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 select-none"><HelpCircle className="w-3.5 h-3.5" /></div>
            <div>
              <div className="text-sm font-serif font-bold text-foreground leading-tight">{approvedQuestions.length}</div>
              <p className="text-[9px] text-muted-foreground/80 font-serif font-bold uppercase">Approved MCQs</p>
            </div>
          </div>

          <div className="border-l border-border/80 h-7" />

          {/* Review Queue */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 select-none"><Layers className="w-3.5 h-3.5" /></div>
            <div>
              <div className="text-sm font-serif font-bold text-foreground leading-tight">{draftQuestions.length} draft</div>
              <p className="text-[9px] font-serif text-muted-foreground/80 font-bold uppercase">Review Queue</p>
            </div>
          </div>

          <div className="border-l border-border/80 h-7" />

          {/* Active Journeys */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 select-none"><Compass className="w-3.5 h-3.5" /></div>
            <div>
              <div className="text-sm font-serif font-bold text-foreground leading-tight">{journeys.length}</div>
              <p className="text-[9px] font-serif text-muted-foreground/80 font-bold uppercase tracking-wider">Active Journeys</p>
            </div>
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
          />)}

        {activeTab === 'questions' && (
          <ManageMCQs
            theories={theories}
            questions={questions}
            setQuestions={setQuestions}
            loadingLists={loadingLists}
            loadDbData={loadDbData}
          />)}

        {activeTab === 'review' && (
          <ReviewQueue
            questions={questions}
            setQuestions={setQuestions}
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
          />)}
      </div>
    </div>);}
