'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useProfile } from '@/app/components/ProfileProvider';
import {
  CheckCircle2, Clock, Zap, Star, CloudUpload, Sparkles, ShieldCheck, BookOpen, Calendar, Trophy, ArrowRight
} from 'lucide-react';

export default function Home() {
  const { profile, loading: profileLoading } = useProfile();

  // Interactive mock quiz state
  const [mockSelected, setMockSelected] = useState<number | null>(null);
  const [mockSubmitted, setMockSubmitted] = useState(false);
  const [mockXpEarned, setMockXpEarned] = useState(false);

  // AI generator simulator state
  const [simText, setSimText] = useState('Carl Rogers proposed client-centered therapy, emphasizing unconditional positive regard and empathy.');
  const [simGenerating, setSimGenerating] = useState(false);
  const [aiStep, setAiStep] = useState(0); // 0: idle, 1: reading, 2: generating, 3: formatting, 4: complete
  const [simQuestion, setSimQuestion] = useState<{
    stem: string;
    options: string[];
    correct: number;
  } | null>(null);

  // Tab selections
  const [activeFeatureTab, setActiveFeatureTab] = useState<'spaced' | 'ai' | 'analytics'>('spaced');

  // Spaced timeline cycle step
  const [spacedActiveStep, setSpacedActiveStep] = useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSpacedActiveStep((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // XP Floater animation cycle
  const [xpFloater, setXpFloater] = useState(false);
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (activeFeatureTab === 'analytics') {
        setXpFloater(true);
        const timer = setTimeout(() => setXpFloater(false), 1200);
        return () => clearTimeout(timer);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeFeatureTab]);

  const handleSimulateAi = () => {
    if (!simText.trim()) return;
    setSimGenerating(true);
    setSimQuestion(null);
    setAiStep(1);

    // Step 1 -> 2
    setTimeout(() => {
      setAiStep(2);
      // Step 2 -> 3
      setTimeout(() => {
        setAiStep(3);
        // Step 3 -> 4 (complete)
        setTimeout(() => {
          setAiStep(4);
          setSimGenerating(false);
          setSimQuestion({
            stem: 'According to Carl Rogers, what core condition is key for constructive personality change?',
            options: [
              'Systematic desensitization and reinforcement schedules',
              'Unconditional positive regard and empathetic understanding',
              'Analyzing unconscious projection transference patterns',
              'Directive coaching and behavioral correction models'
            ],
            correct: 1
          });
        }, 800);
      }, 800);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-ally relative overflow-x-hidden hero-grid-pattern text-foreground flex flex-col justify-between">

      {/* ─── STICKY HEADER NAVIGATION ─── */}
      <header className="sticky top-0 z-50 w-full py-4 border-border/40 bg-ally backdrop-blur-md">
        <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/ally-white-logo.svg"
              alt="Ally Logo"
              width={60}
              height={28}
              className="shrink-0"
            />
            <div className="w-[1px] h-5 bg-border/85 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="font-sans font-semibold text-xl text-secondary tracking-tight">Foundations</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {profileLoading ? (
              <div className="skeleton h-8 w-24 rounded-sm" />
            ) : profile ? (
              <Link
                href="/dashboard"
                className="py-2 px-4 rounded-sm bg-background text-ally font-bold text-xs hover:opacity-95 transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-primary/15"
              >
                <span>Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="text-xs font-bold text-ally bg-background rounded-sm hover:text-foreground px-3 py-2 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth"
                  className="py-2 px-4 rounded-sm bg-background text-ally font-bold text-xs transition-all shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── AMBIENT GLOW BLOBS ─── */}
      <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-blob-drift-1 z-0" />
      <div className="absolute top-[25%] right-[5%] w-80 h-80 rounded-full bg-purple-500/10 blur-[130px] pointer-events-none animate-blob-drift-2 z-0" />

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-12 pb-20 px-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-20 items-center flex-1 z-10 ">

        {/* Left text panel */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-sans leading-[1.08] tracking-tight text-secondary">
            <span className="reveal-stagger-word" style={{ animationDelay: '0.25s' }}>Master</span>{' '}
            <span className="reveal-stagger-word" style={{ animationDelay: '0.35s' }}>Theories</span>{' '}
            <span className="reveal-stagger-word" style={{ animationDelay: '0.4s' }}>That</span> <br />
            <span className="text-[#dcf1ff] text-8xl dark:text-indigo-300 relative inline-block underline decoration-[#77b0cc]/60 decoration-2 underline-offset-8 reveal-stagger-word" style={{ animationDelay: '0.45s' }}>
              Actually Stick.
            </span>
          </h1>

          <p className="text-sm font-serif italic sm:text-base text-secondary/85 leading-relaxed max-w-xl animate-fade-in stagger-2">
            Foundations turns your study material into adaptive quizzes that build durable knowledge using SM-2 spaced repetition.
          </p>
        </div>

        {/* Right mockup panel (Interactive Quiz sandbox) */}
        <div id="demo" className="lg:col-span-6 w-full flex justify-center animate-scale-in stagger-2 animate-floating">
          <div className="w-full max-w-lg bg-card border border-border/60 rounded-2xl shadow-2xl p-1 pb-4 relative overflow-hidden text-left">
            {/* Header window control buttons */}
            <div className="flex items-center justify-between border-b border-border/60 p-3 bg-secondary/30">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60">foundations-quiz</span>
              <div className="w-12" />
            </div>

            {/* Simulated Quiz Frame */}
            <div className="p-4 sm:p-6 space-y-5 bg-card">
              <div className="flex items-center justify-between text-[9px] font-extrabold uppercase text-muted-foreground border-b border-border/60 pb-2.5">
                <span>Quiz Simulation</span>
                <span className="text-primary font-bold">10 XP due</span>
              </div>

              <div className="space-y-1.5">
                <span className="px-2 py-1 rounded-xl bg-primary/80 text-secondary text-[8px] font-extrabold uppercase font-serif">Foundations</span>
                <h4 className="text-sm pt-1.5 font-bold text-foreground leading-snug">Why does Foundations schedule some questions to appear again after a few days?</h4>
              </div>

              {/* Options list */}
              <div className="space-y-2">
                {[
                  'To increase the total number of questions',
                  'To reinforce memory before concepts are forgotten',
                  'To make quizzes longer',
                  'To improve loading speed'
                ].map((opt, idx) => {
                  let optStyle = 'border-border bg-secondary/15 hover:bg-secondary/35 text-foreground';
                  let badgeStyle = 'bg-secondary text-muted-foreground';
                  let animClass = '';

                  if (mockSelected === idx) {
                    optStyle = 'border-primary bg-primary/5 text-primary font-medium';
                    badgeStyle = 'bg-primary text-white';
                  }

                  if (mockSubmitted) {
                    if (idx === 1) {
                      optStyle = 'border-emerald-500 bg-emerald-500/5 text-emerald-600 font-bold';
                      badgeStyle = 'bg-emerald-500 text-white';
                      animClass = 'animate-correct-pulse';
                    } else if (mockSelected === idx) {
                      optStyle = 'border-rose-500 bg-rose-500/5 text-rose-600 font-bold';
                      badgeStyle = 'bg-rose-500 text-white';
                      animClass = 'animate-shake';
                    } else {
                      optStyle = 'border-border/60 bg-transparent text-muted-foreground/35 opacity-40';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={mockSubmitted}
                      onClick={() => setMockSelected(idx)}
                      className={`relative w-full flex items-center gap-3 p-3 text-left border rounded-xl text-xs transition-all duration-200 cursor-pointer ${optStyle} ${animClass}`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold font-mono ${badgeStyle}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                      {mockSubmitted && idx === 1 && mockXpEarned && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-emerald-500 animate-float-xp">
                          +10 XP
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Submit CTA */}
              <div className="flex gap-2.5 pt-2">
                {!mockSubmitted ? (
                  <button
                    onClick={() => {
                      if (mockSelected === null) return;
                      setMockSubmitted(true);
                      setMockXpEarned(mockSelected === 1);
                    }}
                    disabled={mockSelected === null}
                    className="w-full py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-xs hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-primary/10"
                  >
                    Submit Choice
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMockSelected(null);
                      setMockSubmitted(false);
                      setMockXpEarned(false);
                    }}
                    className="w-full py-2.5 rounded-full border border-border bg-secondary/30 text-foreground font-bold text-xs hover:bg-secondary/60 transition-all cursor-pointer"
                  >
                    Reset Quiz Simulator
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VALUE PROPOSITION CARDS ─── */}
      <section id="features" className="py-24 px-6 bg-secondary dark:from-neutral-950 dark:via-neutral-900/80 dark:to-background relative overflow-hidden text-center">

        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          {/* Header Block */}
          <div className="space-y-3 pt-18">
            <h2 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white leading-tight">
              Learn <span className="text-[#264D8E] dark:text-blue-400">Smarter.</span> Remember <span className="text-[#5B5FC7] dark:text-indigo-400">Longer.</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-inria font-medium pt-1">
              Foundations transforms your study material into quizzes and personalized review sessions, helping you build lasting knowledge instead of cramming.
            </p>
          </div>

          {/* 3 Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-10xl mx-auto pt-8">
            {/* Card 1: SM-2 Spaced Algorithm */}
            <div className="group bg-[#FAF6EB] dark:bg-neutral-900/90 backdrop-blur-sm border hover:border-primary/80 ring-6 hover:ring-8 dark:border-pink-950/40 rounded-3xl p-7 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden">
              <div className="space-y-4 items-center">
                <h3 className="text-md font-sans font-bold text-primary dark:text-white font-display">
                  SM-2 Spaced Algorithm
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-inria font-medium">
                  Questions are scheduled precisely using difficulty curves to trigger just before your memory decays, maximizing retention.
                </p>
              </div>
            </div>

            {/* Card 2: Generative Assessment Creation */}
            <div className="group bg-[#FAF6EB] dark:bg-neutral-900/90 backdrop-blur-sm border hover:border-primary/60 ring-6 hover:ring-8 dark:border-purple-950/40 rounded-3xl p-7 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden">
              <div className="space-y-4">
                <h3 className="text-md font-sans font-bold text-primary dark:text-white font-display">
                  Generative Assessment Creation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-inria font-medium">
                  Transform reading notes, case excerpts, or counseling theories into high-fidelity assessments automatically.
                </p>
              </div>
            </div>

            {/* Card 3: Study Timelines */}
            <div className="group bg-[#FAF6EB] dark:bg-neutral-900/90 backdrop-blur-sm border hover:border-primary/80 ring-6 hover:ring-8 dark:border-emerald-950/40 rounded-3xl p-7 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden">
              <div className="space-y-4">
                <h3 className="text-md font-sans font-bold text-primary dark:text-white font-display">
                  Study Timelines
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-inria font-medium">
                  Track accuracy curves, daily streak streaks, experience milestones (XP), and forecast upcoming study intervals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE FEATURES SHOWCASE ─── */}
      <section className="w-full py-20 px-6 bg-secondary border-y border-border/10">
        <div className="max-w-7xl mx-auto w-full space-y-12">
          <div className="text-center pb-5space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-inria tracking-tight text-primary">See the Platform in Action</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">Choose a feature tab to preview the user experience.</p>
          </div>

          {/* Dynamic Tab triggers */}
          <div className="flex p-1 bg-secondary rounded-sm max-w-md mx-auto border border-border/60">
            <button
              onClick={() => setActiveFeatureTab('spaced')}
              className={`flex-1 py-2 text-xs font-bold rounded-sm transition-all cursor-pointer ${activeFeatureTab === 'spaced' ? 'bg-primary text-secondary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>Spaced Recall</button>
            <button
              onClick={() => setActiveFeatureTab('ai')}
              className={`flex-1 py-2 text-xs font-bold rounded-sm transition-all cursor-pointer ${activeFeatureTab === 'ai' ? 'bg-primary text-secondary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>AI Generator</button>
            <button
              onClick={() => setActiveFeatureTab('analytics')}
              className={`flex-1 py-2 text-xs font-bold rounded-sm transition-all cursor-pointer ${activeFeatureTab === 'analytics' ? 'bg-primary text-secondary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>Milestone Metrics</button>
          </div>

          {/* Interactive Feature Video/Mock Box */}
          <div className="border border-border/80 bg-[#FAF6EB] rounded-2xl shadow-xl overflow-hidden min-h-[360px] flex flex-col justify-between p-6 md:p-10 relative z-10">
            {/* Dynamic background glow shift */}
            <div className={`absolute inset-0 transition-all duration-700 pointer-events-none opacity-[0.07] blur-[80px] z-0 ${activeFeatureTab === 'spaced' ? 'bg-indigo-500' : activeFeatureTab === 'ai' ? 'bg-violet-500' : 'bg-emerald-500'
              }`} />

            {activeFeatureTab === 'spaced' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 animate-scale-in text-left relative z-10">
                <div className="lg:col-span-5 space-y-4">
                  <h3 className="text-xl font-bold font-display leading-snug">Learning That Adapts to You</h3>
                  <p className="text-xs text-primary leading-relaxed">
                    Foundations automatically schedules review sessions based on your performance, helping you spend less time reviewing what you already know and more time strengthening what you don&apos;t.
                  </p>
                  <div className="space-y-2 pt-2 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Correct answers are reviewed less frequently.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>Difficult concepts return sooner for extra practice.</span>
                    </div>
                  </div>
                </div>

                {/* Visual simulation of calendar schedules */}
                <div className="lg:col-span-7 bg-secondary border border-border/60 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-serif font-extrabold text-primary">Study Scheduling</h4>
                  </div>

                  <div className="space-y-3">
                    <div className={`flex items-center justify-between p-2.5 bg-card border rounded-xl text-xs font-semibold transition-all duration-300 ${spacedActiveStep === 0 ? 'border-rose-500 scale-[1.01] shadow-sm' : 'border-border/80 opacity-55'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded font-serif bg-rose-500/10 text-rose-500 text-[10px] font-bold">Incorrect</span>
                        <span className="truncate max-w-[150px] sm:max-w-xs font-medium">Transference and defense mechanisms...</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full shrink-0">Due in 1 Day (Reset)</span>
                    </div>

                    <div className={`flex items-center justify-between p-2.5 bg-card border rounded-xl text-xs font-semibold transition-all duration-300 ${spacedActiveStep === 1 ? 'border-emerald-500 scale-[1.01] shadow-sm' : 'border-border/80 opacity-55'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded font-serif bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">Correct</span>
                        <span className="truncate max-w-[150px] sm:max-w-xs font-medium">Gestalt contact boundaries...</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">Due in 8 Days (+7d)</span>
                    </div>

                    <div className={`flex items-center justify-between p-2.5 bg-card border rounded-xl text-xs font-semibold transition-all duration-300 ${spacedActiveStep === 2 ? 'border-violet-500 scale-[1.01] shadow-sm' : 'border-border/80 opacity-55'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded font-serif bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">Mastered</span>
                        <span className="truncate max-w-[150px] sm:max-w-xs font-medium">Cognitive triad and beliefs...</span>
                      </div>
                      <span className="text-[10px] font-bold text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full shrink-0">Due in 24 Days (+16d)</span>
                    </div>
                  </div>

                  {/* Rescheduling Track Line */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[8px] font-mono text-muted-foreground/75 px-1 font-bold">
                      <span>DAY 1</span>
                      <span>DAY 4</span>
                      <span>DAY 8</span>
                      <span>DAY 16</span>
                      <span>DAY 24</span>
                    </div>
                    <div className="h-1 w-full bg-border rounded-full relative">
                      {/* Tick markers */}
                      <div className="absolute left-[0%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-border" />
                      <div className="absolute left-[25%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-border" />
                      <div className="absolute left-[50%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-border" />
                      <div className="absolute left-[75%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-border" />
                      <div className="absolute left-[100%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-border" />

                      {/* Active target cursor dot */}
                      <div className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full transition-all duration-700 ease-out shadow-lg flex items-center justify-center -ml-1.5 ${spacedActiveStep === 0 ? 'bg-rose-500 shadow-rose-500/30' : spacedActiveStep === 1 ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-violet-500 shadow-violet-500/30'
                        }`} style={{ left: spacedActiveStep === 0 ? '0%' : spacedActiveStep === 1 ? '50%' : '100%' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 'ai' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 animate-scale-in text-left relative z-10">
                <div className="lg:col-span-5 space-y-4">
                  <h3 className="text-xl font-bold font-display leading-snug">Generative AI MCQ Creator</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Generate multiple choice questions from any reading passage, PDF material, or conceptual descriptions.
                  </p>
                  <div className="space-y-2 pt-2 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-500" />
                      <span>Configure Bloom taxonomy levels</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-500" />
                      <span>Generates explanations and citations</span>
                    </div>
                  </div>
                </div>

                {/* Live simulator wrapper */}
                <div className="lg:col-span-7 bg-card border border-border/60 rounded-xl p-5 space-y-4 text-foreground shadow-md">
                  <h4 className="text-xs font-bold font-serif text-primary">AI Question Generator Input</h4>
                  <div className="space-y-3">
                    <textarea
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      className="w-full bg-secondary/15 border border-border font-inria rounded-xl p-3 text-xs outline-none text-foreground placeholder-muted-foreground/60 resize-none h-16"
                      placeholder="Enter notes or passage..."
                    />
                    <button
                      onClick={handleSimulateAi}
                      disabled={simGenerating}
                      className="w-full py-2 px-4 rounded-xl bg-primary text-secondary font-serif font-bold text-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-violet-500/10"
                    >
                      {simGenerating ? 'Generating...' : 'Generate'}
                    </button>

                    {/* Render simulated process console or final output */}
                    {simGenerating && aiStep < 4 && (
                      <div className="space-y-2.5 font-mono text-[9px] text-primary text-left bg-primary/5 p-4 rounded-xl border border-primary/20 animate-fade-in font-semibold">
                        <p className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
                          <span className="truncate">
                            {aiStep === 1 ? '> Analyzing passage context keywords...' :
                              aiStep === 2 ? '> Extracting taxonomy levels and stems...' :
                                '> Generating correct and distractor answers...'}
                          </span>
                        </p>
                        <div className="w-full bg-primary/10 h-1 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: aiStep === 1 ? '33%' : aiStep === 2 ? '66%' : '95%' }}
                          />
                        </div>
                      </div>
                    )}

                    {!simGenerating && simQuestion && (
                      <div className="border border-border bg-secondary/15 rounded-xl p-4 space-y-2.5 animate-scale-in text-xs">
                        <p className="font-bold text-foreground">{simQuestion.stem}</p>
                        <div className="space-y-1">
                          {simQuestion.options.map((opt: string, i: number) => (
                            <div key={i} className={`p-2 rounded text-[10px] border flex items-center gap-2 ${i === simQuestion.correct ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 font-semibold' : 'border-border/60 bg-transparent text-muted-foreground'}`}>
                              <span className="font-mono font-bold">{String.fromCharCode(65 + i)}</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 'analytics' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 animate-scale-in text-left relative z-10">
                <div className="lg:col-span-5 space-y-4">
                  <h3 className="text-xl font-bold font-display leading-snug">Streaks & XP Gamification</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Stay consistent with XP leveling systems, daily streak chimes, accuracy records, and comprehensive progress scorecards.
                  </p>
                  <div className="space-y-2 pt-2 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-emerald-500 fill-current" />
                      <span>XP-based level thresholds</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Accuracy score distributions</span>
                    </div>
                  </div>
                </div>

                {/* Progress visual mock */}
                <div className="lg:col-span-7 bg-card border border-border/60 rounded-xl p-5 space-y-4 text-foreground flex flex-col justify-between min-h-[220px] shadow-md">
                  <h4 className="text-xs font-serif font-bold text-primary tracking-wider">Analytics</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/15 border border-border/60 p-4 rounded-xl flex items-center gap-3">
                      <Image
                        src="/icons/bonfire.svg"
                        alt="Bonfire Icon"
                        width={30}
                        height={30}
                        className="w-7 h-7 "
                      />
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Streak</p>
                        <p className="text-base font-bold text-foreground">12 Days Active</p>
                      </div>
                    </div>

                    <div className="bg-secondary/15 border border-border/60 p-4 rounded-xl flex items-center gap-3">
                      <Image
                        src="/icons/accuracy.svg"
                        alt="Accuracy Icon"
                        width={30}
                        height={30}
                        className="w-7 h-7"
                      />
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Accuracy</p>
                        <p className="text-base font-bold text-emerald-500">84% Correct</p>
                      </div>
                    </div>
                  </div>

                  {/* Level status progress bar */}
                  <div className="space-y-1 bg-secondary/15 border border-border/60 p-4 rounded-xl relative overflow-hidden">
                    {xpFloater && (
                      <span className="absolute right-4 top-2 text-[14px] font-extrabold text-primary-500 animate-float-xp select-none">
                        +15 XP
                      </span>
                    )}
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Level 4 (Learner)</span>
                      <span className="text-[10px] text-muted-foreground font-mono">420/500 XP</span>
                    </div>
                    <div className="w-full h-2.5 bg-secondary border border-border rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-slate-400/50 via-slate-500/50 to-primary transition-all duration-300 ease-out w-[84%] " />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── FROM THEORY TO MASTERY WORKFLOW & CTA ─── */}
      <section className="w-full py-24 px-6 bg-secondary relative overflow-hidden text-center border-b border-border/20">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Header */}
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-5xl font-extrabold font-inria text-primary tracking-tight">From Theory to Mastery</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-inria max-w-md mx-auto">A complete ecosystem for admins and learners.</p>
          </div>

          {/* 6 Step Horizontal Process Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-4 items-start relative max-w-7xl mx-auto">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center space-y-3 group relative">
              <div className="w-14 h-14 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-md shadow-sky-500/10 transition-transform group-hover:scale-110">
                <CloudUpload className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">1. Upload Theory</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[170px]">
                Admins upload notes, PDFs or documents.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center space-y-3 group relative">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-md shadow-purple-500/10 transition-transform group-hover:scale-110">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">2. Generate Questions</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[170px]">
                AI creates high-quality MCQs in seconds.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center space-y-3 group relative">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md shadow-emerald-500/10 transition-transform group-hover:scale-110">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">3. Review & Approve</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[170px]">
                Admins review, edit and approve the questions.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center space-y-3 group relative">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-md shadow-blue-500/10 transition-transform group-hover:scale-110">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">4. Learner Practices</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[170px]">
                Learners attempt questions in adaptive sessions.
              </p>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center text-center space-y-3 group relative">
              <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-md shadow-orange-500/10 transition-transform group-hover:scale-110">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">5. SM-2 Schedules</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[170px]">
                Smart algorithm plans optimal review times.
              </p>
            </div>

            {/* Step 6 */}
            <div className="flex flex-col items-center text-center space-y-3 group relative">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/10 transition-transform group-hover:scale-110">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">6. Mastery Achieved</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[170px]">
                Long-term retention and true understanding.
              </p>
            </div>
          </div>

          {/* CTA Banner Card */}
          <div className="max-w-6xl mx-auto rounded-3xl p-8 sm:p-10 bg-gradient-to-r from-[#173063] via-[#244985] to-[#1A377B] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 text-left border border-white/10">
            {/* Ambient inner glow decoration */}
            <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-10 -top-10 w-60 h-60 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-5 relative z-10">
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight">Ready to transform the way you learn?</h3>
                <p className="text-xs sm:text-sm text-blue-100/80 font-inria">
                  Join learners who are building lasting knowledge with Foundations.
                </p>
              </div>
            </div>

            <div className="relative z-10 w-full md:w-auto">
              <Link
                href="/auth"
                className="w-full md:w-auto py-3.5 px-8 rounded-full bg-white text-[#173063] font-bold text-xs sm:text-sm hover:bg-blue-50 active:scale-95 transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ENTERPRISE FOOTER ─── */}
      <footer className="border-t border-border/40 bg-ally py-20 px-6 md:px-12">
        <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-8 text-left text-xs font-semibold text-muted-foreground">
          <div className="space-y-3.5 col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/ally-white-logo.svg"
                alt="Ally Logo"
                width={50}
                height={24}
                className="shrink-0"
              />
              <div className="w-[1px] h-4 bg-border/80 shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-lg tracking-tight text-secondary">
                  Foundations
                </span>
              </div>
            </Link>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-secondary tracking-wider">Resources</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="https://github.com/hemampandey/Foundations" target="_blank" rel="noreferrer" className="hover:text-foreground transition-all text-white">GitHub Repo</a></li>
              <li><Link href="/review" className="hover:text-foreground transition-all text-white">Spaced Review</Link></li>
              <li><Link href="/progress" className="hover:text-foreground transition-all text-white">Milestones</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-secondary tracking-wider">Citations</h4>
            <ul className="space-y-2 font-medium text-white">
              <li><a href="https://en.wikipedia.org/wiki/SuperMemo" target="_blank" rel="noreferrer" className="hover:text-foreground transition-all">SM-2 Algorithm</a></li>
            </ul>
          </div>
        </div>

        <div className="w-full border-t border-border/40 mt-8 pt-6 flex justify-between items-center text-[10px] text-secondary font-semibold font-sans">
          <span>© {new Date().getFullYear()} Foundations. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
