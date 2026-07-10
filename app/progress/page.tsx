'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import StatsHeader from '@/app/components/StatsHeader';
import type { AttemptWithQuestion, UserProgress } from '@/lib/types';
import {
  BookOpen, Target,
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
            questions: {
              stem: string;
              theories: {
                id: string;
                title: string;
              } | null;
            } | null;
          };
          return {
            id: att.id,
            user_id: att.user_id,
            question_id: att.question_id,
            chosen_index: att.chosen_index,
            is_correct: att.is_correct,
            response_ms: att.response_ms,
            created_at: att.created_at,
            question: att.questions ? {
              stem: att.questions.stem,
              theories: att.questions.theories ? {
                id: att.questions.theories.id,
                title: att.questions.theories.title
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
      <div className="flex h-screen w-full items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 animate-fade-in">
      <StatsHeader
        role={profile?.role}
        streak={streak}
        accuracy={accuracy}
        xp={xp}
        description="Track your accomplishments and domain mastery statistics."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <div className="p-4 border border-border bg-card rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <Target className="w-4 h-4 text-primary" />
            <span>Total XP</span>
          </div>
          <p className="text-xl font-bold mt-2">{xp}</p>
        </div>

        <div className="p-4 border border-border bg-card rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <BookOpen className="w-4 h-4 text-violet-500" />
            <span>Attempts</span>
          </div>
          <p className="text-xl font-bold mt-2">{totalAttempts}</p>
        </div>
      </div>

      <div className="space-y-8 max-w-5xl mx-auto">
        {/* ─── Daily Activity Heatmap ─── */}
        <div className="p-6 border border-border bg-card rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Daily Activity Heatmap</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Practice attempts logged over the last 6 months</p>
          </div>

          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="flex gap-2 min-w-[650px] pt-2">
              {/* Weekday Labels (Sun, Tue, Thu, Sat) */}
              <div className="flex flex-col justify-between text-[9px] font-bold text-muted-foreground pr-2 h-[84px] py-0.5 shrink-0 select-none">
                <span>Sun</span>
                <span>Tue</span>
                <span>Thu</span>
                <span>Sat</span>
              </div>

              {/* Heatmap Grid */}
              <div className="flex gap-[3.5px]">
                {heatmapData.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3.5px]">
                    {week.map((day) => {
                      let colorClass = 'bg-secondary/40 dark:bg-neutral-800/30';
                      if (day.count > 0 && day.count <= 2) {
                        colorClass = 'bg-emerald-500/20 dark:bg-emerald-500/10 text-emerald-600';
                      } else if (day.count > 2 && day.count <= 5) {
                        colorClass = 'bg-emerald-500/50 dark:bg-emerald-500/30 text-emerald-400';
                      } else if (day.count > 5) {
                        colorClass = 'bg-emerald-500 dark:bg-emerald-400 text-emerald-100';
                      }

                      // Format date for tooltip
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
                          className={`w-[9px] h-[9px] rounded-[1.5px] transition-all duration-300 relative group cursor-pointer hover:ring-1 hover:ring-primary ${colorClass}`}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 pointer-events-none">
                            <div className="bg-popover border border-border text-popover-foreground text-[8px] font-bold py-1 px-1.5 rounded shadow-md whitespace-nowrap leading-tight">
                              {day.count === 0 ? 'No' : day.count} practice attempts on {formattedDate}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-muted-foreground pr-1 select-none">
            <span>Less</span>
            <div className="w-[9px] h-[9px] rounded-[1.5px] bg-secondary/40 dark:bg-neutral-800/30" />
            <div className="w-[9px] h-[9px] rounded-[1.5px] bg-emerald-500/20 dark:bg-emerald-500/10" />
            <div className="w-[9px] h-[9px] rounded-[1.5px] bg-emerald-500/50 dark:bg-emerald-500/30" />
            <div className="w-[9px] h-[9px] rounded-[1.5px] bg-emerald-500 dark:bg-emerald-400" />
            <span>More</span>
          </div>
        </div>

        {/* ─── Performance Trends ─── */}
        {trendData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accuracy Chart */}
            <div className="p-6 border border-border bg-card rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Mastery Progression</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Rolling accuracy over the last 15 MCQ practice attempts</p>
              </div>

              <div className="w-full">
                <svg className="w-full h-auto overflow-visible select-none" viewBox="0 0 500 180">
                  <defs>
                    <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines & labels */}
                  {[0, 25, 50, 75, 100].map((val) => {
                    const y = paddingTop + chartH - (val / 100) * chartH;
                    return (
                      <g key={val}>
                        <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="stroke-border/40" strokeWidth="1" strokeDasharray="3 3" />
                        <text x={paddingLeft - 8} y={y + 3} className="text-[9px] fill-muted-foreground font-bold text-right" textAnchor="end">{val}%</text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  {accAreaPath && (
                    <path d={accAreaPath} fill="url(#accGrad)" />
                  )}

                  {/* Line path */}
                  {accPath && (
                    <path d={accPath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(2,86,214,0.15)]" />
                  )}

                  {/* Vertices & tooltips */}
                  {accPoints.map((p, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle cx={p.x} cy={p.y} r="3.5" className="fill-card stroke-primary" strokeWidth="2" />
                      <circle cx={p.x} cy={p.y} r="7" className="fill-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {/* Tooltip */}
                      <foreignObject x={p.x - 55} y={p.y - 36} width="110" height="30" className="overflow-visible pointer-events-none hidden group-hover:block z-30">
                        <div className="bg-popover border border-border text-popover-foreground text-[8px] font-bold py-1 px-1.5 rounded shadow-md text-center leading-tight">
                          <p>{trendData[idx].rollingAccuracy}% Accuracy</p>
                          <p className="text-[7px] text-muted-foreground truncate">{trendData[idx].theoryTitle}</p>
                        </div>
                      </foreignObject>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Speed Chart */}
            <div className="p-6 border border-border bg-card rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Response Speed Curve</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Average time elapsed per question for the last 15 MCQ practice attempts</p>
              </div>

              <div className="w-full">
                <svg className="w-full h-auto overflow-visible select-none" viewBox="0 0 500 180">
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines & labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const val = Math.round(ratio * maxSpeedVal);
                    const y = paddingTop + chartH - ratio * chartH;
                    return (
                      <g key={ratio}>
                        <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="stroke-border/40" strokeWidth="1" strokeDasharray="3 3" />
                        <text x={paddingLeft - 8} y={y + 3} className="text-[9px] fill-muted-foreground font-bold text-right" textAnchor="end">{val}s</text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  {speedAreaPath && (
                    <path d={speedAreaPath} fill="url(#speedGrad)" />
                  )}

                  {/* Line path */}
                  {speedPath && (
                    <path d={speedPath} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(139,92,246,0.15)]" />
                  )}

                  {/* Vertices & tooltips */}
                  {speedPoints.map((p, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle cx={p.x} cy={p.y} r="3.5" className="fill-card stroke-[#8b5cf6]" strokeWidth="2" />
                      <circle cx={p.x} cy={p.y} r="7" className="fill-[#8b5cf6]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {/* Tooltip */}
                      <foreignObject x={p.x - 55} y={p.y - 36} width="110" height="30" className="overflow-visible pointer-events-none hidden group-hover:block z-30">
                        <div className="bg-popover border border-border text-popover-foreground text-[8px] font-bold py-1 px-1.5 rounded shadow-md text-center leading-tight">
                          <p>{trendData[idx].speedSeconds}s Response</p>
                          <p className="text-[7px] text-muted-foreground truncate">{trendData[idx].theoryTitle}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Weekly Activity columns */}
          <div className="p-6 border border-border bg-card rounded-2xl flex flex-col justify-between md:col-span-1 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-foreground">Weekly Practice Activity</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">MCQ attempts in the last 7 days</p>
            </div>
            <div className="flex justify-between items-end h-28 pt-6 px-1">
              {weeklyAttempts.map((count, index) => {
                const percent = Math.max(8, Math.min(100, (count / maxWeekly) * 100));
                return (
                  <div key={index} className="flex flex-col items-center flex-1 gap-1">
                    <div
                      className="w-4 bg-primary/20 hover:bg-primary rounded-t transition-all relative group"
                      style={{ height: `${percent}%` }}
                      title={`${count} attempts`}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[8px] font-bold px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono">
                        {count}
                      </span>
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground">{dayNames[index]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Theory Mastery Progress */}
          <div className="p-6 border border-border bg-card rounded-2xl md:col-span-2 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4">Domain Mastery</h3>
            {theoryMastery.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                Complete MCQ attempts to populate domain estimates.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[140px] overflow-y-auto pr-1">
                {theoryMastery.map((tm) => (
                  <div key={tm.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground truncate max-w-[200px]" title={tm.title}>
                        {tm.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium font-mono">
                        {tm.correct}/{tm.total} Correct ({tm.accuracy}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border">
                      <div
                        className={`h-full transition-all duration-500 ${tm.accuracy >= 80
                          ? 'bg-emerald-500'
                          : tm.accuracy >= 50
                            ? 'bg-amber-500'
                            : 'bg-destructive'
                          }`}
                        style={{ width: `${tm.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gamified Achievements Grid */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Accomplishments</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Badges unlocked through active learning</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-4 border rounded-xl bg-card flex gap-3.5 items-center relative transition-all ${ach.unlocked
                  ? 'border-primary/20 bg-primary/[0.02] shadow-sm'
                  : 'border-border/60 opacity-60 bg-secondary/10'
                  }`}
              >
                <div className="text-2xl shrink-0 select-none">{ach.icon}</div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>{ach.title}</span>
                    {ach.unlocked ? (
                      <span className="text-[9px] font-bold text-emerald-500 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground uppercase bg-secondary px-1.5 py-0.5 rounded">
                        Locked
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-muted-foreground/90 mt-0.5 leading-snug">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
