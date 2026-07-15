'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface BrowseScheduleItem {
  user_id: string;
  question_id: string;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  repetitions: number;
  created_at: string;
  questions: {
    id: string;
    stem: string;
    difficulty: number;
    bloom_level: string;
    theories: {
      id: string;
      title: string;
    } | null;
  } | null;
}

interface BrowseTabProps {
  allSchedules: BrowseScheduleItem[];
  loadingSchedules: boolean;
  theoryOptions: string[];
}

export default function BrowseTab({
  allSchedules,
  loadingSchedules,
  theoryOptions
}: BrowseTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheory, setSelectedTheory] = useState('');
  const [expandedStems, setExpandedStems] = useState<Record<string, boolean>>({});

  const toggleStem = (qId: string) => {
    setExpandedStems(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const getDueStatus = (dueAtStr: string) => {
    const due = new Date(dueAtStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Overdue', color: 'text-rose-600 bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20' };
    if (diffDays === 0) return { label: 'Due Today', color: 'text-amber-600 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20' };
    return { label: `Due in ${diffDays}d`, color: 'text-muted-foreground bg-secondary/80 border-border/60' };
  };

  const filtered = allSchedules.filter(item => {
    if (!item.questions) return false;
    const matchesSearch = item.questions.stem.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTheory = selectedTheory === '' || item.questions.theories?.title === selectedTheory;
    return matchesSearch && matchesTheory;
  });

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-secondary/30 border border-border/80 p-4 rounded-2xl">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search review questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-card border border-border focus:border-indigo-500 outline-none transition-all placeholder:text-muted-foreground/70"
          />
        </div>
        {/* Theory select dropdown */}
        <div className="relative min-w-[200px]">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedTheory}
            onChange={(e) => setSelectedTheory(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-card border border-border appearance-none focus:border-indigo-500 outline-none transition-all cursor-pointer font-medium"
          >
            <option value="">All Theories</option>
            {theoryOptions.map((title, idx) => (
              <option key={idx} value={title}>{title}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Items count summary */}
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
        Total items tracked: {allSchedules.length}
      </div>

      {/* Schedules list */}
      {loadingSchedules ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground">
          <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-35" />
          <p className="text-xs font-semibold">No tracked items matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, idx) => {
            const q = item.questions!;
            const isExpanded = expandedStems[q.id] || false;
            const status = getDueStatus(item.due_at);

            return (
              <div key={idx} className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-all flex flex-col justify-between space-y-3 shadow-sm relative">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Question Stem */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center flex-wrap gap-1.5 text-[9px] font-extrabold uppercase">
                      <span className="px-2 py-0.5 rounded bg-secondary text-foreground tracking-wider">
                        {q.theories?.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 tracking-wider">
                        {q.bloom_level}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
                        L{q.difficulty}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                      {isExpanded ? q.stem : (
                        <p className="line-clamp-2">{q.stem}</p>
                      )}
                    </div>

                    {q.stem.length > 150 && (
                      <button
                        onClick={() => toggleStem(q.id)}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer mt-1"
                      >
                        {isExpanded ? (
                          <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>Expand Question <ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Due status pill */}
                  <div className={`text-[10px] font-extrabold px-3 py-1 rounded-full border self-start shrink-0 font-mono ${status.color}`}>
                    {status.label}
                  </div>
                </div>

                {/* SM-2 intervals state */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 border-t border-border/40 text-[10px] font-bold text-muted-foreground/80 font-mono">
                  <div className="flex items-center gap-1">
                    <span>Interval:</span>
                    <span className="text-foreground font-extrabold">{item.interval_days}d</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Repetitions:</span>
                    <span className="text-foreground font-extrabold">{item.repetitions}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Ease Factor:</span>
                    <span className="text-foreground font-extrabold">{item.ease_factor}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:ml-auto">
                    <span>Next Review:</span>
                    <span className="text-foreground font-extrabold">
                      {new Date(item.due_at).toLocaleDateString(undefined, { dateStyle: 'short' })}
                    </span>
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
