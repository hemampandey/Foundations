'use client';

import React, { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Menu } from 'lucide-react';
import { useProfile } from '@/app/components/ProfileProvider';
import { xpToLevel } from '@/lib/utils';

export default function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isPublicPage = pathname === '/' || pathname?.startsWith('/auth');
  const validPaths = ['/', '/auth', '/dashboard', '/progress', '/practice', '/admin', '/review'];
  const is404 = pathname ? !validPaths.some(p => pathname === p || pathname.startsWith(p + '/')) : false;
  const { profile, progress, accuracy } = useProfile();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  const streak = progress?.streak_days ?? 0;
  const xp = progress?.xp ?? 0;
  const levelInfo = xpToLevel(xp);

  return (
    <div className="app-inner-canvas flex flex-col md:flex-row">
      {/* Sidebar (receives mobileOpen state for mobile overlay mode) */}
      {!isPublicPage && !is404 && (
        <Suspense fallback={<div className="w-[230px] bg-card border-r border-border shrink-0 hidden md:block" />}>
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        </Suspense>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header (only visible on mobile screens) */}
        {!isPublicPage && !is404 && (
          <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-border bg-card shrink-0 z-30 select-none">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-all cursor-pointer shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {profile ? (
              <div className="flex items-center gap-3 bg-secondary/60 border border-border/80 rounded-full px-3 py-1 text-[11px] font-bold">
                {/* Streak */}
                <div className="flex items-center gap-1">
                  <span>🔥</span>
                  <span>{streak}</span>
                </div>

                {/* Divider */}
                <div className="w-[1px] h-3 bg-border/80" />

                {/* Accuracy */}
                <div className="flex items-center gap-1">
                  <span>🎯</span>
                  <span>{accuracy}%</span>
                </div>

                {/* Divider */}
                <div className="w-[1px] h-3 bg-border/80" />

                {/* Level */}
                <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                  <span>Lvl {levelInfo.level}</span>
                  <div className="w-10 h-1.5 bg-secondary/80 rounded-full overflow-hidden border border-border/70">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-pink-500"
                      style={{ width: `${Math.min(100, (levelInfo.currentXp / levelInfo.requiredXp) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">Loading Profile...</span>
            )}

            <div className="w-8 h-8 shrink-0" /> {/* Balance spacer */}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
