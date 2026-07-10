'use client';

import React from 'react';
import { xpToLevel } from '@/lib/utils';

interface StatsHeaderProps {
  role?: 'admin' | 'learner';
  streak: number;
  accuracy: number;
  xp: number;
  description: string;
}

export default function StatsHeader({
  role = 'learner',
  streak,
  accuracy,
  xp,
  description,
}: StatsHeaderProps) {
  const levelInfo = xpToLevel(xp);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greetingText = `${getGreeting()}, ${role === 'admin' ? 'Admin' : 'Learner'}! 👋`;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-6 gap-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold font-display text-foreground tracking-tight flex items-center gap-2">
          {greetingText}
        </h1>
        <p className="text-xs sm:text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        {/* Streak */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-base sm:text-lg font-bold text-foreground">
            <span>🔥</span>
            <span>{streak}</span>
          </div>
          <p className="text-[9px] text-muted-foreground/80 font-bold uppercase tracking-wider mt-0.5">Day Streak</p>
        </div>

        <div className="border-l border-border h-8 shrink-0" />

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-base sm:text-lg font-bold text-foreground">
            <span>🎯</span>
            <span className={accuracy >= 60 ? "text-emerald-500" : "text-rose-500"}>{accuracy}%</span>
          </div>
          <p className="text-[9px] text-muted-foreground/80 font-bold uppercase tracking-wider mt-0.5">Accuracy</p>
        </div>

        <div className="border-l border-border h-8 shrink-0" />

        {/* Level Progress */}
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-foreground">
              <span>Level {levelInfo.level}</span>
              <span className="text-[10px] text-muted-foreground/85 font-mono">
                {levelInfo.currentXp} / {levelInfo.requiredXp} XP
              </span>
            </div>
            <div className="w-40 sm:w-44 h-2 bg-secondary rounded-full overflow-hidden border border-border mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-[#9b51e0] to-[#7f00ff] transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, (levelInfo.currentXp / levelInfo.requiredXp) * 100)}%` }}
              />
            </div>
          </div>

          {/* Star badge */}
          <div className="relative flex items-center justify-center shrink-0 w-10 h-10 select-none">
            <svg className="w-10 h-10 drop-shadow-[0_2px_8px_rgba(155,81,224,0.3)] animate-pulse" viewBox="0 0 100 100">
              <polygon points="50,0 93,25 93,75 50,100 7,75 7,25" fill="#7f00ff" />
              <polygon points="50,6 87,28 87,72 50,94 13,72 13,28" fill="#9b51e0" />
              <polygon points="50,12 81,30 81,70 50,88 19,70 19,30" fill="url(#purpleGrad)" />
              <path d="M50,28 L54,39 L66,39 L56,47 L60,58 L50,51 L40,58 L44,47 L34,39 L46,39 Z" fill="#ffffff" />
              <defs>
                <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#b800ff" />
                  <stop offset="100%" stopColor="#7f00ff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
