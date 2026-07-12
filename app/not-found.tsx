'use client';

import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6 animate-fade-in">
      <div className="relative flex items-center justify-center w-20 h-20 bg-indigo-500/10 text-indigo-500 rounded-3xl select-none mb-2 shadow-sm">
        <Compass className="w-10 h-10 animate-pulse" />
      </div>

      <div className="space-y-2 max-w-sm">
        <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">
          404 Error
        </span>
        <h1 className="text-2xl font-extrabold text-foreground font-display mt-3">
          Page Not Found
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The page you are looking for doesn&rsquo;t exist, or has been moved to a new destination.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-95 transition-all shadow-md shadow-primary/15 cursor-pointer"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
