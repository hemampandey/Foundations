'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Global Error Boundary — catches unhandled errors in any route segment.
 * Prevents the entire app from crashing to a white screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Foundations] Unhandled error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold font-display text-foreground mb-2">
        Something went wrong
      </h2>

      <p className="text-sm text-muted-foreground max-w-md mb-6">
        An unexpected error occurred. This has been logged. You can try again or
        navigate back to the dashboard.
      </p>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-md shadow-primary/10"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <a
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all cursor-pointer border border-border"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
