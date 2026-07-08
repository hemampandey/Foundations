import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from '@/app/components/Sidebar';
import ErrorBoundary from '@/app/components/ErrorBoundary';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Foundations | Counselling Theory Mastery Trainer',
  description:
    'Build durable conceptual mastery of counselling theories through adaptive, spaced-repetition journeys.',
  openGraph: {
    title: 'Foundations',
    description: 'Theory-mastery trainer for mental health professionals.',
    siteName: 'Foundations',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0256d6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch (_) {}
        ` }} />
      </head>
      <body className="min-h-full text-foreground bg-background font-sans">
        <div className="app-viewport-frame">
          <div className="app-inner-canvas">
            <Suspense fallback={<div className="w-16 bg-card border-r border-border shrink-0" />}>
              <Sidebar />
            </Suspense>
            <main className="main-scroll-area">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
