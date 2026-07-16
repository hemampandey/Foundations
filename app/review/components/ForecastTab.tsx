'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Zap, ChevronRight } from 'lucide-react';
import type { ReviewScheduleWithQuestion } from '@/lib/types';

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

interface ForecastTabProps {
  dueItems: ReviewScheduleWithQuestion[];
  forecastData: {
    dateStr: string;
    dayName: string;
    dayLabel: string;
    count: number;
    theories: string[];
  }[];
  overdueData: {
    count: number;
    theories: string[];
  };
  weakTheories: { id: string; title: string; accuracy: number; total: number }[];
  allForecastSchedules: ForecastScheduleItem[];
  onStartPractice: () => void;
}

export default function ForecastTab({
  dueItems,
  forecastData,
  overdueData,
  weakTheories,
  allForecastSchedules,
  onStartPractice
}: ForecastTabProps) {
  const [selectedForecastDay, setSelectedForecastDay] = useState<SelectedDayDetails | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ left: string; right?: string; top: string } | null>(null);

  const handleForecastCardClick = (
    e: React.MouseEvent<HTMLDivElement>,
    title: string,
    items: SelectedForecastItem[]
  ) => {
    const target = e.currentTarget;
    const parent = target.parentElement;
    if (!parent) return;

    const leftOffset = target.offsetLeft;
    const topOffset = target.offsetTop + target.offsetHeight + 8;
    const containerWidth = parent.offsetWidth || 800;

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

  const maxDayCount = Math.max(...forecastData.map(d => d.count), 1);

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

  return (
    <div className="space-y-6 w-full relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card: AI Diagnostic Insights */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-xs font-inria font-bold text-primary uppercase tracking-wider text-left">Areas to Target</h3>
            <p className="text-xs font-inria text-muted-foreground text-left">Theories below 80% accuracy based on your study attempts.</p>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3 py-1">
            {weakTheories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground">
                <span className="text-xl mb-1 select-none">🎯</span>
                <p className="text-xs font-inria font-bold uppercase tracking-wider text-emerald-500">All Metrics Strong</p>
                <p className="text-xs font-inria text-muted-foreground mt-0.5">Keep maintaining your scores above 80%!</p>
              </div>
            ) : (
              weakTheories.map((theory, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/35 border border-border/50 text-left">
                  <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-foreground truncate">{theory.title}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Accuracy: <span className="text-rose-500 font-bold">{theory.accuracy}%</span> ({theory.total} {theory.total === 1 ? 'attempt' : 'attempts'})
                    </p>
                  </div>
                  <Link
                    href={`/practice?theoryId=${theory.id}`}
                    className="py-1 px-3 rounded-lg bg-primary text-white font-serif text-xs font-bold hover:bg-primary/85 transition-all shrink-0 select-none shadow-sm shadow-primary/10">Retry</Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle Card: Completed Celebration or Launcher */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between min-h-[160px] space-y-4 shadow-sm">
          {dueItems.length === 0 ? (
            <>
              <div className="flex items-start gap-4 text-left">
                <div className="relative flex items-center justify-center shrink-0 w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <div className="absolute inset-0 rounded-2xl border border-emerald-500/20 pulse-glow-ring" />
                  <CalendarCheck className="w-6 h-6 z-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-inria font-bold text-primary leading-none">All Caught Up!</h2>
                  <p className="text-xs font-inria text-muted-foreground leading-relaxed">Congratulations! You have completed all scheduled card reviews. New items will become due as their intervals elapse.</p>
                </div>
              </div>


            </>
          ) : (
            <>
              <div className="flex items-start gap-4 text-left">
                <div className="relative flex items-center justify-center shrink-0 w-12 h-12 rounded-2xl bg-primary/10 text-primary">
                  <div className="absolute inset-0 rounded-2xl border border-primary/20 pulse-glow-ring" />
                  <Zap className="w-6 h-6 z-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-inria font-bold text-primary leading-none">
                    {dueItems.length} {dueItems.length === 1 ? 'Review Due' : 'Reviews Due'}
                  </h2>
                  <p className="text-xs font-inria text-muted-foreground leading-relaxed">Ready to reinforce foundational knowledge. Let&apos;s start your review deck.</p>
                </div>
              </div>

              <button
                onClick={onStartPractice}
                className="w-full py-2.5 rounded-xl bg-primary text-white font-serif text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20 text-center flex items-center justify-center gap-1.5"
              >
                <span>Launch Review Deck</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Right Card: Theory Breakdown */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <h3 className="text-xs font-inria font-bold text-primary uppercase tracking-wider text-left">Theory Breakdown</h3>
          {dueItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-4 text-center text-muted-foreground">
              <span className="text-xl mb-1 select-none">✅</span>
              <p className="text-xs font-inria font-bold uppercase tracking-wider">No pending reviews</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[100px] pr-0.5 space-y-2 scroll-thin">
              {Object.values(theoryGroups).map((group, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground truncate max-w-[130px]">{group.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold font-mono text-[10px]">
                    {group.count} due
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7-Day Grid Forecast */}
      {forecastData.length > 0 && (
        <div className="bg-card border border-border/85 rounded-2xl p-5 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.01)] text-left backdrop-blur-sm relative">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Review Forecast & Spaced Study Planner
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
              className={`p-3 pt-4 pb-3 rounded-xl border text-center flex flex-col justify-between min-h-[145px] transition-all duration-250 hover:shadow-sm cursor-pointer hover:border-rose-500/40 hover:scale-[1.02] active:scale-[0.98] ${
                overdueData.count > 0
                  ? 'border-rose-500/25 bg-rose-500/[0.02] dark:bg-rose-500/[0.04]'
                  : 'border-border/80 bg-card/50'
              }`}
            >
              <div>
                <p className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider">
                  Missed
                </p>
                <p className={`text-[10px] font-bold mt-0.5 ${overdueData.count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                  {overdueData.count > 0 ? 'Overdue' : 'All Clear'}
                </p>
              </div>

              {/* Vertical load indicator bar */}
              <div className="h-10 w-2 bg-secondary dark:bg-secondary/20 rounded-full overflow-hidden relative mx-auto my-1.5">
                <div 
                  style={{ height: overdueData.count > 0 ? '100%' : '0%' }}
                  className="absolute bottom-0 left-0 right-0 rounded-full load-bar-glow-heavy"
                />
              </div>

              <div className="mt-1 space-y-1">
                <div
                  className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    overdueData.count > 0
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                  }`}
                >
                  {overdueData.count > 0 ? `${overdueData.count} missed` : '0 missed'}
                </div>
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

                  handleForecastCardClick(e,
                    `Forecast for ${day.dayName === 'Today' ? 'Today' : day.dayName === 'Tomorrow' ? 'Tomorrow' : day.dayLabel}`, items);
                }}
                role="button"
                tabIndex={0}
                className={`p-3 pt-4 pb-3 rounded-xl border text-center flex flex-col justify-between min-h-[145px] transition-all duration-250 hover:shadow-sm cursor-pointer hover:border-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] ${
                  day.count > 0
                    ? 'border-indigo-500/20 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.04]'
                    : 'border-border/80 bg-card/50'
                }`}
              >
                <div>
                  <p className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider">
                    {day.dayName}
                  </p>
                  <p className="text-[10px] font-bold text-foreground mt-0.5">{day.dayLabel}</p>
                </div>

                {/* Vertical load indicator bar */}
                <div className="h-10 w-2 bg-secondary dark:bg-secondary/20 rounded-full overflow-hidden relative mx-auto my-1.5">
                  <div 
                    style={{ height: `${Math.min(100, (day.count / maxDayCount) * 100)}%` }}
                    className="absolute bottom-0 left-0 right-0 rounded-full load-bar-glow"
                  />
                </div>

                <div className="mt-1 space-y-1">
                  <div
                    className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      day.count > 0
                        ? 'bg-indigo-500 text-white'
                        : 'bg-secondary text-muted-foreground/80'
                    }`}
                  >
                    {day.count} {day.count === 1 ? 'due' : 'due'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Forecast details popover */}
          {selectedForecastDay && popoverPosition && (
            <>
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
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground font-display flex items-center gap-1.5">
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
                    className="p-1 rounded-full hover:bg-secondary text-primary cursor-pointer transition-all"
                    aria-label="Close"
                  >
                    <span className="text-[16px] font-extrabold font-inria">✕</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-extrabold text-muted-foreground/80 uppercase tracking-wider pl-0.5">Scheduled Questions</p>
                  {selectedForecastDay.count === 0 ? (
                    <div className="py-6 text-center text-muted-foreground text-[10px] border border-dashed border-border rounded-xl">0 reviews scheduled</div>
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
      )}
    </div>
  );
}
