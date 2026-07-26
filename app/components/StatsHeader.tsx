'use client';

import React from 'react';
import { xpToLevel } from '@/lib/utils';
import { useCountUp } from '@/lib/useCountUp';
import Image from 'next/image';

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
  // Animate stats values
  const animatedStreak = useCountUp(streak, 800);
  const animatedAccuracy = useCountUp(accuracy, 800);
  const animatedXp = useCountUp(xp, 1000);

  // Compute level details based on current animated XP
  const levelInfo = xpToLevel(animatedXp);
  const targetLevelInfo = xpToLevel(xp);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greetingText = `${getGreeting()}, ${role === 'admin' ? 'Admin' : 'Learner'}! 👋`;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 gap-6">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-3xl font-extrabold font-inria text-primary flex items-center gap-2">{greetingText}</h1>
        <p className="text-sm font-inria text-foreground">{description}</p>
      </div>

      <div className="hidden md:flex flex-wrap items-center gap-4 sm:gap-6 bg-card border border-border/85 rounded-2xl p-3 px-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] shrink-0 relative overflow-hidden backdrop-blur-sm glass-card">
        {/* Streak */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl  text-orange-500 font-bold select-none text-base relative">
            <span className={streak > 0 ? "animate-gentle-shake" : ""}>
              <Image
                src="/icons/bonfire.svg"
                alt="Bonfire Icon"
                width={30}
                height={30}
                className="w-7 h-7 "
              />
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-foreground leading-tight">{animatedStreak}</div>
            <p className="text-xs text-muted-foreground/80 font-bold font-inria uppercase tracking-wider">Day Streak</p>
          </div>
        </div>

        <div className="hidden sm:block border-l border-border/80 h-8" />

        {/* Accuracy */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl  text-emerald-500 font-bold select-none text-base relative">
            <Image
              src="/icons/accuracy.svg"
              alt="Accuracy Icon"
              width={30}
              height={30}
              className="w-7 h-7"
            />
          </div>
          <div>
            <div className={`text-sm font-bold leading-tight ${accuracy >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>{animatedAccuracy}%</div>
            <p className="text-xs text-muted-foreground/80 font-bold font-inria uppercase tracking-wider">Accuracy</p>
          </div>
        </div>

        <div className="hidden sm:block border-l border-border/80 h-8" />

        {/* Level Progress */}
        <div className="flex items-center gap-4">
          <div className="text-left">
            <div className="flex items-center justify-between gap-6 text-xs font-bold text-foreground">
              <span className="font-inria">Level {targetLevelInfo.level}</span>
              <span className="text-xs text-muted-foreground/85 font-bold font-inria uppercase tracking-wider">{levelInfo.currentXp}/{levelInfo.requiredXp} XP</span>
            </div>
            <div className="w-32 sm:w-40 h-2 bg-secondary rounded-full overflow-hidden border border-border/70 mt-1 relative">
              <div
                className="h-full bg-gradient-to-r from-slate-400/50 via-slate-500/50 to-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, (levelInfo.currentXp / levelInfo.requiredXp) * 100)}%` }} />
            </div>
          </div>

          {/* Star badge */}
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
  );
}
