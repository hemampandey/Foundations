'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, Calendar, ListFilter, CheckSquare, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';

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

export default function BrowseTab() {
  const { profile } = useProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheory, setSelectedTheory] = useState('');
  const [activePillFilter, setActivePillFilter] = useState<'today' | 'tomorrow' | 'week' | 'later' | 'mastered'>('today');
  const [expandedStems, setExpandedStems] = useState<Record<string, boolean>>({});

  const [schedules, setSchedules] = useState<BrowseScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [theoryOptions, setTheoryOptions] = useState<string[]>([]);

  // Category Counts
  const [countToday, setCountToday] = useState(0);
  const [countTomorrow, setCountTomorrow] = useState(0);
  const [countWeek, setCountWeek] = useState(0);
  const [countLater, setCountLater] = useState(0);
  const [countMastered, setCountMastered] = useState(0);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const toggleStem = (qId: string) => {
    setExpandedStems(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // Date constants for helpers
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

  // ── Fetch dynamic Category Counts & Theories list ──
  const fetchCountsAndTheories = useCallback(async () => {
    if (!profile) return;
    try {
      const currentDate = new Date();
      const currentTodayEnd = new Date();
      currentTodayEnd.setHours(23, 59, 59, 999);

      const currentTomorrowStart = new Date();
      currentTomorrowStart.setDate(currentTomorrowStart.getDate() + 1);
      currentTomorrowStart.setHours(0, 0, 0, 0);
      const currentTomorrowEnd = new Date(currentTomorrowStart);
      currentTomorrowEnd.setHours(23, 59, 59, 999);

      const currentWeekEnd = new Date();
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
      currentWeekEnd.setHours(23, 59, 59, 999);

      const [
        resToday,
        resTomorrow,
        resWeek,
        resLater,
        resMastered,
        theoriesRes
      ] = await Promise.all([
        supabase.from('review_schedule').select('question_id', { count: 'exact', head: true }).eq('user_id', profile.id).lte('due_at', currentTodayEnd.toISOString()),
        supabase.from('review_schedule').select('question_id', { count: 'exact', head: true }).eq('user_id', profile.id).gte('due_at', currentTomorrowStart.toISOString()).lte('due_at', currentTomorrowEnd.toISOString()),
        supabase.from('review_schedule').select('question_id', { count: 'exact', head: true }).eq('user_id', profile.id).gte('due_at', currentDate.toISOString()).lte('due_at', currentWeekEnd.toISOString()),
        supabase.from('review_schedule').select('question_id', { count: 'exact', head: true }).eq('user_id', profile.id).gt('due_at', currentWeekEnd.toISOString()),
        supabase.from('review_schedule').select('question_id', { count: 'exact', head: true }).eq('user_id', profile.id).or('repetitions.gte.4,interval_days.gte.15'),
        supabase.from('theories').select('title').eq('status', 'published').order('title', { ascending: true })
      ]);

      setCountToday(resToday.count ?? 0);
      setCountTomorrow(resTomorrow.count ?? 0);
      setCountWeek(resWeek.count ?? 0);
      setCountLater(resLater.count ?? 0);
      setCountMastered(resMastered.count ?? 0);
      
      if (theoriesRes.data) {
        setTheoryOptions(theoriesRes.data.map(t => t.title));
      }
    } catch (err) {
      console.error('Error loading counts and theories:', err);
    }
  }, [profile]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCountsAndTheories();
    });
  }, [fetchCountsAndTheories]);

  // ── Fetch paginated, filtered review schedules from PostgreSQL ──
  const fetchSchedulesData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let matchingQuestionIds: string[] | null = null;

      if (searchQuery.trim() !== '') {
        // 1. Get questions matching stem
        const { data: stemMatches } = await supabase
          .from('questions')
          .select('id')
          .ilike('stem', `%${searchQuery.trim()}%`);

        // 2. Get theories matching title
        const { data: theoryMatches } = await supabase
          .from('theories')
          .select('id')
          .ilike('title', `%${searchQuery.trim()}%`);

        let theoryQuestionIds: string[] = [];
        if (theoryMatches && theoryMatches.length > 0) {
          const theoryIds = theoryMatches.map(t => t.id);
          const { data: theoryQuestions } = await supabase
            .from('questions')
            .select('id')
            .in('theory_id', theoryIds);
          if (theoryQuestions) {
            theoryQuestionIds = theoryQuestions.map(q => q.id);
          }
        }

        matchingQuestionIds = Array.from(new Set([
          ...(stemMatches?.map(q => q.id) || []),
          ...theoryQuestionIds
        ]));
      }

      let query = supabase
        .from('review_schedule')
        .select(`
          user_id,
          question_id,
          ease_factor,
          interval_days,
          due_at,
          repetitions,
          created_at,
          questions!inner (
            id,
            stem,
            difficulty,
            bloom_level,
            theories!inner (
              id,
              title
            )
          )
        `, { count: 'exact' })
        .eq('user_id', profile.id);

      // Apply Search Filter via matching question IDs
      if (matchingQuestionIds !== null) {
        if (matchingQuestionIds.length > 0) {
          query = query.in('question_id', matchingQuestionIds);
        } else {
          // No matching questions, force query to return no results safely
          query = query.in('question_id', ['00000000-0000-0000-0000-000000000000']);
        }
      }

      // Apply Theory Filter
      if (selectedTheory !== '') {
        query = query.eq('questions.theories.title', selectedTheory);
      }

      // Apply Status Category matching
      const currentDate = new Date();
      const currentTodayEnd = new Date();
      currentTodayEnd.setHours(23, 59, 59, 999);

      const currentTomorrowStart = new Date();
      currentTomorrowStart.setDate(currentTomorrowStart.getDate() + 1);
      currentTomorrowStart.setHours(0, 0, 0, 0);
      const currentTomorrowEnd = new Date(currentTomorrowStart);
      currentTomorrowEnd.setHours(23, 59, 59, 999);

      const currentWeekEnd = new Date();
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
      currentWeekEnd.setHours(23, 59, 59, 999);

      if (activePillFilter === 'today') {
        query = query.lte('due_at', currentTodayEnd.toISOString());
      } else if (activePillFilter === 'tomorrow') {
        query = query.gte('due_at', currentTomorrowStart.toISOString()).lte('due_at', currentTomorrowEnd.toISOString());
      } else if (activePillFilter === 'week') {
        query = query.gte('due_at', currentDate.toISOString()).lte('due_at', currentWeekEnd.toISOString());
      } else if (activePillFilter === 'later') {
        query = query.gt('due_at', currentWeekEnd.toISOString());
      } else if (activePillFilter === 'mastered') {
        query = query.or('repetitions.gte.4,interval_days.gte.15');
      }

      // Pagination calculation
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, count, error } = await query
        .order('due_at', { ascending: true })
        .range(from, to);

      if (error) throw error;

      const valid = (data as unknown as BrowseScheduleItem[] ?? []).filter(item => item.questions !== null);
      setSchedules(valid);
      setTotalItems(count ?? 0);
    } catch (err) {
      console.error('[Foundations] Error loading schedules page:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, currentPage, itemsPerPage, searchQuery, selectedTheory, activePillFilter]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSchedulesData();
    });
  }, [fetchSchedulesData]);

  // Reset page when filters change
  useEffect(() => {
    Promise.resolve().then(() => {
      setCurrentPage(1);
    });
  }, [searchQuery, selectedTheory, activePillFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Safe helper to extract relative last seen time
  const getLastSeenText = (createdAtStr: string, reps: number) => {
    if (reps === 0) return 'Never';
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
    <div className="space-y-4 w-full text-left">
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
            className="w-full pl-9 pr-4 py-2.5 text-xs font-serif rounded-xl bg-card border border-border focus:border-primary outline-none transition-all placeholder:text-muted-foreground shadow-sm"
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
              className="w-full pl-9 pr-8 py-2.5 text-xs font-serif rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
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
              className="w-full pl-9 pr-8 py-2.5 text-xs font-serif rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
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
      <div className="flex flex-wrap gap-2.5 select-none">
        {/* Due Today Pill */}
        <button
          onClick={() => setActivePillFilter('today')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
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
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground font-serif">
          <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-35" />
          <p className="text-xs font-semibold font-serif">No tracked items matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-4">
            {schedules.map((item, idx) => {
              const q = item.questions!;
              const isExpanded = expandedStems[q.id] || false;
              const dueInfo = getDueBadgeInfo(item.due_at, item.repetitions, item.interval_days);

              return (
                <div
                  key={idx}
                  className={`bg-card border border-border/80 border-l-[3.5px] rounded-xl p-3 hover:shadow-md transition-all flex flex-col md:flex-row items-stretch gap-4 relative overflow-hidden`}
                >
                  {/* Central main question content */}
                  <div className="flex-1 space-y-1.5 min-w-0 pr-2">
                    <div className="flex items-center flex-wrap gap-2 text-[9px] font-extrabold uppercase">
                      <span className="text-primary bg-primary/20 px-2 py-0.5 rounded-md font-serif">{q.theories?.title}</span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold tracking-wider">{q.bloom_level}</span>
                      <span className="text-amber-500 font-extrabold text-[8px]">L{q.difficulty}</span>
                    </div>

                    <div className="text-xs sm:text-sm font-bold font-inria text-foreground leading-snug">
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
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[9px] italic font-bold text-muted-foreground font-sans select-none">
                      <span>Last seen: {getLastSeenText(item.created_at, item.repetitions)}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span>Repetitions: {item.repetitions}</span>
                    </div>
                  </div>

                  {/* Right side due badge */}
                  <div className="flex md:flex-col justify-between md:justify-center items-end border-t md:border-t-0 border-border/40 pt-3 md:pt-0 shrink-0 select-none">
                    <div className="text-right space-y-1">
                      {/* Calendar Due Badge */}
                      <div className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border ${dueInfo.color}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{dueInfo.label}</span>
                      </div>
                      <div className="text-[10px] pt-1 text-muted-foreground/80 font-serif">
                        Next review <span className="font-bold text-foreground/90">{dueInfo.nextText}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Bottom Pagination controls ─── */}
          <div className="flex flex-col sm:flex-row justify-between items-center border-t border-border/40 pt-5 gap-4 select-none">
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
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 border border-border bg-card rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-slate-700 dark:text-slate-300"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
