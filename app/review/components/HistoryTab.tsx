'use client';

import React from 'react';
import { History, Clock } from 'lucide-react';

interface HistoryAttemptItem {
  id: string;
  is_correct: boolean;
  response_ms: number;
  created_at: string;
  questions: {
    stem: string;
    theories: {
      title: string;
    } | null;
  } | null;
}

interface HistoryTabProps {
  historyAttempts: HistoryAttemptItem[];
  loadingHistory: boolean;
}

export default function HistoryTab({
  historyAttempts,
  loadingHistory
}: HistoryTabProps) {
  return (
    <div className="space-y-4">
      {loadingHistory ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : historyAttempts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground">
          <History className="w-8 h-8 mx-auto mb-2 opacity-35" />
          <p className="text-xs font-semibold">No recent review attempts found</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {historyAttempts.map((attempt, idx) => {
            const isCorrect = attempt.is_correct;
            const formattedDate = new Date(attempt.created_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            });
            const q = attempt.questions;

            return (
              <div key={idx} className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-all flex flex-col justify-between space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Domain tag */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-secondary text-foreground tracking-wider">
                        {q?.theories?.title ?? 'Review'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/75 font-medium">{formattedDate}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground font-semibold leading-relaxed line-clamp-1">
                      {q?.stem}
                    </p>
                  </div>

                  {/* Correct / Incorrect pill */}
                  <div className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                    isCorrect 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' 
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {isCorrect ? 'Correct (+10 XP)' : 'Incorrect (+2 XP)'}
                  </div>
                </div>

                {/* Meta speeds */}
                <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground/70 border-t border-border/40 pt-2 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                    <span>Speed: {(attempt.response_ms / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
