'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, Clock, Flame, Calendar, ChevronRight, ArrowRight, Target, History, BarChart3 } from 'lucide-react';
import type { ReviewScheduleWithQuestion } from '@/lib/types';

interface ForecastTabProps {
  dueItems: ReviewScheduleWithQuestion[];
  forecastData: {
    dateStr: string;
    dayName: string;
    dayLabel: string;
    count: number;
    theories: string[];
  }[];
  weakTheories: { id: string; title: string; accuracy: number; total: number }[];
  onStartPractice: () => void;
  streak: number;
  weeklyHistory: number[];
  recentDays: { dateLabel: string; count: number; xp: number }[];
  thisWeekCount: number;
  nextWeekCount: number;
}

export default function ForecastTab({
  dueItems,
  forecastData,
  weakTheories,
  onStartPractice,
  streak,
  weeklyHistory,
  recentDays,
  thisWeekCount,
  nextWeekCount
}: ForecastTabProps) {

  // Group due items by theory
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

  const estimatedTime = Math.max(1, Math.round(dueItems.length * 0.85));

  // Determine tomorrow's count from forecast data
  const tomorrowCount = forecastData[1]?.count ?? 0;

  // Day names for the weekly progress chart
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxWeeklyCount = Math.max(...weeklyHistory, 1);
  const totalXpEarnedThisWeek = recentDays.reduce((sum, d) => sum + d.xp, 0);

  return (
    <div className="space-y-6 w-full relative">
      {/* ─── ROW 1: Hero spaced review banner ─── */}
      <div className="p-6 md:p-8 rounded-3xl border border-indigo-500/10 bg-gradient-to-br from-indigo-50/50 via-blue-50/20 to-transparent dark:from-indigo-950/20 dark:via-neutral-900/10 dark:to-transparent flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
        {/* Left Side Info */}
        <div className="space-y-5 flex-1 text-left w-full">
          <div className="flex items-start gap-4">
            {/* Circular icon container */}
            <div className="relative flex items-center justify-center shrink-0 w-12 h-12 rounded-2xl bg-primary/10 text-primary">
              <div className="absolute inset-0 rounded-2xl border border-primary/20 pulse-glow-ring" />
              <Zap className="w-5 h-5 z-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-bold font-inria text-primary leading-tight">
                {dueItems.length} {dueItems.length === 1 ? 'Review Due Today' : 'Reviews Due Today'}
              </h2>
              <p className="text-xs text-muted-foreground font-serif leading-normal">
                Keep your streak alive by completing today&apos;s review.
              </p>
            </div>
          </div>

          {/* Stats sub-row */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-serif pt-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/80" />
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-wider leading-none">Estimated time</p>
                <p className="text-[11px] font-semibold text-foreground mt-0.5">{dueItems.length > 0 ? `${estimatedTime} min` : '0 min'}</p>
              </div>
            </div>
            <div className="w-[1px] h-6 bg-border/80 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-wider leading-none">Current streak</p>
                <p className="text-[11px] font-semibold text-foreground mt-0.5">{streak} {streak === 1 ? 'day' : 'days'}</p>
              </div>
            </div>
          </div>

          {/* CTA Action Button */}
          <div className="pt-2">
            <button
              onClick={onStartPractice}
              disabled={dueItems.length === 0}
              className="py-3 px-6 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/10 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              <span>Start Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side Illustration */}
        <div className="flex justify-center items-center shrink-0 w-full md:w-auto">
          <svg className="w-full max-w-[220px] h-auto drop-shadow-md" viewBox="0 0 200 160" fill="none">
            {/* Calendar Stack Back Shadow */}
            <rect x="25" y="35" width="150" height="105" rx="14" fill="#D3E0FA" className="dark:fill-indigo-950/40" />

            {/* Main Calendar Body */}
            <rect x="20" y="30" width="150" height="105" rx="14" fill="#F0F5FE" className="dark:fill-neutral-800" stroke="#CBDCFB" strokeWidth="1.5" />

            {/* Calendar Stand Bottom */}
            <path d="M40,135 L160,135" stroke="#CBDCFB" strokeWidth="3" strokeLinecap="round" />
            <path d="M168,133 L180,140" stroke="#CBDCFB" strokeWidth="1.5" />

            {/* Wire Ring Binder spirals */}
            <circle cx="45" cy="28" r="4" fill="#8FAEF7" />
            <path d="M45,18 C45,28 41,28 41,28" stroke="#8FAEF7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="75" cy="28" r="4" fill="#8FAEF7" />
            <path d="M75,18 C75,28 71,28 71,28" stroke="#8FAEF7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="105" cy="28" r="4" fill="#8FAEF7" />
            <path d="M105,18 C105,28 101,28 101,28" stroke="#8FAEF7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="135" cy="28" r="4" fill="#8FAEF7" />
            <path d="M135,18 C135,28 131,28 131,28" stroke="#8FAEF7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="165" cy="28" r="4" fill="#8FAEF7" />
            <path d="M165,18 C165,28 161,28 161,28" stroke="#8FAEF7" strokeWidth="2.5" strokeLinecap="round" />

            {/* Checked checkmarks on calendar sheet */}
            <circle cx="50" cy="85" r="9" fill="#E1EBFD" />
            <path d="M47,85 L49,87 L53,83" stroke="#264D8E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            <circle cx="95" cy="65" r="9" fill="#E1EBFD" />
            <path d="M92,65 L94,67 L98,63" stroke="#264D8E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            <circle cx="140" cy="50" r="9" fill="#E1EBFD" />
            <path d="M137,50 L139,52 L143,48" stroke="#264D8E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Incomplete day markings */}
            <circle cx="50" cy="55" r="7" fill="#EBF1FE" opacity="0.6" />
            <circle cx="95" cy="110" r="7" fill="#EBF1FE" opacity="0.6" />
            <circle cx="140" cy="90" r="7" fill="#EBF1FE" opacity="0.6" />
          </svg>
        </div>
      </div>

      {/* ─── ROW 2: Topics Needing Attention & Upcoming Reviews ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Topics Needing Attention */}
        <div className="p-6 bg-card border border-border rounded-2xl flex flex-col justify-between space-y-4 shadow-sm text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Target className="w-4 h-4 text-primary/80" />
              <h3 className="text-sm font-bold font-inria text-foreground">Topics Needing Attention</h3>
            </div>
            <p className="text-[11px] font-serif text-muted-foreground mt-0.5">Focus more on these areas to improve your mastery.</p>
          </div>

          {/* Weak Topics Lists */}
          <div className="flex-1 flex flex-col justify-center space-y-4 py-2">
            {weakTheories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground font-serif">
                <span className="text-xl mb-1 select-none">🎯</span>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider font-inria">All Metrics Strong</p>
                <p className="text-[10px] text-muted-foreground">Keep maintaining your accuracy scores above 80%!</p>
              </div>
            ) : (
              weakTheories.slice(0, 3).map((theory, idx) => {
                // Color mapping for weak progression bars
                let colorClass = 'bg-rose-500';
                let textClass = 'text-rose-500';
                let bgPill = 'bg-rose-50 hover:bg-rose-100/70 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400';
                if (theory.accuracy >= 65) {
                  colorClass = 'bg-amber-500';
                  textClass = 'text-amber-500';
                  bgPill = 'bg-amber-50 hover:bg-amber-100/70 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400';
                }

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-serif">
                      <span className="font-semibold text-foreground truncate max-w-[200px]">{theory.title}</span>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold font-mono ${textClass}`}>{theory.accuracy}%</span>
                        <Link
                          href={`/practice?theoryId=${theory.id}`}
                          className={`px-3 py-0.5 rounded-full text-[10px] font-bold font-inria transition-colors select-none ${bgPill}`}
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                    {/* Linear progress track */}
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${theory.accuracy}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-border/60">
            <Link
              href="/progress"
              className="text-[11px] font-bold font-inria text-primary hover:underline inline-flex items-center gap-1 group select-none"
            >
              <span>View All Weak Areas</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Right Column: Upcoming Reviews */}
        <div className="p-6 bg-card border border-border rounded-2xl flex flex-col justify-between space-y-4 shadow-sm text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Calendar className="w-4 h-4 text-primary/80" />
              <h3 className="text-sm font-bold font-inria text-foreground">Upcoming Reviews</h3>
            </div>
            <p className="text-[11px] font-serif text-muted-foreground mt-0.5">Here&apos;s what&apos;s coming up next.</p>
          </div>

          {/* Grid row timeline */}
          <div className="grid grid-cols-4 gap-2 py-2">
            {/* Today */}
            <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100/70 dark:bg-blue-950/10 dark:border-blue-900/20 text-center flex flex-col justify-between h-20 shadow-sm">
              <p className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Today</p>
              <p className="text-lg font-extrabold font-mono text-blue-700 dark:text-blue-300 leading-none">{dueItems.length}</p>
              <p className="text-[9px] text-blue-500/80 font-bold uppercase tracking-wider">due</p>
            </div>

            {/* Tomorrow */}
            <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100/70 dark:bg-purple-950/10 dark:border-purple-900/20 text-center flex flex-col justify-between h-20 shadow-sm">
              <p className="text-[9px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Tomorrow</p>
              <p className="text-lg font-extrabold font-mono text-purple-700 dark:text-purple-300 leading-none">{tomorrowCount}</p>
              <p className="text-[9px] text-purple-500/80 font-bold uppercase tracking-wider">due</p>
            </div>

            {/* This Week */}
            <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100/70 dark:bg-indigo-950/10 dark:border-indigo-900/20 text-center flex flex-col justify-between h-20 shadow-sm">
              <p className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">This Week</p>
              <p className="text-lg font-extrabold font-mono text-indigo-700 dark:text-indigo-300 leading-none">{thisWeekCount}</p>
              <p className="text-[9px] text-indigo-500/80 font-bold uppercase tracking-wider">due</p>
            </div>

            {/* Next Week */}
            <div className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 dark:bg-neutral-800/30 dark:border-border/60 text-center flex flex-col justify-between h-20 shadow-sm">
              <p className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Next Week</p>
              <p className="text-lg font-extrabold font-mono text-slate-600 dark:text-slate-300 leading-none">{nextWeekCount}</p>
              <p className="text-[9px] text-slate-500/80 font-bold uppercase tracking-wider">due</p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60">
            <Link
              href="/review?tab=browse"
              className="text-[11px] font-bold font-inria text-primary hover:underline inline-flex items-center gap-1 group select-none"
            >
              <span>View Full Schedule</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── ROW 3: Review Progress & Recent Review History ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Your Review Progress */}
        <div className="lg:col-span-8 p-6 bg-card border border-border rounded-2xl flex flex-col justify-between space-y-4 shadow-sm text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <BarChart3 className="w-4 h-4 text-primary/80" />
              <h3 className="text-sm font-bold font-inria text-foreground">Your Review Progress</h3>
            </div>
            <p className="text-[11px] font-serif text-muted-foreground mt-0.5">Stay consistent and watch your mastery grow.</p>
          </div>

          {/* Progress Columns and Bars */}
          <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 py-2">

            {/* Vertical column bar charts */}
            <div className="flex-1 flex justify-between items-end h-28 px-1 pb-1">
              {weeklyHistory.map((count, index) => {
                const percent = Math.max(8, Math.min(100, (count / maxWeeklyCount) * 100));
                return (
                  <div key={index} className="flex flex-col items-center justify-end h-full flex-1 gap-1.5">
                    <div
                      className="w-5 bg-primary/80 dark:bg-emerald-500/70 hover:opacity-90 rounded-t-md transition-all relative group cursor-pointer"
                      style={{ height: `${percent}%` }}
                      title={`${count} reviews`}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono shadow-md z-20">
                        {count}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold text-muted-foreground">{weekDays[index]}</span>
                  </div>
                );
              })}
            </div>

            {/* Stats block right: XP */}
            <div className="flex items-center gap-4 bg-secondary/25 border border-border/40 p-4 rounded-2xl min-w-[170px] self-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none">Total XP Earned</p>
                <p className="text-2xl font-extrabold text-foreground leading-none">{totalXpEarnedThisWeek}</p>
                <p className="text-[11px] text-muted-foreground font-serif mt-1">this week</p>
              </div>

              {/* Purple Shield Trophy SVG */}
              <div className="relative flex items-center justify-center shrink-0 w-9 h-9 select-none">
                <svg className="w-9 h-9 drop-shadow-[0_2px_8px_rgba(139,92,246,0.25)]" viewBox="0 0 100 100">
                  <g className="animate-spin-slow origin-center">
                    <polygon points="50,0 93,25 93,75 50,100 7,75 7,25" fill="#6366f1" />
                    <polygon points="50,6 87,28 87,72 50,94 13,72 13,28" fill="#818cf8" />
                    <polygon points="50,12 81,30 81,70 50,88 19,70 19,30" fill="url(#purpleGrad)" />
                  </g>
                  <path d="M50,28 L54,39 L66,39 L56,47 L60,58 L50,51 L40,58 L44,47 L34,39 L46,39 Z" fill="#ffffff" />
                  <defs>
                    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b9fc3ff" />
                      <stop offset="100%" stopColor="#264D8E" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Review History */}
        <div className="lg:col-span-4 p-6 bg-card border border-border rounded-2xl flex flex-col justify-between space-y-4 shadow-sm text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <History className="w-4 h-4 text-primary/80" />
              <h3 className="text-sm font-bold font-inria text-foreground">Recent Review History</h3>
            </div>
            <p className="text-[11px] font-serif text-muted-foreground mt-0.5">Your recent review activity.</p>
          </div>

          {/* Attempts History Lists */}
          <div className="flex-1 flex flex-col justify-center divide-y divide-border/60">
            {recentDays.length === 0 ? (
              <div className="text-center py-8 text-xs font-serif text-muted-foreground italic">
                Complete reviews to log progress.
              </div>
            ) : (
              recentDays.map((item, idx) => (
                <Link
                  href="/review?tab=history"
                  key={idx}
                  className="flex items-center justify-between py-2.5 hover:bg-secondary/20 rounded-lg px-1 transition-all group font-serif text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">{item.dateLabel}</p>
                    <p className="text-[10px] text-muted-foreground">{item.count} {item.count === 1 ? 'review' : 'reviews'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{item.xp} XP</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/80 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-border/60">
            <Link
              href="/review?tab=history"
              className="text-[11px] font-bold font-inria text-primary hover:underline inline-flex items-center gap-1 group select-none"
            >
              <span>View All History</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
