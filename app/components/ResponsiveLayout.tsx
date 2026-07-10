'use client';

import React, { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Menu } from 'lucide-react';

export default function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isAuth = pathname?.startsWith('/auth');

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="app-inner-canvas flex flex-col md:flex-row">
      {/* Sidebar (receives mobileOpen state for mobile overlay mode) */}
      {!isAuth && (
        <Suspense fallback={<div className="w-[230px] bg-card border-r border-border shrink-0 hidden md:block" />}>
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        </Suspense>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header (only visible on mobile screens) */}
        {!isAuth && (
          <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-border bg-[#f9f9fb] dark:bg-[#0b0f19] shrink-0 z-30">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-all cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display font-bold text-sm tracking-tight text-foreground select-none">
              Foundations
            </span>
            <div className="w-8 h-8" /> {/* Balance spacer */}
          </header>
        )}

        {children}
      </div>
    </div>
  );
}
