import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inria_Sans } from 'next/font/google';
import './globals.css';
import ProfileProvider from '@/app/components/ProfileProvider';
import ResponsiveLayout from '@/app/components/ResponsiveLayout';
import MainContentWrapper from '@/app/components/MainContentWrapper';
import ToastProvider from '@/app/components/ToastProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const inriaSans = Inria_Sans({
  variable: '--font-inria-sans',
  subsets: ['latin'],
  weight: ['300', '400', '700'],
});

export const metadata: Metadata = {
  title: 'Foundations | Theory Mastery Trainer',
  description:
    'Build durable conceptual mastery of theories through adaptive, spaced-repetition journeys.',
  robots: {
    index: false,
    follow: false,
  },
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
      className={`${geistSans.variable} ${geistMono.variable} ${inriaSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch (_) {}
        ` }} />
      </head>
      <body className="min-h-full text-foreground bg-background font-sans">
        <div className="app-viewport-frame">
          <ProfileProvider>
            <ToastProvider>
              <ResponsiveLayout>
                <MainContentWrapper>{children}</MainContentWrapper>
              </ResponsiveLayout>
            </ToastProvider>
          </ProfileProvider>
        </div>
      </body>
    </html>
  );
}
