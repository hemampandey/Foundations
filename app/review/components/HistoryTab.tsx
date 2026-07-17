'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Clock, BarChart3, Fingerprint, Calendar, FileText, CheckCircle2, ListFilter, HelpCircle, History } from 'lucide-react';

interface HistoryAttemptItem {
  id: string;
  is_correct: boolean;
  response_ms: number;
  created_at: string;
  questions: {
    id: string;
    stem: string;
    difficulty: number;
    bloom_level: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheory, setSelectedTheory] = useState('');
  const [selectedResult, setSelectedResult] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '7days' | '30days'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Aggregate unique theory options from attempts
  const theoryOptions = React.useMemo(() => {
    const options = new Set<string>();
    historyAttempts.forEach(item => {
      const title = item.questions?.theories?.title;
      if (title) options.add(title);
    });
    return Array.from(options);
  }, [historyAttempts]);

  // ── Filters Mapping ──
  const filteredAttempts = React.useMemo(() => {
    return historyAttempts.filter(item => {
      const q = item.questions;
      if (!q) return false;

      // Text Search
      const matchesSearch = q.stem.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (q.theories?.title ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      // Theory Dropdown
      const matchesTheory = selectedTheory === '' || q.theories?.title === selectedTheory;

      // Result Dropdown
      const matchesResult = selectedResult === 'all' ||
                            (selectedResult === 'correct' && item.is_correct) ||
                            (selectedResult === 'incorrect' && !item.is_correct);

      // Date Range Dropdown
      let matchesDate = true;
      if (selectedDateRange !== 'all') {
        const created = new Date(item.created_at);
        const limitDate = new Date();
        if (selectedDateRange === '7days') {
          limitDate.setDate(limitDate.getDate() - 7);
        } else if (selectedDateRange === '30days') {
          limitDate.setDate(limitDate.getDate() - 30);
        }
        matchesDate = created >= limitDate;
      }

      return matchesSearch && matchesTheory && matchesResult && matchesDate;
    });
  }, [historyAttempts, searchQuery, selectedTheory, selectedResult, selectedDateRange]);

  // ── Pagination Calculation ──
  const totalItems = filteredAttempts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pagedAttempts = React.useMemo(() => {
    return filteredAttempts.slice(startIndex, endIndex);
  }, [filteredAttempts, startIndex, endIndex]);

  // Group current page's attempts by date
  const groupedAttempts = React.useMemo(() => {
    const groups: Record<string, HistoryAttemptItem[]> = {};
    pagedAttempts.forEach(item => {
      const key = getDayGroupKey(item.created_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [pagedAttempts]);

  // Helper to format date headers
  function getDayGroupKey(createdAtStr: string) {
    const d = new Date(createdAtStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const todayStr = today.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const yesterdayStr = yesterday.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    
    if (dStr === todayStr) {
      return `Today - ${dStr}`;
    } else if (dStr === yesterdayStr) {
      return `Yesterday - ${dStr}`;
    }
    return dStr;
  }

  // Helper to generate page lists for pagination controls
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) pages.push(i);
      }
      
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6 w-full text-left">
      {/* ─── Top Filter Row ─── */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        {/* Search */}
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topics or questions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl bg-card border border-border focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60 shadow-sm"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
          {/* Topics Selector */}
          <div className="relative flex-1 md:min-w-[150px]">
            <ListFilter className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedTheory}
              onChange={(e) => {
                setSelectedTheory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
            >
              <option value="">All Topics</option>
              {theoryOptions.map((title, idx) => (
                <option key={idx} value={title}>{title}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Results Selector */}
          <div className="relative flex-1 md:min-w-[140px]">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedResult}
              onChange={(e) => {
                setSelectedResult(e.target.value as 'all' | 'correct' | 'incorrect');
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
            >
              <option value="all">All Results</option>
              <option value="correct">Correct Only</option>
              <option value="incorrect">Incorrect Only</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Range Selector */}
          <div className="relative flex-1 md:min-w-[180px]">
            <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedDateRange}
              onChange={(e) => {
                setSelectedDateRange(e.target.value as 'all' | '7days' | '30days');
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── Grouped Cards Lists ─── */}
      {loadingHistory ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : totalItems === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground font-serif">
          <History className="w-8 h-8 mx-auto mb-2 opacity-35" />
          <p className="text-xs font-semibold">No recent review attempts found matching filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAttempts).map(([dateHeader, attempts]) => (
            <div key={dateHeader} className="space-y-3">
              {/* Date Group Header */}
              <h4 className="text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-wider pl-1 font-serif">
                {dateHeader}
              </h4>

              {/* Stacked Cards for this date */}
              <div className="space-y-3">
                {attempts.map((attempt) => {
                  const q = attempt.questions!;
                  const isCorrect = attempt.is_correct;
                  const timeStr = new Date(attempt.created_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  });

                  // Left Icon configurations
                  let iconBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
                  let IconComponent = FileText;

                  if (isCorrect) {
                    if (q.difficulty >= 3) {
                      iconBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
                      IconComponent = BarChart3;
                    } else {
                      iconBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                      IconComponent = HelpCircle;
                    }
                  }

                  // Short code ID generator
                  const shortId = `Q-${q.id.slice(0, 5).toUpperCase()}`;

                  return (
                    <div
                      key={attempt.id}
                      className="bg-card border border-border/80 rounded-xl p-4 hover:shadow-md transition-all flex flex-col md:flex-row items-stretch gap-4 relative overflow-hidden"
                    >
                      {/* Left icon wrapper */}
                      <div className="flex md:items-center justify-start shrink-0">
                        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shadow-sm`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Middle main textual metadata details */}
                      <div className="flex-1 space-y-1.5 min-w-0 pr-2">
                        <div className="flex items-center gap-2.5 text-[9px] font-extrabold uppercase">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold tracking-wider">
                            {q.theories?.title ?? 'CARS'}
                          </span>
                          <span className="text-muted-foreground/75 font-semibold font-mono">
                            {timeStr}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-foreground leading-snug line-clamp-2">
                          {q.stem}
                        </p>

                        {/* Speed, Difficulty, ID line */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[9px] font-bold text-muted-foreground/80 font-serif select-none">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                            <span>Speed: {(attempt.response_ms / 1000).toFixed(1)}s</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/50" />
                            <span>Level: L{q.difficulty}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Fingerprint className="w-3.5 h-3.5 text-muted-foreground/50" />
                            <span>ID: {shortId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right side status badge */}
                      <div className="flex md:flex-row items-center justify-between md:justify-center gap-4 border-t md:border-t-0 border-border/40 pt-3 md:pt-0 shrink-0 select-none">
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-3 py-1 rounded-full border ${
                            isCorrect
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-900/20'
                              : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/15 dark:text-rose-400 dark:border-rose-900/20'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{isCorrect ? 'Correct (+10 XP)' : 'Incorrect (+2 XP)'}</span>
                          </div>
                        </div>

                        {/* Next Navigation Chevron */}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/75" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ─── Bottom Pagination controls ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-center border-t border-border/40 pt-5 gap-4 select-none">
            {/* Page number selector buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-secondary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {getPageNumbers().map((pageNum, idx) => {
                if (pageNum === '...') {
                  return (
                    <span key={idx} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      ...
                    </span>
                  );
                }

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(pageNum as number)}
                    className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-secondary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Page items size selector */}
            <div className="relative min-w-[120px] self-end sm:self-center">
              <ListFilter className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
