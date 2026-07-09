'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import ErrorBoundary from '@/app/components/ErrorBoundary';

export default function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith('/auth');

  return (
    <main className={isAuth ? "flex-1 h-full overflow-y-auto" : "main-scroll-area"}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </main>
  );
}
