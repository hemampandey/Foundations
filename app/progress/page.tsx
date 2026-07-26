'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import Image from 'next/image';
import type { AttemptWithQuestion, UserProgress } from '@/lib/types';
import { ChevronRight } from 'lucide-react';

const getBezierPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
  }
  return path;
};

const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
};

export default function ProgressPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useProfile();
  const [loadingData, setLoadingData] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [attempts, setAttempts] = useState<AttemptWithQuestion[]>([]);

  const fetchProgressAndAttempts = useCallback(async () => {
    if (!profile) return;

    setLoadingData(true);
    try {
      // Fetch progress
      const { data: progData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      setProgress(progData ?? null);

      // Fetch user's attempts with joined question & theory details
      const { data: attData } = await supabase
        .from('attempts')
        .select(`
          id,
          user_id,
          question_id,
          chosen_index,
          is_correct,
          response_ms,
          created_at,
          questions (
            stem,
            theories (
              id,
              title
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (attData) {
        const formatted: AttemptWithQuestion[] = (attData as unknown[]).map((rawAtt) => {
          const att = rawAtt as {
            id: string;
            user_id: string;
            question_id: string;
            chosen_index: number;
            is_correct: boolean;
            response_ms: number;
            created_at: string;
            questions: unknown;
          };

          const rawQ = att.questions
            ? (Array.isArray(att.questions) ? att.questions[0] : att.questions) as { stem?: string; theories?: unknown }
            : null;

          const rawTheory = rawQ && rawQ.theories
            ? (Array.isArray(rawQ.theories) ? rawQ.theories[0] : rawQ.theories) as { id?: string; title?: string }
            : null;

          return {
            id: att.id,
            user_id: att.user_id,
            question_id: att.question_id,
            chosen_index: att.chosen_index,
            is_correct: att.is_correct,
            response_ms: att.response_ms,
            created_at: att.created_at,
            question: rawQ ? {
              stem: rawQ.stem ?? '',
              theories: rawTheory ? {
                id: rawTheory.id ?? '',
                title: rawTheory.title ?? ''
              } : null
            } : null
          };
        });
        setAttempts(formatted);
      }
    } catch (err) {
      console.error('[Foundations] Failed to fetch progress page data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        fetchProgressAndAttempts();
      });
    }
  }, [profile, fetchProgressAndAttempts]);

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth');
    }
  }, [authLoading, profile, router]);

  if (authLoading || loadingData) {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="border-b border-border/80 pb-6">
          <div className="skeleton h-8 w-40 mb-2" />
          <div className="skeleton h-3 w-72" />
        </div>

        {/* Stats Row Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 p-5 space-y-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-8 w-16" />
              <div className="skeleton h-2 w-28 mt-2" />
            </div>
          ))}
        </div>

        {/* Heatmap & Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border/40 p-6 space-y-4">
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-32 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-border/40 p-6 space-y-4">
            <div className="skeleton h-5 w-44" />
            <div className="flex items-end justify-between gap-3 h-32">
              {[40, 70, 55, 85, 45, 75, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="skeleton w-full rounded-lg" style={{ height: `${h}%` }} />
                  <div className="skeleton h-2 w-6" />
                </div>
              ))}
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

  // Group attempts by theory
  const theoryMasteryMap: Record<string, { title: string; total: number; correct: number }> = {};
  attempts.forEach((att) => {
    const theory = att.question?.theories;
    if (theory && theory.id && theory.title) {
      if (!theoryMasteryMap[theory.id]) {
        theoryMasteryMap[theory.id] = {
          title: theory.title,
          total: 0,
          correct: 0,
        };
      }
      theoryMasteryMap[theory.id].total += 1;
      if (att.is_correct) {
        theoryMasteryMap[theory.id].correct += 1;
      }
    }
  });

  const theoryMastery = Object.entries(theoryMasteryMap).map(([id, info]) => ({
    id,
    title: info.title,
    total: info.total,
    correct: info.correct,
    accuracy: info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0,
  }));

  // Define Achievements
  const achievements = [
    {
      id: 'first-step',
      title: 'First Step',
      desc: 'Complete your first MCQ practice attempt.',
      icon: '🚀',
      unlocked: totalAttempts >= 1,
      type: 'badge'
    },
    {
      id: 'scholar',
      title: 'Dedicated Scholar',
      desc: 'Complete at least 20 MCQ practice attempts.',
      icon: '🎓',
      unlocked: totalAttempts >= 20,
      type: 'badge'
    },
    {
      id: 'perfect-score',
      title: 'Precision',
      desc: 'Achieve 100% accuracy in any theory domain.',
      icon: '🎯',
      unlocked: theoryMastery.some((t) => t.accuracy === 100 && t.total >= 3),
      type: 'badge'
    },
    {
      id: 'speed-demon',
      title: 'Speed Responder',
      desc: 'Correctly answer a question in under 5 seconds.',
      icon: '⚡',
      unlocked: false,
      type: 'progress',
      current: attempts.filter((att) => att.is_correct && att.response_ms && att.response_ms < 5000).length,
      max: 10
    },
    {
      id: 'streak-builder',
      title: 'Unstoppable',
      desc: 'Maintain a day streak of 3 days or more.',
      icon: '🔥',
      unlocked: false,
      type: 'progress',
      current: Math.min(streak, 5),
      max: 5
    },
    {
      id: 'theory-explorer',
      title: 'Theory Explorer',
      desc: 'Practice in 5 different theory domains.',
      icon: '🔥',
      unlocked: false,
      type: 'progress',
      current: Math.min(theoryMastery.length, 5),
      max: 5
    },
    {
      id: 'domain-streaks',
      title: 'Theory Explorer',
      desc: 'Maintain a streak across domains.',
      icon: '📖',
      unlocked: false,
      type: 'progress',
      current: Math.min(theoryMastery.filter(t => t.accuracy >= 80).length, 5),
      max: 5
    },
    {
      id: 'mastermind',
      title: 'Mastermind',
      desc: 'Achieve 90% average accuracy over 30 days.',
      icon: '🧠',
      unlocked: false,
      type: 'locked'
    },
    {
      id: 'perfectionist',
      title: 'Perfectionist',
      desc: 'Score 100% in 10 attempts.',
      icon: '🏅',
      unlocked: false,
      type: 'locked'
    },
    {
      id: 'legend',
      title: 'Legend',
      desc: 'Complete 100 MCQ attempts.',
      icon: '⭐',
      unlocked: false,
      type: 'locked'
    },
    {
      id: 'ultimate',
      title: 'The Ultimate',
      desc: 'Unlock all other achievements.',
      icon: '💎',
      unlocked: false,
      type: 'locked'
    },
    {
      id: 'coming-soon',
      title: 'Coming Soon',
      desc: 'New achievement on the way!',
      icon: '🎁',
      unlocked: false,
      type: 'locked'
    }
  ];

  // Group attempts by weekday
  const weeklyAttempts = [0, 0, 0, 0, 0, 0, 0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  attempts.forEach((att) => {
    const attDate = new Date(att.created_at);
    if (attDate >= sevenDaysAgo) {
      weeklyAttempts[attDate.getDay()] += 1;
    }
  });
  const maxWeekly = Math.max(...weeklyAttempts, 1);

  // Construct heatmap data for the last 6 months (26 weeks)
  const heatmapData = (() => {
    const dates: Record<string, number> = {};
    attempts.forEach((att) => {
      try {
        const dateStr = formatLocalDateString(new Date(att.created_at));
        dates[dateStr] = (dates[dateStr] || 0) + 1;
      } catch {
        // Safe fallback
      }
    });

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 364);
    // Align to Sunday
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    const weeks = [];
    let currentWeek: { dateStr: string; count: number; dayOfWeek: number }[] = [];

    const temp = new Date(startDate);
    while (temp <= now) {
      const dateStr = formatLocalDateString(temp);
      const count = dates[dateStr] || 0;
      currentWeek.push({
        dateStr,
        count,
        dayOfWeek: temp.getDay(),
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      temp.setDate(temp.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        const dateStr = formatLocalDateString(temp);
        currentWeek.push({
          dateStr,
          count: 0,
          dayOfWeek: temp.getDay(),
        });
        temp.setDate(temp.getDate() + 1);
      }
      weeks.push(currentWeek);
    }
    return weeks;
  })();

  // Construct trend data for the last 15 attempts (chronological order)
  const trendData = (() => {
    const last15 = [...attempts].slice(0, 15).reverse();
    return last15.map((att, idx) => {
      const subset = last15.slice(Math.max(0, idx - 4), idx + 1);
      const correctCount = subset.filter((a) => a.is_correct).length;
      const rollingAcc = Math.round((correctCount / subset.length) * 100);
      const speedSec = att.response_ms ? parseFloat((att.response_ms / 1000).toFixed(1)) : 0;
      return {
        index: idx + 1,
        rollingAccuracy: rollingAcc,
        speedSeconds: speedSec,
        theoryTitle: att.question?.theories?.title || 'Practice',
      };
    });
  })();

  // SVG Chart Dimensions
  const width = 500;
  const height = 140;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const accPoints = trendData.map((d, idx) => ({
    x: paddingLeft + (idx / Math.max(1, trendData.length - 1)) * chartW,
    y: paddingTop + chartH - (d.rollingAccuracy / 100) * chartH
  }));
  const accBezier = getBezierPath(accPoints);
  const accAreaPath = accPoints.length > 0 ? `${accBezier} L ${accPoints[accPoints.length - 1].x} ${paddingTop + chartH} L ${accPoints[0].x} ${paddingTop + chartH} Z` : '';

  const maxSpeedVal = Math.max(...trendData.map(d => d.speedSeconds), 5);
  const speedPoints = trendData.map((d, idx) => ({
    x: paddingLeft + (idx / Math.max(1, trendData.length - 1)) * chartW,
    y: paddingTop + chartH - (d.speedSeconds / maxSpeedVal) * chartH
  }));
  const speedBezier = getBezierPath(speedPoints);
  const speedAreaPath = speedPoints.length > 0 ? `${speedBezier} L ${speedPoints[speedPoints.length - 1].x} ${paddingTop + chartH} L ${speedPoints[0].x} ${paddingTop + chartH} Z` : '';

  // Summary metrics for heatmap panel
  const activeDaysCount = attempts.reduce((acc, att) => {
    const dStr = formatLocalDateString(new Date(att.created_at));
    acc.add(dStr);
    return acc;
  }, new Set<string>()).size;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="w-full space-y-6 animate-fade-in text-foreground">
      {/* Top Stats Banner */}
      <StatsHeader
        role={profile?.role}
        streak={streak}
        accuracy={accuracy}
        xp={xp}
        description="Track your learning activity, domain mastery, and performance trends."
      />

      {/* Row 1: Learning Activity (2/3 width) and Mastery Progression (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* ─── Daily Activity Heatmap ─── (takes 2/3 width) */}
        <div className="lg:col-span-2 p-4 premium-card space-y-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Image 
                src="/icons/calendar.svg"
                alt="Calendar Icon"
                width={36}
                height={36}
                className="w-9 h-9 shrink-0"
                unoptimized
              />
              <div>
                <h3 className="text-md font-extrabold font-inria text-foreground leading-tight mb-0">Learning Activity</h3>
                <p className="text-[11px] font-inria text-muted-foreground mt-0.5">Practice attempts recorded over the last 12 months</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-2 px-3.5">
                <div className="text-left select-none">
                  <p className="text-[9px] text-muted-foreground font-bold uppercase leading-none">Active Days</p>
                  <p className="text-xs font-extrabold text-foreground leading-tight mt-1">{activeDaysCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 rounded-xl p-2 px-3.5">
                <div className="text-left select-none">
                  <p className="text-[9px] text-muted-foreground font-bold uppercase leading-none">Total MCQs</p>
                  <p className="text-xs font-extrabold text-foreground leading-tight mt-1">{totalAttempts}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap Area */}
          <div className="w-full pt-1 pb-1">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                {/* Weekday Labels (Sun to Sat) */}
                <div className="flex flex-col justify-between text-[10px] font-bold text-muted-foreground/70 pr-1.5 h-[98px] py-0.5 shrink-0 select-none">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Heatmap Grid */}
                <div className="flex gap-[3px] sm:gap-[4px] flex-1 justify-between">
                  {heatmapData.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[3px] sm:gap-[4px]">
                      {week.map((day) => {
                        let colorClass = 'bg-secondary/60 dark:bg-neutral-800/40 border border-border/30';
                        if (day.count > 0 && day.count <= 2) {
                          colorClass = 'bg-primary/25 border border-primary/30 text-primary';
                        } else if (day.count > 2 && day.count <= 5) {
                          colorClass = 'bg-primary/60 border border-primary/70 text-primary-foreground';
                        } else if (day.count > 5) {
                          colorClass = 'bg-primary border border-primary text-primary-foreground shadow-sm shadow-primary/20';
                        }

                        let formattedDate = day.dateStr;
                        try {
                          const dateObj = parseLocalDate(day.dateStr);
                          formattedDate = dateObj.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                        } catch {
                          // Safe fallback
                        }

                        const isTopRow = day.dayOfWeek <= 1;

                        return (
                          <div
                            key={day.dateStr}
                            className={`w-[11px] h-[11px] rounded-xs transition-all duration-200 relative group cursor-pointer hover:scale-125 hover:z-30 ${colorClass}`}
                          >
                            {/* Hover Tooltip Popover */}
                            <div className={`absolute left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none animate-fade-in ${isTopRow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}>
                              {!isTopRow && (
                                <div className="bg-popover border border-border text-popover-foreground text-[8px] font-bold py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap leading-tight">
                                  {day.count === 0 ? 'No' : day.count} practice {day.count === 1 ? 'attempt' : 'attempts'} on {formattedDate}
                                </div>
                              )}
                              <div className={`w-1.5 h-1.5 bg-popover border-border rotate-45 ${isTopRow ? 'border-l border-t -mb-1' : 'border-r border-b -mt-1'}`} />
                              {isTopRow && (
                                <div className="bg-popover border border-border text-popover-foreground text-[8px] font-bold py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap leading-tight">
                                  {day.count === 0 ? 'No' : day.count} practice {day.count === 1 ? 'attempt' : 'attempts'} on {formattedDate}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Row: Month Labels on Left, Legend on Bottom Right */}
              <div className="flex items-center justify-between pt-1 select-none pl-[32px] pr-1">
                <div className="flex gap-[3px] sm:gap-[4px] text-[10px] font-bold text-muted-foreground/70 relative h-4 flex-1">
                  {heatmapData.map((week, wIdx) => {
                    const dayObj = parseLocalDate(week[0].dateStr);
                    const isFirstWeekOfMonth = dayObj.getDate() <= 7;
                    if (isFirstWeekOfMonth) {
                      return (
                        <div key={wIdx} className="w-[11px] relative">
                          <span className="absolute left-0 top-0 whitespace-nowrap">
                            {dayObj.toLocaleString('default', { month: 'short' })}
                          </span>
                        </div>
                      );
                    }
                    return <div key={wIdx} className="w-[11px]" />;
                  })}
                </div>

                {/* Legend in bottom right corner */}
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/80 shrink-0 select-none pl-4 pt-6">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-xs bg-secondary/60 border border-border/30" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-primary/25 border border-primary/30" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-primary/60 border border-primary/70" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-primary border border-primary" />
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mastery Progression (Accuracy Chart) ─── (takes 1/3 width) */}
        <div className="lg:col-span-1 p-4 premium-card flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <Image 
              src="/icons/mastery.svg"
              alt="Mastery Icon"
              width={36}
              height={36}
              className="w-9 h-9 shrink-0"
              unoptimized
            />
            <div>
              <h3 className="text-md font-extrabold font-inria text-foreground leading-tight">Mastery Progression</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Rolling accuracy over the last 15 attempts</p>
            </div>
          </div>

          <div className="w-full pt-2 flex-1 flex items-center justify-center">
            {trendData.length > 0 ? (
              <svg className="w-full h-auto overflow-visible select-none" viewBox="0 0 500 140">
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#248DCE" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#248DCE" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 25, 50, 75, 100].map((val) => {
                  const y = paddingTop + chartH - (val / 100) * chartH;
                  return (
                    <g key={val}>
                      <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="stroke-border/40" strokeWidth="1" strokeDasharray="3 3" />
                      <text x={paddingLeft - 8} y={y + 3} className="text-[10px] fill-muted-foreground font-bold text-right" textAnchor="end">{val}%</text>
                    </g>
                  );
                })}

                {accAreaPath && <path d={accAreaPath} fill="url(#accGrad)" />}
                {accPoints.length > 0 && (
                  <path d={accBezier} fill="none" stroke="#248DCE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {accPoints.map((p, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle cx={p.x} cy={p.y} r="4" className="fill-white stroke-[#248DCE]" strokeWidth="3" />
                    <circle cx={p.x} cy={p.y} r="8" className="fill-[#248DCE]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <foreignObject x={p.x - 55} y={p.y - 36} width="110" height="30" className="overflow-visible pointer-events-none hidden group-hover:block z-30">
                      <div className="bg-popover border border-border text-popover-foreground text-[9px] font-bold py-1 px-2 rounded-lg shadow-lg text-center leading-tight">
                        <p>{trendData[idx].rollingAccuracy}% Accuracy</p>
                        <p className="text-[8px] text-muted-foreground truncate">{trendData[idx].theoryTitle}</p>
                      </div>
                    </foreignObject>
                  </g>
                ))}
              </svg>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-xl w-full my-auto">
                Complete practice sessions to view accuracy trend.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Response Speed Curve, Weekly Practice Activity, and Domain Mastery in 1/3 widths */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Average Response Time Chart (1/3 width) */}
        <div className="p-4 premium-card flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 ">
              <Image 
                src="/icons/time.svg"
                alt="Time Icon"
                width={32}
                height={32}
                className="w-9 h-9 shrink-0"
                unoptimized
              />
            <div>
              <h3 className="text-md font-extrabold font-inria text-foreground leading-tight">Average Response Time</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Time elapsed per question (last 15 attempts)</p>
            </div>
          </div>

          <div className="w-full pt-2 flex-1 flex items-center justify-center">
            {trendData.length > 0 ? (() => {
              const peakIdx = trendData.findIndex(d => d.speedSeconds === Math.max(...trendData.map(t => t.speedSeconds)));
              return (
                <svg className="w-full h-auto overflow-visible select-none" viewBox="0 0 500 140">
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#248DCE" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#248DCE" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const val = Math.round(ratio * maxSpeedVal);
                    const y = paddingTop + chartH - ratio * chartH;
                    return (
                      <g key={ratio}>
                        <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="stroke-border/40" strokeWidth="1" strokeDasharray="3 3" />
                        <text x={paddingLeft - 8} y={y + 3} className="text-[10px] fill-muted-foreground font-bold text-right" textAnchor="end">{val}s</text>
                      </g>
                    );
                  })}

                  {speedAreaPath && <path d={speedAreaPath} fill="url(#speedGrad)" />}
                  {speedPoints.length > 0 && (
                    <path d={speedBezier} fill="none" stroke="#248DCE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  )}

                  {speedPoints.map((p, idx) => {
                    const isPeak = idx === peakIdx;
                    return (
                      <g key={idx} className="group cursor-pointer">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isPeak ? "5" : "4"}
                          className={isPeak ? "fill-white stroke-[#248DCE]" : "fill-background stroke-[#248DCE]"}
                          strokeWidth={isPeak ? "3" : "2.5"}
                        />
                        {isPeak && (
                          <g>
                            <rect
                              x={p.x - 16}
                              y={p.y - 25}
                              width="32"
                              height="16"
                              rx="6"
                              className="fill-primary stroke-white stroke-1 shadow-sm"
                            />
                            <text
                              x={p.x}
                              y={p.y - 14}
                              className="text-[9px] font-extrabold fill-white"
                              textAnchor="middle"
                            >
                              {trendData[idx].speedSeconds}s
                            </text>
                          </g>
                        )}
                        <circle cx={p.x} cy={p.y} r="8" className="fill-[#248DCE]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <foreignObject x={p.x - 55} y={p.y - 36} width="110" height="30" className="overflow-visible pointer-events-none hidden group-hover:block z-30">
                          <div className="bg-popover border border-border text-popover-foreground text-[9px] font-bold py-1 px-2 rounded-lg shadow-lg text-center leading-tight">
                            <p>{trendData[idx].speedSeconds}s Response</p>
                            <p className="text-[8px] text-muted-foreground truncate">{trendData[idx].theoryTitle}</p>
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })}
                </svg>
              );
            })() : (
              <div className="text-center py-8 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-xl w-full my-auto">
                Complete practice sessions to view response speed.
              </div>
            )}
          </div>
        </div>

        {/* Weekly Practice Activity (1/3 width) */}
        <div className="p-4 premium-card flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
              <Image 
                src="/icons/time.svg"
                alt="Brain Icon"
                width={32}
                height={32}
                className="w-9 h-9 shrink-0"
                unoptimized
              />

            <div>
              <h3 className="text-md font-extrabold font-inria text-foreground leading-tight">Weekly Practice Activity</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">MCQ attempts in the last 7 days</p>
            </div>
          </div>
          
          <div className="flex justify-between items-end h-[140px] px-2 my-auto">
            {(() => {
              const maxCountIdx = weeklyAttempts.indexOf(maxWeekly);
              return weeklyAttempts.map((count, index) => {
                const percent = count > 0 ? (count / maxWeekly) * 70 : 5;
                const isHighest = index === maxCountIdx && maxWeekly > 0;
                return (
                  <div key={index} className="flex flex-col items-center justify-end h-full flex-1 gap-2">
                    <div className="relative flex flex-col items-center w-full h-[70%] justify-end">
                      {count > 0 && (
                        <span className="text-sm font-extrabold font-inria text-primary/95 bg-primary/20 border border-primary/20 rounded-[6px] px-3 py-0.5 mb-1 block">{count}</span>
                      )}
                      <div
                        className={`w-8 rounded-t-[4px] transition-all duration-300 relative group cursor-pointer ${
                          isHighest ? 'bg-primary shadow-md shadow-primary/20' : 'bg-primary/40 hover:bg-primary/60'
                        }`}
                        style={{ height: `${percent}%` }}
                      >
                        <span className="absolute left-1/2 top-0 -translate-x-1/2 bg-popover text-popover-foreground text-[11px] font-serif italic px-2 py-0.5 rounded-[6px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-serif shadow-md border border-border z-30">{count} attempts</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground/80">{dayNames[index]}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Domain Mastery (1/3 width) */}
        <div className="p-4 premium-card flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <Image 
              src="/icons/book.svg"
              alt="Book Icon"
              width={32}
              height={32}
              className="w-8 h-8 shrink-0"
              unoptimized
            />
            <div>
              <h3 className="text-md font-extrabold font-inria text-foreground leading-tight">Domain Mastery</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Topic accuracy across answered theories</p>
            </div>
          </div>
          {theoryMastery.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-xl my-auto">Complete practice questions to view domain accuracy breakdowns.</div>
          ) : (<div className="space-y-2.5 overflow-y-auto max-h-[145px] pr-1 scrollbar-none my-auto">
              {theoryMastery.slice(0, 3).map((tm) => {
                let badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                if (tm.accuracy >= 90) {
                  badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                } else if (tm.accuracy >= 70) {
                  badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                }
                return (
                  <div key={tm.id} className="flex items-center gap-2.5 rounded-xl hover:bg-secondary/40 transition-all cursor-pointer">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between items-center text-[10px] gap-1">
                        <span className="font-bold text-foreground truncate max-w-[110px]" title={tm.title}>{tm.title}</span>
                        <span className="text-[9px] text-muted-foreground font-mono font-bold shrink-0">{tm.correct}/{tm.total}</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${tm.accuracy}%` }}
                        />
                      </div>
                    </div>     
                    <div className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border shrink-0 select-none ${badgeClass}`}>{tm.accuracy}%</div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Accomplishments (Full width) */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#F4F9FD] to-[#FAFDFE] dark:from-neutral-900/60 dark:to-neutral-900/20 border border-[#D9EAF5] dark:border-neutral-800 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
              <Image 
                src="/icons/accomplishments.svg"
                alt="Accomplishments Icon"
                width={36}
                height={36}
                className="w-9 h-9 shrink-0"
                unoptimized
              />
            <div>
              <h3 className="text-md font-extrabold font-inria text-foreground leading-tight">Accomplishments</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Badges unlocked through active learning</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-extrabold px-3.5 py-1 rounded-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700/60 text-slate-900 dark:text-slate-100 select-none shadow-sm">
              {unlockedCount} / {achievements.filter(a => a.type === 'badge').length} Unlocked
            </span>
          </div>
        </div>

        <div className="relative group/nav">
          {/* Scroll Container */}
          <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory scroll-smooth">
            {achievements.map((ach) => {
              const unlocked = ach.type === 'badge' && ach.unlocked;
              const isProgress = ach.type === 'progress';
              const isLocked = ach.type === 'locked';

              // Icon layout
              let achIcon = null;
              if (ach.id === 'first-step') achIcon = <Image src="/icons/first-step.svg" alt="First Step Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'scholar') achIcon = <Image src="/icons/scholar.svg" alt="Scholar Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'perfect-score') achIcon = <Image src="/icons/precision.svg" alt="Precision Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'speed-demon') achIcon = <Image src="/icons/speed.svg" alt="Speed Demon Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'streak-builder') achIcon = <Image src="/icons/unstoppable.svg" alt="Streak Builder Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'theory-explorer') achIcon = <Image src="/icons/theory-explorer.svg" alt="Theory Explorer Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'domain-streaks') achIcon = <Image src="/icons/domain-streak.svg" alt="Domain Streaks Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'mastermind') achIcon = <Image src="/icons/mastermind.svg" alt="Mastermind Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'perfectionist') achIcon = <Image src="/icons/perfectionist.svg" alt="Perfectionist Icon" width={32} height={32} className="w-9 h-9 shrink-0" unoptimized />;
              else if (ach.id === 'legend') achIcon = <Image src="/icons/legend.svg" alt="Legend Icon" width={32} height={32} className="w-8 h-8 shrink-0" unoptimized />;
              else if (ach.id === 'ultimate') achIcon = <Image src="/icons/ultimate.svg" alt="Ultimate Icon" width={32} height={32} className="w-8 h-8 shrink-0" unoptimized />;
              else achIcon = <Image src="/icons/coming-soon.svg" alt="Coming Soon Icon" width={32} height={32} className="w-8 h-8 shrink-0" unoptimized />;

              return (
                <div
                  key={ach.id}
                  className={`flex flex-col items-center justify-between p-3 bg-white dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700/50 rounded-2xl w-[130px] h-[195px] shrink-0 snap-start text-center shadow-sm hover:shadow-md transition-all duration-300 select-none`}
                >
                  {achIcon}
                  <div className="flex-1 pt-4 flex flex-col justify-start">
                    <h4 className="text-[11px] font-extrabold font-serif text-slate-800 dark:text-slate-100 tracking-tight leading-snug">{ach.title}</h4>
                    <p className="text-[8.5px] text-muted-foreground mt-0.5 leading-tight line-clamp-2 max-w-[110px] mx-auto font-medium">{ach.desc}</p>
                  </div>
                  <div className="w-full mt-auto pt-1.5 border-t border-border/20 flex items-center justify-center">
                    {unlocked && (
                      <div className="flex items-center justify-center h-6">
                        <div className="w-5.5 h-5.5 rounded-full bg-[#10B981] text-white flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3 text-white stroke-[3.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {isProgress && (
                      <div className="flex items-center justify-center gap-1 h-6">
                        <svg className="w-[16px] h-[16px] transform -rotate-90">
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" className="text-slate-100 dark:text-neutral-700/60" />
                          <circle
                            cx="8"
                            cy="8"
                            r="6"
                            stroke="#248DCE"
                            strokeWidth="2.2"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 6}
                            strokeDashoffset={2 * Math.PI * 6 - (ach.current! / ach.max!) * (2 * Math.PI * 6)}
                            className="transition-all duration-300 stroke-[#248DCE]"
                          />
                        </svg>
                        <span className="text-[9.5px] font-extrabold text-slate-750 dark:text-slate-350 font-mono leading-none">
                          {ach.current}/{ach.max}
                        </span>
                      </div>
                    )}

                    {isLocked && (
                      <div className="flex items-center justify-center h-6">
                        <div className="w-5.5 h-5.5 rounded-full bg-slate-50 border border-slate-200 dark:bg-neutral-800 dark:border-neutral-700 text-muted-foreground/80 flex items-center justify-center shadow-inner">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
