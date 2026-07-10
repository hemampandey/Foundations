'use client';

import Link from 'next/link';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
        <HelpCircle className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold font-display text-foreground mb-2">
        Page Not Found
      </h2>

      <p className="text-sm text-muted-foreground max-w-md mb-6">
        The page you are looking for doesn&apos;t exist or has been moved. 
        You can navigate back to the dashboard to resume your theory training.
      </p>

      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-md shadow-primary/10 text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
