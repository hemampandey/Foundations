'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useProfile } from '@/app/components/ProfileProvider';
import {
  CheckCircle2, Clock, Zap, Star
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
  const [simQuestion, setSimQuestion] = useState<{
    stem: string;
    options: string[];
    correct: number;
  } | null>(null);

  // Tab selections
  const [activeFeatureTab, setActiveFeatureTab] = useState<'spaced' | 'ai' | 'analytics'>('spaced');

  const handleSimulateAi = () => {
    if (!simText.trim()) return;
    setSimGenerating(true);
    setSimQuestion(null);
    setTimeout(() => {
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
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden hero-grid-pattern text-foreground flex flex-col justify-between">
      
      {/* ─── STICKY HEADER NAVIGATION ─── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/ally-blue-logo.svg" 
              alt="Ally Logo" 
              width={60}
              height={28}
              className="shrink-0" 
            />
            <div className="w-[1px] h-5 bg-border/85 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl tracking-tight">
                Foundations
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-all">Features</a>
            <a href="#spaced" className="hover:text-foreground transition-all">Spaced Recall</a>
            <a href="#demo" className="hover:text-foreground transition-all">Interactive Demo</a>
            <a href="https://github.com/hemampandey/Foundations" target="_blank" rel="noreferrer" className="hover:text-foreground transition-all">Repository</a>
          </nav>

          <div className="flex items-center gap-3">
            {profileLoading ? (
              <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            ) : profile ? (
              <Link 
                href="/dashboard"
                className="py-2 px-4 rounded-full bg-primary text-primary-foreground font-bold text-xs hover:opacity-95 transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-primary/15"
              >
                <span>Dashboard</span>
              </Link>
            ) : (
              <>
                <Link 
                  href="/auth" 
                  className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 transition-all"
                >
                  Sign In
                </Link>
                <Link 
                  href="/auth"
                  className="py-2 px-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-xs hover:opacity-95 transition-all shadow-md shadow-indigo-500/15"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-12 pb-20 px-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        
        {/* Left text panel */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wider animate-scale-in">
            <span>Spaced Learning Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display leading-[1.08] tracking-tight text-foreground">
            Lock in Learning <br />
            <span className="text-gradient">Theories and Methods</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            A premium, spaced-repetition quiz platform using customized SM-2 retention algorithms to build durable, clinical decision-making mastery.
          </p>

          <div className="flex items-center gap-6 pt-4 text-xs text-muted-foreground font-semibold">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>SM-2 Memory Schedule</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>AI Question Generation</span>
            </div>
          </div>
        </div>

        {/* Right mockup panel (Interactive Quiz sandbox) */}
        <div id="demo" className="lg:col-span-6 w-full flex justify-center animate-scale-in stagger-2">
          <div className="w-full max-w-lg bg-[#0b0f19] border border-border/25 rounded-2xl shadow-2xl p-1 pb-4 relative overflow-hidden text-left">
            {/* Header window control buttons */}
            <div className="flex items-center justify-between border-b border-border/10 p-3 bg-secondary/5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-[10px] font-mono text-white/40">foundations-quiz-interactive-sandbox</span>
              <div className="w-12" />
            </div>

            {/* Simulated Quiz Frame */}
            <div className="p-4 sm:p-6 space-y-5 bg-card/10">
              <div className="flex items-center justify-between text-[9px] font-extrabold uppercase text-white/40 border-b border-border/10 pb-2.5">
                <span>Quiz Simulator</span>
                <span className="text-primary font-bold">10 XP due</span>
              </div>

              <div className="space-y-1.5">
                <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[8px] font-extrabold uppercase font-sans">CBT Domain</span>
                <h4 className="text-sm font-bold text-white leading-snug">
                  Which cognitive distortion describes filtering out positive aspects while magnifying negative details?
                </h4>
              </div>

              {/* Options list */}
              <div className="space-y-2">
                {[
                  'Personalization and emotional projection',
                  'Mental filtering and selective abstraction',
                  'Catastrophizing outcomes and predicting failure',
                  'Black-and-white thinking polarization'
                ].map((opt, idx) => {
                  let optStyle = 'border-border/10 bg-white/[0.01] hover:bg-white/[0.04] text-white/70';
                  let badgeStyle = 'bg-secondary/40 text-white/70';
                  let animClass = '';

                  if (mockSelected === idx) {
                    optStyle = 'border-primary bg-primary/10 text-primary-foreground';
                    badgeStyle = 'bg-primary text-white';
                  }

                  if (mockSubmitted) {
                    if (idx === 1) {
                      optStyle = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold';
                      badgeStyle = 'bg-emerald-500 text-white';
                      animClass = 'animate-correct-pulse';
                    } else if (mockSelected === idx) {
                      optStyle = 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-bold';
                      badgeStyle = 'bg-rose-500 text-white';
                      animClass = 'animate-shake';
                    } else {
                      optStyle = 'border-border/5 bg-transparent text-white/20 opacity-30';
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
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-emerald-400 animate-float-xp">
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
                    className="w-full py-2.5 rounded-full border border-border/20 bg-white/5 text-white font-bold text-xs hover:bg-white/10 transition-all cursor-pointer"
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
      <section id="features" className="py-20 px-6 bg-secondary/20 border-y border-border/40">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight text-foreground">
              Designed for Cognitive Permanence
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Foundations wraps complex cognitive science workflows into a simple, beautiful study habit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Recall engine card */}
            <div className="glass-card premium-card hover-glow-sweep p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center text-lg select-none">
                  🧠
                </div>
                <h3 className="text-sm font-bold">SM-2 Spaced Algorithm</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Questions are scheduled precisely using difficulty curves to trigger just before your memory decays, maximizing retention.
                </p>
              </div>
              <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                Learn Spaced Recall →
              </span>
            </div>

            {/* AI Diagnostics card */}
            <div className="glass-card premium-card hover-glow-sweep p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="h-10 w-10 bg-violet-500/10 text-violet-500 rounded-xl flex items-center justify-center text-lg select-none">
                  ⚡
                </div>
                <h3 className="text-sm font-bold">Generative MCQ Creation</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Transform reading notes, case excerpts, or counseling theories into high-fidelity diagnostic assessments automatically.
                </p>
              </div>
              <span className="text-[10px] font-bold text-violet-500 flex items-center gap-0.5">
                Explore Generator →
              </span>
            </div>

            {/* Analytics card */}
            <div className="glass-card premium-card hover-glow-sweep p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center text-lg select-none">
                  🎯
                </div>
                <h3 className="text-sm font-bold">Clinical Study Timelines</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Track accuracy curves, daily streak streaks, experience milestones (XP), and forecast upcoming study intervals.
                </p>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                View Performance Metrics →
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE FEATURES SHOWCASE (Render.com Style) ─── */}
      <section className="py-20 px-6 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-foreground">
            See the Platform in Action
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Choose a feature tab to preview interactive animations demonstrating product workflows.
          </p>
        </div>

        {/* Dynamic Tab triggers */}
        <div className="flex p-1 bg-secondary rounded-full max-w-md mx-auto border border-border/60">
          <button
            onClick={() => setActiveFeatureTab('spaced')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeFeatureTab === 'spaced' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Spaced Recall
          </button>
          <button
            onClick={() => setActiveFeatureTab('ai')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeFeatureTab === 'ai' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            AI Generator
          </button>
          <button
            onClick={() => setActiveFeatureTab('analytics')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeFeatureTab === 'analytics' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Milestone Metrics
          </button>
        </div>

        {/* Interactive Feature Video/Mock Box */}
        <div className="border border-border/80 bg-card rounded-2xl shadow-xl overflow-hidden min-h-[360px] flex flex-col justify-between p-6 md:p-10 relative">
          {activeFeatureTab === 'spaced' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 animate-scale-in text-left">
              <div className="lg:col-span-5 space-y-4">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 text-[9px] font-extrabold uppercase">Adaptive Decay</span>
                <h3 className="text-xl font-bold font-display leading-snug">SM-2 Spaced Recall Engine</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instead of passive cramming, Foundations tests recall intervals. Questions are rescheduled dynamically based on accuracy and speed.
                </p>
                <div className="space-y-2 pt-2 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span>Interval increments on correct answers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Immediate resets on incorrect choices</span>
                  </div>
                </div>
              </div>

              {/* Visual simulation of calendar schedules */}
              <div className="lg:col-span-7 bg-secondary/40 border border-border/60 rounded-xl p-5 space-y-4">
                <h4 className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">Simulated Rescheduling Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 bg-card border border-border/80 rounded-xl text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold">Incorrect</span>
                      <span className="truncate max-w-[150px] sm:max-w-xs font-medium">Transference and defense mechanisms...</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full shrink-0">Due in 1 Day (Reset)</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-card border border-border/80 rounded-xl text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">Correct</span>
                      <span className="truncate max-w-[150px] sm:max-w-xs font-medium">Gestalt contact boundaries...</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">Due in 8 Days (+7d)</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-card border border-border/80 rounded-xl text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">Mastered</span>
                      <span className="truncate max-w-[150px] sm:max-w-xs font-medium">Cognitive triad and beliefs...</span>
                    </div>
                    <span className="text-[10px] font-bold text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full shrink-0">Due in 24 Days (+16d)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'ai' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 animate-scale-in text-left">
              <div className="lg:col-span-5 space-y-4">
                <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 text-[9px] font-extrabold uppercase">Diagnostic Assessment</span>
                <h3 className="text-xl font-bold font-display leading-snug">Generative AI Diagnostics Sandbox</h3>
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
              <div className="lg:col-span-7 bg-[#0b0f19] border border-border/25 rounded-xl p-5 space-y-4 text-white">
                <h4 className="text-[10px] font-extrabold uppercase text-white/40 tracking-wider">AI Question Generator Input</h4>
                <div className="space-y-3">
                  <textarea
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs outline-none text-white/90 placeholder-white/20 resize-none h-16"
                    placeholder="Enter notes or passage..."
                  />
                  <button
                    onClick={handleSimulateAi}
                    disabled={simGenerating}
                    className="w-full py-2 px-4 rounded-xl bg-violet-600 text-white font-bold text-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-violet-500/10"
                  >
                    {simGenerating ? 'AI is processing...' : 'Simulate MCQ Generation'}
                  </button>

                  {/* Render simulated output */}
                  {simQuestion && (
                    <div className="border border-white/10 bg-white/[0.02] rounded-xl p-4 space-y-2.5 animate-scale-in text-xs">
                      <span className="text-[8px] font-extrabold text-violet-400 uppercase tracking-wider">AI Generated Assessment</span>
                      <p className="font-bold text-white/90">{simQuestion.stem}</p>
                      <div className="space-y-1">
                        {simQuestion.options.map((opt: string, i: number) => (
                          <div key={i} className={`p-2 rounded text-[10px] border flex items-center gap-2 ${i === simQuestion.correct ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-white/5 bg-transparent text-white/55'}`}>
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 animate-scale-in text-left">
              <div className="lg:col-span-5 space-y-4">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-extrabold uppercase">Habit Loops</span>
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
              <div className="lg:col-span-7 bg-[#0b0f19] border border-border/25 rounded-xl p-5 space-y-4 text-white flex flex-col justify-between min-h-[220px]">
                <h4 className="text-[10px] font-extrabold uppercase text-white/40 tracking-wider">Simulated Progress Deck</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center text-lg select-none">
                      🔥
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/45 uppercase tracking-wider">Streak</p>
                      <p className="text-base font-bold text-white">12 Days Active</p>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center text-lg select-none">
                      🎯
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/45 uppercase tracking-wider">Accuracy</p>
                      <p className="text-base font-bold text-emerald-400">84% Correct</p>
                    </div>
                  </div>
                </div>

                {/* Level status progress bar */}
                <div className="space-y-1 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>Level 4 (Learner)</span>
                    <span className="text-[10px] text-white/50 font-mono">420/500 XP</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10 mt-1">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-[84%] animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── ENTERPRISE FOOTER ─── */}
      <footer className="border-t border-border/40 bg-secondary/15 py-12 px-6 md:px-12">
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-8 text-left text-xs font-semibold text-muted-foreground">
          <div className="space-y-3.5 col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <Image 
                src="/ally-blue-logo.svg" 
                alt="Ally Logo" 
                width={50}
                height={24}
                className="shrink-0" 
              />
              <div className="w-[1px] h-4 bg-border/80 shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-xs tracking-tight text-foreground">
                  Foundations
                </span>
              </div>
            </Link>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80 max-w-[200px]">
              Adaptive spaced-repetition testing framework built for counseling theory and diagnostics mastery.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider">Product</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="#features" className="hover:text-foreground transition-all">Recall Sandbox</a></li>
              <li><a href="#spaced" className="hover:text-foreground transition-all">Spaced Repetition</a></li>
              <li><Link href="/auth" className="hover:text-foreground transition-all">Authentication</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider">Resources</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="https://github.com/hemampandey/Foundations" target="_blank" rel="noreferrer" className="hover:text-foreground transition-all">GitHub Repo</a></li>
              <li><Link href="/review" className="hover:text-foreground transition-all">Spaced Review</Link></li>
              <li><Link href="/progress" className="hover:text-foreground transition-all">Milestones</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider">Citations</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="https://en.wikipedia.org/wiki/SuperMemo" target="_blank" rel="noreferrer" className="hover:text-foreground transition-all">SM-2 Algorithm</a></li>
              <li><a href="https://cbt.org" target="_blank" rel="noreferrer" className="hover:text-foreground transition-all">CBT Frameworks</a></li>
            </ul>
          </div>
        </div>

        <div className="w-full border-t border-border/40 mt-8 pt-6 flex justify-between items-center text-[10px] text-muted-foreground font-semibold font-sans">
          <span>© {new Date().getFullYear()} Foundations. All rights reserved.</span>
          <span className="font-serif italic text-sm text-foreground/45 select-none">Ally</span>
        </div>
      </footer>
    </div>
  );
}
