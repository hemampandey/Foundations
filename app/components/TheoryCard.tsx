'use client';

import React from 'react';
import { pickGradient } from '@/lib/utils';

// TheoryCard 

interface AvatarProps {
  name: string;
  seed: string;
  heightClass?: string;
  label?: string;
}

/**
 * Gradient hero section with initials badge.
 * Used at the top of theory and practice cards.
 */
export function TheoryCardHero({ name, seed, heightClass = 'h-48', label = 'Scenario Profile' }: AvatarProps) {
  const gradient = pickGradient(seed);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className={`w-full ${heightClass} bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative overflow-hidden`}
    >
      {/* Decorative blurred shapes */}
      <div className="absolute w-72 h-72 rounded-full bg-white/10 -top-12 -left-12 blur-2xl" />
      <div className="absolute w-72 h-72 rounded-full bg-black/10 -bottom-12 -right-12 blur-2xl" />

      {/* Initials badge */}
      <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
        {initials}
      </div>

      {/* Corner label */}
      <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-widest text-white/50 font-bold select-none">
        {label}
      </div>
    </div>
  );
}
