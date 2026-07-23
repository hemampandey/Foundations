'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Menu, WifiOff } from 'lucide-react';
import { useProfile } from '@/app/components/ProfileProvider';
import { xpToLevel } from '@/lib/utils';

export default function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isPublicPage = pathname === '/' || pathname?.startsWith('/auth');
  const isPracticePage = pathname === '/practice';
  const validPaths = ['/', '/auth', '/dashboard', '/progress', '/practice', '/admin', '/review'];
  const is404 = pathname ? !validPaths.some(p => pathname === p || pathname.startsWith(p + '/')) : false;
  const hideSidebar = isPublicPage || is404 || isPracticePage;
  const { profile, progress, accuracy } = useProfile();

  const [isOffline, setIsOffline] = useState(
    typeof window !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      {!hideSidebar && (
        <Suspense fallback={<div className="w-[230px] bg-card border-r border-border shrink-0 hidden md:block" />}>
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        </Suspense>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {isOffline && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2 select-none animate-fade-in shrink-0">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>You are currently offline. Spaced repetition learning sync is paused.</span>
          </div>
        )}
        {/* Mobile Header (only visible on mobile screens) */}
        {!hideSidebar && (
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
              <div className="skeleton h-6 w-32 rounded-full" />
            )}

            <div className="w-8 h-8 shrink-0" /> {/* Balance spacer */}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
