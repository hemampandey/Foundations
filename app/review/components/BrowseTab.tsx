'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, MoreVertical, BookOpen, BarChart3, Users, Calendar, Bookmark, ListFilter, CheckSquare, SlidersHorizontal } from 'lucide-react';

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
  const [activePillFilter, setActivePillFilter] = useState<'today' | 'tomorrow' | 'week' | 'later' | 'mastered'>('today');
  const [expandedStems, setExpandedStems] = useState<Record<string, boolean>>({});

  const toggleStem = (qId: string) => {
    setExpandedStems(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // ── Date Boundary Calculations ──
  const now = new Date();
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  // ── Category Count Calculations ──
  const countToday = allSchedules.filter(s => new Date(s.due_at) <= todayEnd).length;
  const countTomorrow = allSchedules.filter(s => {
    const due = new Date(s.due_at);
    return due >= tomorrowStart && due <= tomorrowEnd;
  }).length;
  const countWeek = allSchedules.filter(s => {
    const due = new Date(s.due_at);
    return due >= now && due <= weekEnd;
  }).length;
  const countLater = allSchedules.filter(s => new Date(s.due_at) > weekEnd).length;
  const countMastered = allSchedules.filter(s => s.repetitions >= 4 || s.interval_days >= 15).length;

  // ── Filters & Filters Matching ──
  const filtered = allSchedules.filter(item => {
    if (!item.questions) return false;
    
    // Search Query (Stems & Theory Title)
    const matchesSearch = item.questions.stem.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.questions.theories?.title ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    
    // Theory dropdown select
    const matchesTheory = selectedTheory === '' || item.questions.theories?.title === selectedTheory;
    
    // Status category matching
    let matchesStatus = true;
    const due = new Date(item.due_at);
    
    if (activePillFilter === 'today') {
      matchesStatus = due <= todayEnd;
    } else if (activePillFilter === 'tomorrow') {
      matchesStatus = due >= tomorrowStart && due <= tomorrowEnd;
    } else if (activePillFilter === 'week') {
      matchesStatus = due >= now && due <= weekEnd;
    } else if (activePillFilter === 'later') {
      matchesStatus = due > weekEnd;
    } else if (activePillFilter === 'mastered') {
      matchesStatus = item.repetitions >= 4 || item.interval_days >= 15;
    }
    
    return matchesSearch && matchesTheory && matchesStatus;
  });

  // Safe helper to extract relative last seen time
  const getLastSeenText = (createdAtStr: string, reps: number) => {
    if (reps === 0) return 'Never seen';
    const created = new Date(createdAtStr);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    
    if (diffDays <= 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.round(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    return '1 month ago';
  };

  // Helper to format due badge on the right
  const getDueBadgeInfo = (dueAtStr: string, reps: number, intervalDays: number) => {
    const due = new Date(dueAtStr);
    if (reps >= 4 || intervalDays >= 15) {
      return {
        label: 'Mastered',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-900/20',
        nextText: 'Fully Rescheduled'
      };
    }
    if (due <= todayEnd) {
      return {
        label: 'Due Today',
        color: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/15 dark:text-rose-400 dark:border-rose-900/20',
        nextText: 'Today'
      };
    }
    if (due >= tomorrowStart && due <= tomorrowEnd) {
      return {
        label: 'Due Tomorrow',
        color: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/15 dark:text-purple-400 dark:border-purple-900/20',
        nextText: 'Tomorrow'
      };
    }
    if (due > tomorrowEnd && due <= weekEnd) {
      return {
        label: 'This Week',
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/15 dark:text-indigo-400 dark:border-indigo-900/20',
        nextText: due.toLocaleDateString(undefined, { weekday: 'short' })
      };
    }
    return {
      label: 'Later',
      color: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-neutral-800/40 dark:text-slate-400 dark:border-border/60',
      nextText: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    };
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl bg-card border border-border focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60 shadow-sm"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex gap-3 w-full md:w-auto">
          {/* Topics Selector */}
          <div className="relative flex-1 md:min-w-[180px]">
            <ListFilter className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedTheory}
              onChange={(e) => setSelectedTheory(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
            >
              <option value="">All Topics</option>
              {theoryOptions.map((title, idx) => (
                <option key={idx} value={title}>{title}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Selector */}
          <div className="relative flex-1 md:min-w-[160px]">
            <CheckSquare className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={activePillFilter}
              onChange={(e) => setActivePillFilter(e.target.value as 'today' | 'tomorrow' | 'week' | 'later' | 'mastered')}
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
            >
              <option value="today">All Status</option>
              <option value="today">Due Today</option>
              <option value="tomorrow">Due Tomorrow</option>
              <option value="week">Due This Week</option>
              <option value="later">Later</option>
              <option value="mastered">Mastered</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── Filter Pills Bar ─── */}
      <div className="flex flex-wrap gap-2.5 pb-2 border-b border-border/40 select-none">
        {/* Due Today Pill */}
        <button
          onClick={() => setActivePillFilter('today')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-bold font-inria transition-all cursor-pointer ${
            activePillFilter === 'today'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'bg-secondary/40 text-muted-foreground border border-transparent hover:bg-secondary/60 hover:text-foreground'
          }`}
        >
          <span>Due Today</span>
          <span className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full text-[9px] font-bold font-mono px-1 ${
            activePillFilter === 'today' ? 'bg-primary text-white' : 'bg-secondary-foreground/10 text-muted-foreground'
          }`}>{countToday}</span>
        </button>

        {/* Due Tomorrow Pill */}
        <button
          onClick={() => setActivePillFilter('tomorrow')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-bold font-inria transition-all cursor-pointer ${
            activePillFilter === 'tomorrow'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'bg-secondary/40 text-muted-foreground border border-transparent hover:bg-secondary/60 hover:text-foreground'
          }`}
        >
          <span>Due Tomorrow</span>
          <span className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full text-[9px] font-bold font-mono px-1 ${
            activePillFilter === 'tomorrow' ? 'bg-primary text-white' : 'bg-secondary-foreground/10 text-muted-foreground'
          }`}>{countTomorrow}</span>
        </button>

        {/* Due This Week Pill */}
        <button
          onClick={() => setActivePillFilter('week')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-bold font-inria transition-all cursor-pointer ${
            activePillFilter === 'week'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'bg-secondary/40 text-muted-foreground border border-transparent hover:bg-secondary/60 hover:text-foreground'
          }`}
        >
          <span>Due This Week</span>
          <span className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full text-[9px] font-bold font-mono px-1 ${
            activePillFilter === 'week' ? 'bg-primary text-white' : 'bg-secondary-foreground/10 text-muted-foreground'
          }`}>{countWeek}</span>
        </button>

        {/* Later Pill */}
        <button
          onClick={() => setActivePillFilter('later')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-bold font-inria transition-all cursor-pointer ${
            activePillFilter === 'later'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'bg-secondary/40 text-muted-foreground border border-transparent hover:bg-secondary/60 hover:text-foreground'
          }`}
        >
          <span>Later</span>
          <span className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full text-[9px] font-bold font-mono px-1 ${
            activePillFilter === 'later' ? 'bg-primary text-white' : 'bg-secondary-foreground/10 text-muted-foreground'
          }`}>{countLater}</span>
        </button>

        {/* Mastered Pill */}
        <button
          onClick={() => setActivePillFilter('mastered')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-bold font-inria transition-all cursor-pointer ${
            activePillFilter === 'mastered'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'bg-secondary/40 text-muted-foreground border border-transparent hover:bg-secondary/60 hover:text-foreground'
          }`}
        >
          <span>Mastered</span>
          <span className={`inline-flex items-center justify-center min-w-5 h-5 rounded-full text-[9px] font-bold font-mono px-1 ${
            activePillFilter === 'mastered' ? 'bg-primary text-white' : 'bg-secondary-foreground/10 text-muted-foreground'
          }`}>{countMastered}</span>
        </button>
      </div>

      {/* ─── Cards Grid ─── */}
      {loadingSchedules ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground font-serif">
          <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-35" />
          <p className="text-xs font-semibold">No tracked items matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item, idx) => {
            const q = item.questions!;
            const isExpanded = expandedStems[q.id] || false;
            const dueInfo = getDueBadgeInfo(item.due_at, item.repetitions, item.interval_days);

            // Left Border Strip Color Mapping based on difficulty / category
            let borderLeftColor = 'border-l-blue-500/80';
            let iconBg = 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
            let IconComponent = BookOpen;

            if (q.difficulty === 4 || q.bloom_level === 'EVALUATE' || q.bloom_level === 'CREATE') {
              borderLeftColor = 'border-l-rose-500';
              iconBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
              IconComponent = Users;
            } else if (q.difficulty === 3 || q.bloom_level === 'ANALYZE') {
              borderLeftColor = 'border-l-amber-500';
              iconBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
              IconComponent = BarChart3;
            } else if (q.difficulty === 2 || q.bloom_level === 'UNDERSTAND') {
              borderLeftColor = 'border-l-yellow-500';
              iconBg = 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500';
              IconComponent = Bookmark;
            }

            return (
              <div
                key={idx}
                className={`bg-card border border-border/80 border-l-[3.5px] ${borderLeftColor} rounded-xl p-5 hover:shadow-md transition-all flex flex-col md:flex-row items-stretch gap-4 relative overflow-hidden`}
              >
                {/* Icon block left */}
                <div className="flex md:items-center justify-start shrink-0">
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shadow-sm`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                </div>

                {/* Central main question content */}
                <div className="flex-1 space-y-1.5 min-w-0 pr-2">
                  <div className="flex items-center flex-wrap gap-2 text-[9px] font-extrabold uppercase">
                    <span className="text-muted-foreground/80 font-bold tracking-wider">
                      {q.theories?.title}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold tracking-wider">
                      {q.bloom_level}
                    </span>
                    <span className="text-amber-500 font-extrabold text-[8px]">
                      L{q.difficulty}
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                    {isExpanded ? q.stem : (
                      <p className="line-clamp-2">{q.stem}</p>
                    )}
                  </div>

                  {q.stem.length > 150 && (
                    <button
                      onClick={() => toggleStem(q.id)}
                      className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-0.5 cursor-pointer mt-1 font-serif select-none"
                    >
                      {isExpanded ? (
                        <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                      ) : (
                        <>Expand Question <ChevronDown className="w-3.5 h-3.5" /></>
                      )}
                    </button>
                  )}

                  {/* SRS metadata footer */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[9px] font-bold text-muted-foreground/85 font-serif select-none">
                    <span>Last seen: {getLastSeenText(item.created_at, item.repetitions)}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>Ease: {item.ease_factor}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>Repetitions: {item.repetitions}</span>
                  </div>
                </div>

                {/* Right side due badge and actions menu */}
                <div className="flex md:flex-col justify-between md:justify-center items-end border-t md:border-t-0 border-border/40 pt-3 md:pt-0 shrink-0 select-none">
                  <div className="text-right space-y-1">
                    {/* Calendar Due Badge */}
                    <div className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border ${dueInfo.color}`}>
                      <Calendar className="w-3 h-3" />
                      <span>{dueInfo.label}</span>
                    </div>
                    <div className="text-[8px] text-muted-foreground/80 font-serif">
                      Next review <span className="font-bold text-foreground/90">{dueInfo.nextText}</span>
                    </div>
                  </div>

                  {/* Vert three-dots menu button */}
                  <button className="p-1 rounded-lg text-muted-foreground hover:bg-secondary/40 hover:text-foreground cursor-pointer transition-colors md:mt-2 self-end">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
