import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Clock, Calendar, ListFilter, CheckCircle2, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';

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

export default function HistoryTab() {
  const { profile } = useProfile();
  const [historyAttempts, setHistoryAttempts] = useState<HistoryAttemptItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [theoryOptions, setTheoryOptions] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheory, setSelectedTheory] = useState('');
  const [selectedResult, setSelectedResult] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '7days' | '30days'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Load published theory titles for filters dropdown once
  useEffect(() => {
    const fetchTheories = async () => {
      try {
        const { data } = await supabase
          .from('theories')
          .select('title')
          .eq('status', 'published')
          .order('title', { ascending: true });
        if (data) {
          setTheoryOptions(data.map(t => t.title));
        }
      } catch (err) {
        console.error('Error fetching theory titles:', err);
      }
    };
    Promise.resolve().then(() => {
      fetchTheories();
    });
  }, []);

  // Fetch paginated, filtered attempts from PostgreSQL
  useEffect(() => {
    if (!profile) return;

    const fetchHistoryData = async () => {
      setLoadingHistory(true);
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
          .from('attempts')
          .select(`
            id,
            is_correct,
            response_ms,
            created_at,
            questions!inner (
              id,
              stem,
              difficulty,
              bloom_level,
              theories!inner (
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

        // Apply Result Filter
        if (selectedResult === 'correct') {
          query = query.eq('is_correct', true);
        } else if (selectedResult === 'incorrect') {
          query = query.eq('is_correct', false);
        }

        // Apply Date Range Filter
        if (selectedDateRange !== 'all') {
          const limitDate = new Date();
          if (selectedDateRange === '7days') {
            limitDate.setDate(limitDate.getDate() - 7);
          } else if (selectedDateRange === '30days') {
            limitDate.setDate(limitDate.getDate() - 30);
          }
          query = query.gte('created_at', limitDate.toISOString());
        }

        // Apply Range Pagination
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        setHistoryAttempts((data as unknown[] as HistoryAttemptItem[]) ?? []);
        setTotalItems(count ?? 0);
      } catch (err) {
        console.error('[Foundations] Error loading history attempts:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    Promise.resolve().then(() => {
      fetchHistoryData();
    });
  }, [profile, currentPage, itemsPerPage, searchQuery, selectedTheory, selectedResult, selectedDateRange]);

  // ── Pagination Calculation ──
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Group current page's attempts by date
  const groupedAttempts = React.useMemo(() => {
    const groups: Record<string, HistoryAttemptItem[]> = {};
    historyAttempts.forEach(item => {
      const key = getDayGroupKey(item.created_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [historyAttempts]);

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
    <div className="space-y-3 w-full text-left">
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
            className="w-full pl-10 pr-4 py-2.5 text-xs font-serif rounded-xl bg-card border border-border focus:border-primary outline-none transition-all placeholder:text-muted-foreground shadow-sm"
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
              className="w-full pl-9 pr-8 py-2.5 text-xs font-serif rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
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
              className="w-full pl-9 pr-8 py-2.5 text-xs font-serif rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
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
              className="w-full pl-9 pr-8 py-2.5 text-xs font-serif rounded-xl bg-card border border-border appearance-none focus:border-primary outline-none transition-all cursor-pointer font-bold text-foreground shadow-sm"
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
        <div className="space-y-4 animate-fade-in">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/40 p-4 space-y-3 bg-card">
              <div className="flex justify-between items-center">
                <div className="skeleton h-4 w-1/4" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="skeleton h-3.5 w-3/4" />
              <div className="flex justify-between items-center pt-1 border-t border-border/20">
                <div className="skeleton h-3.5 w-16" />
                <div className="skeleton h-3.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : totalItems === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center text-muted-foreground font-serif">
          <History className="w-8 h-8 mx-auto mb-2 opacity-35" />
          <p className="text-xs font-serif font-semibold">No recent review attempts found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAttempts).map(([dateHeader, attempts]) => (
            <div key={dateHeader} className="space-y-3">
              {/* Date Group Header */}
              <h4 className="text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-wider pl-1 font-serif">{dateHeader}</h4>

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

                  // Short code ID generator
                  const shortId = `Q-${q.id.slice(0, 5).toUpperCase()}`;

                  return (
                    <div
                      key={attempt.id}
                      className="bg-card border border-border/80 rounded-2xl p-4 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-5 relative overflow-hidden"
                    >
                      {/* Left/Middle textual metadata details */}
                      <div className="flex-1 space-y-1 min-w-0 pr-2">
                        {/* Top Theory Category Tag */}
                        <div className="flex items-center">
                          <span className="px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary text-[9px] font-extrabold font-serif uppercase">{q.theories?.title ?? 'N/A'}</span>
                        </div>
                        {/* Question Stem */}
                        <p className="text-sm font-bold font-inria text-foreground leading-snug line-clamp-2 mt-1">{q.stem}</p>

                        {/* Bottom Metadata Line */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-slate-500 select-none font-sans">
                          {/* Level Tag */}
                          <span className="px-1.5 py-0.5 bg-primary text-secondary rounded-lg text-[9px] font-extrabold">L{q.difficulty}</span>
                          <span className="text-slate-300 font-bold">•</span>
                          {/* Speed */}
                          <div className="flex items-center gap-1 text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400 stroke-[2.2px]" />
                            <span>{(attempt.response_ms / 1000).toFixed(1)}s</span>
                          </div>
                          
                          <span className="text-slate-300 font-bold">•</span>
                          
                          {/* Relative Time */}
                          <span className="text-slate-600 font-medium">{timeStr}</span>
                          
                          <span className="text-slate-300 font-bold">•</span>
                          
                          {/* Short ID */}
                          <span className="text-slate-500 font-medium tracking-tight">{shortId}</span>
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
