'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import type { AttemptWithQuestion, UserProgress } from '@/lib/types';
import {
  ChevronRight
} from 'lucide-react';

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
    },
    {
      id: 'perfect-score',
      title: 'Precision',
      desc: 'Achieve 100% accuracy in any theory domain.',
      icon: '🎯',
      unlocked: theoryMastery.some((t) => t.accuracy === 100 && t.total >= 3),
    },
    {
      id: 'streak-builder',
      title: 'Unstoppable',
      desc: 'Maintain a day streak of 3 days or more.',
      icon: '🔥',
      unlocked: streak >= 3,
    },
    {
      id: 'scholar',
      title: 'Dedicated Scholar',
      desc: 'Complete at least 20 MCQ practice attempts.',
      icon: '🎓',
      unlocked: totalAttempts >= 20,
    },
    {
      id: 'speed-demon',
      title: 'Speed Responder',
      desc: 'Correctly answer a question in under 5 seconds.',
      icon: '⚡',
      unlocked: attempts.some((att) => att.is_correct && att.response_ms && att.response_ms < 5000),
    },
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
        const dateStr = new Date(att.created_at).toISOString().split('T')[0];
        dates[dateStr] = (dates[dateStr] || 0) + 1;
      } catch {
        // Safe fallback
      }
    });

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 180);
    // Align to Sunday
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    const weeks = [];
    let currentWeek: { dateStr: string; count: number; dayOfWeek: number }[] = [];

    const temp = new Date(startDate);
    while (temp <= now) {
      const dateStr = temp.toISOString().split('T')[0];
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
        const dateStr = temp.toISOString().split('T')[0];
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
  const height = 180;
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
  const accPath = accPoints.length > 0 ? 'M ' + accPoints.map(p => `${p.x} ${p.y}`).join(' L ') : '';
  const accAreaPath = accPoints.length > 0 ? `${accPath} L ${accPoints[accPoints.length - 1].x} ${paddingTop + chartH} L ${accPoints[0].x} ${paddingTop + chartH} Z` : '';

  const maxSpeedVal = Math.max(...trendData.map(d => d.speedSeconds), 5);
  const speedPoints = trendData.map((d, idx) => ({
    x: paddingLeft + (idx / Math.max(1, trendData.length - 1)) * chartW,
    y: paddingTop + chartH - (d.speedSeconds / maxSpeedVal) * chartH
  }));
  const speedPath = speedPoints.length > 0 ? 'M ' + speedPoints.map(p => `${p.x} ${p.y}`).join(' L ') : '';
  const speedAreaPath = speedPoints.length > 0 ? `${speedPath} L ${speedPoints[speedPoints.length - 1].x} ${paddingTop + chartH} L ${speedPoints[0].x} ${paddingTop + chartH} Z` : '';

  // Summary metrics for heatmap panel
  const activeDaysCount = attempts.reduce((acc, att) => {
    const dStr = new Date(att.created_at).toISOString().split('T')[0];
    acc.add(dStr);
    return acc;
  }, new Set<string>()).size;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <StatsHeader
        role={profile?.role}
        streak={streak}
        accuracy={accuracy}
        xp={xp}
        description="Track your learning activity, domain mastery, and performance trends."
      />

      {/* ─── Daily Activity Heatmap ─── */}
      <div className="p-6 premium-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div>
            <h3 className="text-lg font-bold font-inria text-foreground flex items-center gap-2">
              Learning Activity
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Practice attempts recorded over the last 6 months</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-secondary/40 px-3 py-1.5 rounded-xl border border-border/40">
              <span className="text-muted-foreground font-medium">Active Days:</span>
              <span className="font-bold text-foreground font-mono">{activeDaysCount}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-secondary/40 px-3 py-1.5 rounded-xl border border-border/40">
              <span className="text-muted-foreground font-medium">Total MCQs:</span>
              <span className="font-bold text-foreground font-mono">{totalAttempts}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 pt-1">
          {/* Heatmap Area */}
          <div className="flex-1 overflow-x-auto pb-2 scrollbar-none">
            <div className="flex flex-col gap-2 min-w-[620px]">
              <div className="flex gap-2">
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
                <div className="flex gap-[4px]">
                  {heatmapData.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[4px]">
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
                          const dateObj = new Date(day.dateStr);
                          formattedDate = dateObj.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                        } catch {
                          // Safe fallback
                        }

                        return (
                          <div
                            key={day.dateStr}
                            className={`w-[11px] h-[11px] rounded-[3px] transition-all duration-200 relative group cursor-pointer hover:scale-125 hover:z-20 ${colorClass}`}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 pointer-events-none">
                              <div className="bg-popover border border-border text-popover-foreground text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg whitespace-nowrap leading-tight">
                                {day.count === 0 ? 'No' : day.count} practice {day.count === 1 ? 'attempt' : 'attempts'} on {formattedDate}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Month Labels */}
              <div className="flex gap-[4px] text-[10px] font-bold text-muted-foreground/70 pt-1 select-none ml-[32px] relative h-4">
                {heatmapData.map((week, wIdx) => {
                  const dayObj = new Date(week[0].dateStr);
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
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end lg:justify-center gap-2 text-[10px] font-bold text-muted-foreground/80 shrink-0 select-none pt-2 lg:pt-0 lg:border-l lg:border-border/40 lg:pl-6">
            <span>Less</span>
            <div className="w-3 h-3 rounded-[3px] bg-secondary/60 border border-border/30" />
            <div className="w-3 h-3 rounded-[3px] bg-primary/25 border border-primary/30" />
            <div className="w-3 h-3 rounded-[3px] bg-primary/60 border border-primary/70" />
            <div className="w-3 h-3 rounded-[3px] bg-primary border border-primary" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* ─── Performance Trends ─── */}
      {trendData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accuracy Chart */}
          <div className="p-6 premium-card space-y-4">
            <div>
              <h3 className="text-md font-bold font-inria text-foreground">Mastery Progression</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Rolling accuracy over the last 15 practice attempts</p>
            </div>

            <div className="w-full pt-2">
              <svg className="w-full h-auto overflow-visible select-none" viewBox="0 0 500 180">
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
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
                {accPath && <path d={accPath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

                {accPoints.map((p, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle cx={p.x} cy={p.y} r="4" className="fill-background stroke-primary" strokeWidth="2.5" />
                    <circle cx={p.x} cy={p.y} r="8" className="fill-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <foreignObject x={p.x - 55} y={p.y - 36} width="110" height="30" className="overflow-visible pointer-events-none hidden group-hover:block z-30">
                      <div className="bg-popover border border-border text-popover-foreground text-[9px] font-bold py-1 px-2 rounded-lg shadow-lg text-center leading-tight">
                        <p>{trendData[idx].rollingAccuracy}% Accuracy</p>
                        <p className="text-[8px] text-muted-foreground truncate">{trendData[idx].theoryTitle}</p>
                      </div>
                    </foreignObject>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Speed Chart */}
          <div className="p-6 premium-card space-y-4">
            <div>
              <h3 className="text-md font-bold font-inria text-foreground">Response Speed Curve</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Time elapsed per question over the last 15 practice attempts</p>
            </div>

            <div className="w-full pt-2">
              <svg className="w-full h-auto overflow-visible select-none" viewBox="0 0 500 180">
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
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
                {speedPath && <path d={speedPath} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

                {speedPoints.map((p, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle cx={p.x} cy={p.y} r="4" className="fill-background stroke-[#8b5cf6]" strokeWidth="2.5" />
                    <circle cx={p.x} cy={p.y} r="8" className="fill-[#8b5cf6]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <foreignObject x={p.x - 55} y={p.y - 36} width="110" height="30" className="overflow-visible pointer-events-none hidden group-hover:block z-30">
                      <div className="bg-popover border border-border text-popover-foreground text-[9px] font-bold py-1 px-2 rounded-lg shadow-lg text-center leading-tight">
                        <p>{trendData[idx].speedSeconds}s Response</p>
                        <p className="text-[8px] text-muted-foreground truncate">{trendData[idx].theoryTitle}</p>
                      </div>
                    </foreignObject>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity columns */}
        <div className="p-6 premium-card flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-md font-bold font-inria text-foreground">Weekly Practice Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">MCQ attempts in the last 7 days</p>
          </div>
          <div className="flex justify-between items-end h-32 pt-4 px-2">
            {weeklyAttempts.map((count, index) => {
              const percent = Math.max(12, Math.min(100, (count / maxWeekly) * 100));
              return (
                <div key={index} className="flex flex-col items-center justify-end h-full flex-1 gap-2">
                  <div
                    className="w-6 bg-primary hover:bg-primary/90 rounded-t-lg transition-all relative group cursor-pointer shadow-sm"
                    style={{ height: `${percent}%` }}
                    title={`${count} attempts`}
                  >
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono shadow-md border border-border">
                      {count}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground/80">{dayNames[index]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Theory Mastery Progress */}
        <div className="p-6 premium-card flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-md font-bold font-inria text-foreground">Domain Mastery</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Topic accuracy across answered theories</p>
          </div>
          {theoryMastery.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground italic border border-dashed border-border/60 rounded-xl">
              Complete practice questions to view domain accuracy breakdowns.
            </div>
          ) : (
            <div className="space-y-3.5">
              {theoryMastery.slice(0, 5).map((tm) => (
                <div key={tm.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/40 transition-all cursor-pointer">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-foreground truncate max-w-[240px]" title={tm.title}>{tm.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono font-bold">{tm.correct}/{tm.total} Correct ({tm.accuracy}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${tm.accuracy}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gamified Achievements Grid */}
      <div className="space-y-3">
        <div>
          <h3 className="text-md font-bold font-inria text-foreground">Accomplishments</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Badges unlocked through active learning</p>
        </div>

        <div className="relative group">
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-4 border rounded-2xl flex gap-3.5 items-center shrink-0 w-[270px] snap-start relative transition-all duration-300 ${
                  ach.unlocked
                    ? 'border-primary/30 bg-primary/[0.04] shadow-sm hover:border-primary/50'
                    : 'border-border/60 opacity-60 bg-secondary/20'
                }`}
              >
                <div className="text-3xl shrink-0 select-none">{ach.icon}</div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>{ach.title}</span>
                    {ach.unlocked ? (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Unlocked</span>
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Locked</span>
                    )}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
