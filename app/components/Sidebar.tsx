'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { supabase, devUpdateUserRole } from '@/lib/supabase';
import { useProfile } from '@/app/components/ProfileProvider';
import { isDevMode, formatDate } from '@/lib/utils';
import type { Profile } from '@/lib/types';
import {
  User, LogOut,
  ShieldAlert, Search, PanelLeft, PanelLeftClose, ChevronDown, ChevronUp, Sun, Moon,
  Globe, HelpCircle, ArrowUpCircle, Info, ChevronsUpDown, ChevronRight, Settings
} from 'lucide-react';

interface SidebarTheoryPractice {
  theoryId: string;
  theoryTitle: string;
  lastActive: string;
  accuracy: number;
  xpEarned: number;
}

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 14;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let colorClass = 'stroke-emerald-500';
  if (percentage < 50) colorClass = 'stroke-destructive';
  else if (percentage < 80) colorClass = 'stroke-amber-500';

  return (
    <div className="relative flex items-center justify-center shrink-0 w-9 h-9">
      <svg className="w-9 h-9 transform -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-border dark:text-border/20"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${colorClass} transition-all duration-500 ease-out`}
        />
      </svg>
      <span className="absolute text-[8px] font-bold text-foreground font-mono">
        {percentage}%
      </span>
    </div>
  );
}


interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile: contextProfile, loading: profileLoading, userEmail, refreshProfile } = useProfile();
  const [profile, setProfile] = useState<Profile | null>(contextProfile);
  const [collapsed, setCollapsed] = useState(false);
  const [theoryPractices, setTheoryPractices] = useState<SidebarTheoryPractice[]>([]);
  const [attemptsExpanded, setAttemptsExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(pathname.startsWith('/admin'));
  const [reviewExpanded, setReviewExpanded] = useState(pathname.startsWith('/review'));
  const [draftCount, setDraftCount] = useState(0);
  const [reviewDueCount, setReviewDueCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sub-menus / popovers when clicking outside the sidebar (only when collapsed)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        if (collapsed) {
          setAdminExpanded(false);
          setReviewExpanded(false);
        }
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [collapsed]);

  // Sync local profile with context profile
  const [prevContextProfile, setPrevContextProfile] = useState(contextProfile);
  if (contextProfile !== prevContextProfile) {
    setPrevContextProfile(contextProfile);
    setProfile(contextProfile);
  }

  // Search Palette state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    theories: { id: string; title: string; domain: string }[];
    journeys: { id: string; title: string }[];
  }>({ theories: [], journeys: [] });

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    Promise.resolve().then(() => {
      setTheme(isDark ? 'dark' : 'light');
    });
  }, []);

  const [prevMobileOpen, setPrevMobileOpen] = useState(mobileOpen);
  if (mobileOpen !== prevMobileOpen) {
    setPrevMobileOpen(mobileOpen);
    if (mobileOpen) {
      setCollapsed(false);
    }
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const fetchAttempts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('attempts')
        .select(`
          id,
          is_correct,
          created_at,
          questions (
            theories (
              id,
              title
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const theoryGroups: Record<string, {
          title: string;
          createdDates: string[];
          total: number;
          correct: number;
        }> = {};

        for (const rawAtt of data as unknown[]) {
          const att = rawAtt as {
            created_at: string;
            is_correct: boolean;
            questions: {
              theories: { id: string; title: string } | null;
            } | null;
          };
          const questionsData = att.questions;
          const theory = questionsData?.theories;
          if (theory && theory.id && theory.title) {
            if (!theoryGroups[theory.id]) {
              theoryGroups[theory.id] = {
                title: theory.title,
                createdDates: [],
                total: 0,
                correct: 0,
              };
            }
            const group = theoryGroups[theory.id];
            group.createdDates.push(att.created_at);
            group.total += 1;
            if (att.is_correct) {
              group.correct += 1;
            }
          }
        }

        const formatted: SidebarTheoryPractice[] = Object.entries(theoryGroups).map(([id, group]) => {
          const sortedDates = group.createdDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          const accuracy = group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0;
          const xpEarned = group.correct * 10 + (group.total - group.correct) * 2;
          return {
            theoryId: id,
            theoryTitle: group.title,
            lastActive: sortedDates[0],
            accuracy,
            xpEarned,
          };
        });

        formatted.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
        setTheoryPractices(formatted.slice(0, 5));
      }
    } catch (err) {
      console.error('[Foundations] Failed to fetch sidebar attempts:', err);
    }
  }, []);

  const fetchDraftCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft');

      if (!error && count !== null) {
        setDraftCount(count);
      }
    } catch (err) {
      console.error('[Foundations] Failed to fetch draft count:', err);
    }
  }, []);

  const fetchReviewDueCount = useCallback(async () => {
    if (!contextProfile) return;
    try {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const { count, error } = await supabase
        .from('review_schedule')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', contextProfile.id)
        .lte('due_at', endOfToday.toISOString());

      if (!error && count !== null) {
        setReviewDueCount(count);
      }
    } catch (err) {
      console.error('[Foundations] Failed to fetch review due count:', err);
    }
  }, [contextProfile]);

  // Search Debounce Effect
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!showSearchModal || !searchQuery.trim()) {
        setSearchResults({ theories: [], journeys: [] });
        return;
      }

      try {
        const query = searchQuery.trim();
        // Escape SQL LIKE wildcards to prevent unintended pattern matching
        const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_');

        // Query Supabase for matching published theories
        const { data: theoriesData } = await supabase
          .from('theories')
          .select('id, title, domain')
          .eq('status', 'published')
          .ilike('title', `%${escaped}%`)
          .limit(5);

        // Query Supabase for matching published journeys
        const { data: journeysData } = await supabase
          .from('journeys')
          .select('id, title')
          .eq('published', true)
          .ilike('title', `%${escaped}%`)
          .limit(5);

        setSearchResults({
          theories: (theoriesData ?? []) as { id: string; title: string; domain: string }[],
          journeys: (journeysData ?? []) as { id: string; title: string }[],
        });
      } catch (err) {
        console.error('[Foundations] Global search failed:', err);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, showSearchModal]);

  // Global search shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load sidebar-specific data (attempts, draft count, review due count) on mount, auth, pathname or custom sync events
  useEffect(() => {
    if (!profileLoading && contextProfile) {
      const loadAll = () => {
        fetchAttempts();
        fetchDraftCount();
        fetchReviewDueCount();
      };
      
      loadAll();

      window.addEventListener('sync-sidebar-badges', loadAll);
      window.addEventListener('focus', loadAll);

      return () => {
        window.removeEventListener('sync-sidebar-badges', loadAll);
        window.removeEventListener('focus', loadAll);
      };
    }
  }, [profileLoading, contextProfile, pathname, searchParams, fetchAttempts, fetchDraftCount, fetchReviewDueCount]);

  // Handle sign-out navigation
  useEffect(() => {
    if (!profileLoading && !contextProfile) {
      Promise.resolve().then(() => {
        setTheoryPractices([]);
      });
    }
  }, [profileLoading, contextProfile]);

  const handleRoleToggle = async () => {
    if (!profile) return;
    const newRole = profile.role === 'admin' ? 'learner' : 'admin';
    try {
      await devUpdateUserRole(newRole);
      await refreshProfile();
      router.refresh();
      if (newRole === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch {
      // Dev mode toggle only
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (pathname.startsWith('/auth')) {
    return null;
  }

  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : '?';
  const emailName = userEmail ? userEmail.split('@')[0] : 'Guest';
  const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
  const roleLabel = profile?.role === 'admin' ? 'Admin' : (profile?.role === 'learner' ? 'Free' : 'Guest');

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/40 dark:bg-black/60 z-40 md:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`h-full border-r border-border bg-[#f9f9fb] dark:bg-[#0b0f19] flex-col justify-between p-4 transition-all duration-200 shrink-0 select-none relative z-20
          ${mobileOpen
            ? 'fixed inset-y-0 left-0 w-[240px] z-50 flex animate-slide-in'
            : 'hidden md:flex'
          }
          ${collapsed ? 'md:w-[68px]' : 'md:w-[230px]'}`}
        aria-label="Main navigation"
      >
        {/* ─── Top Brand & Actions ─── */}
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="flex items-center justify-between h-10 px-1 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
              {!collapsed && (
                <>
                  <span className="font-inria font-bold text-lg text-foreground truncate">Foundations</span>
                </>
              )}
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              {!collapsed && (
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl cursor-pointer transition-all"
                  title="Search Theories/Journeys (Cmd+K)"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
              {/* Desktop Collapse Trigger */}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden md:inline-flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl cursor-pointer transition-all"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              {/* Mobile Drawer Close Trigger */}
              <button
                onClick={onClose}
                className="md:hidden inline-flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl cursor-pointer transition-all"
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Practice Button */}
          <div className="relative group shrink-0">
            <Link
              href="/review?action=start"
              className={`flex items-center justify-center gap-2.5 bg-gradient-to-r from-primary to-[#3b82f6] text-white rounded-2xl text-xs font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md ${collapsed ? 'w-10 h-10 mx-auto p-0' : 'w-full px-4 py-3'
                } ${reviewDueCount > 0 ? 'animate-practice-btn-glow' : ''}`}
            >
              {collapsed ? (
                <Image 
                  src="/icons/deck.svg"
                  alt="Brain Icon"
                  width={20}
                  height={20}
                  className="w-5 h-5 shrink-0"
                  unoptimized
                />
              ) : (
                <span className="flex items-center justify-between w-full font-serif font-bold">
                  <span className="flex items-center gap-2">
                    <span>Daily Practice Deck</span>
                  </span>
                  {reviewDueCount > 0 && (
                    <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white text-primary text-[10px] font-extrabold shadow-sm select-none">{reviewDueCount}</span>
                  )}
                </span>
              )}
            </Link>
            {collapsed && (
              <span className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 bg-secondary text-primary text-[10px] font-bold font-serif px-1.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-50">
                Daily Practice
              </span>
            )}
          </div>

          {/* Main Navigation Links */}
          <nav className="space-y-0.5 shrink-0 animate-fade-in" aria-label="Primary">
            <div className="relative group">
              <Link
                href="/dashboard"
                className={`flex items-center rounded-xl text-xs font-semibold transition-all duration-200 border hover-glow-sweep ${collapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'gap-3 px-3 py-2'
                  } ${pathname === '/dashboard' || pathname.startsWith('/practice')
                    ? 'bg-primary/5 text-primary font-serif border-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'text-muted-foreground hover:text-foreground font-serif hover:bg-secondary/45 border-transparent'
                  }`}
              >
                <Image
                  src="/icons/learn.svg"
                  alt="Learn Icon"
                  width={30}
                  height={30}
                  className="w-5 h-5 shrink-0"
                  unoptimized
                />
                {!collapsed && <span>Learn</span>}
              </Link>
              {collapsed && (
                <span className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 bg-secondary text-primary text-[10px] font-bold font-serif px-1.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-50">Learn</span>
              )}
            </div>
 
            <div className="relative group">
              <Link
                href="/progress"
                className={`flex items-center rounded-xl text-xs font-semibold transition-all duration-200 border hover-glow-sweep ${collapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'gap-3 px-3 py-2'
                  } ${pathname === '/progress'
                    ? 'bg-primary/5 text-primary font-serif border-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'text-muted-foreground font-serif hover:text-foreground hover:bg-secondary/45 border-transparent'
                  }`}
              >
                <Image
                  src="/icons/progress.svg"
                  alt="Progress Icon"
                  width={30}
                  height={30}
                  className="w-5 h-5 shrink-0"
                  unoptimized
                />
                {!collapsed && <span>Progress</span>}
              </Link>
              {collapsed && (
                <span className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 bg-secondary text-primary text-[10px] font-bold font-serif px-1.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md z-50">
                  Progress
                </span>
              )}
            </div>

            {(() => {
              const activeReviewTab = searchParams.get('tab') || 'forecast';
              return (
                <div
                  className="space-y-0.5 relative"
                  onMouseEnter={() => collapsed && setReviewExpanded(true)}
                  onMouseLeave={() => collapsed && setReviewExpanded(false)}
                >
                  <button
                    onClick={() => {
                      const nextVal = !reviewExpanded;
                      setReviewExpanded(nextVal);
                      if (nextVal) {
                        setAdminExpanded(false);
                      }
                    }}
                    className={`flex items-center rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer ${collapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'justify-between w-full px-3 py-2'
                      } ${pathname.startsWith('/review') && !reviewExpanded
                        ? 'bg-primary/5 font-serif text-primary border-primary/10'
                        : 'text-muted-foreground hover:text-foreground font-serif hover:bg-secondary/45 border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src="/icons/review.svg"
                        alt="Review Icon"
                        width={30}
                        height={30}
                        className="w-5 h-5 shrink-0"
                        unoptimized
                      />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          Review
                          {reviewDueCount > 0 && (
                            <span className="text-[10px] font-bold font-serif text-white bg-primary/90 px-2.5 py-1 rounded-sm animate-scale-in">{reviewDueCount}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      reviewExpanded ? <ChevronUp className="w-3.5 h-3.5 font-bold" /> : <ChevronDown className="w-3.5 h-3.5 font-bold" />
                    )}
                  </button>

                  {/* Desktop Expanded sub-menu */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${reviewExpanded && !collapsed
                      ? 'grid-rows-[1fr] opacity-100 mt-1'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                  >
                    <div className="overflow-hidden pl-4 space-y-0.5 border-l border-border/40 ml-5">
                      {/* Forecast & Stats */}
                      <Link
                        href="/review?tab=forecast"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/review') && activeReviewTab === 'forecast'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold hover:text-foreground font-serif hover:bg-secondary/35'
                          }`}
                      >
                        <span>Forecast & Stats</span>
                      </Link>

                      {/* Browse Schedules */}
                      <Link
                        href="/review?tab=browse"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/review') && activeReviewTab === 'browse'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Browse Schedules</span>
                      </Link>

                      {/* Attempt History */}
                      <Link
                        href="/review?tab=history"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/review') && activeReviewTab === 'history'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Attempt History</span>
                      </Link>
                    </div>
                  </div>

                  {/* Collapsed flyout popover menu */}
                  {collapsed && (
                    <div
                      className={`absolute left-[54px] top-0 z-50 bg-card border border-border rounded-2xl p-2.5 shadow-xl w-[150px] space-y-0.5 transition-all duration-300 ease-out transform origin-left before:content-[''] before:absolute before:right-full before:top-0 before:bottom-0 before:w-[25px] before:bg-transparent ${reviewExpanded
                        ? 'translate-x-2 opacity-100 scale-100 pointer-events-auto'
                        : 'translate-x-0 opacity-0 scale-95 pointer-events-none'
                        }`}
                    >
                      <div className="text-[10px] font-bold font-serif text-primary/80 px-2 pb-1 border-b border-border/40 mb-1">Review Menu</div>

                      {/* Forecast & Stats */}
                      <Link
                        href="/review?tab=forecast"
                        onClick={() => setReviewExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/review') && activeReviewTab === 'forecast'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Forecast &amp; Stats</span>
                      </Link>

                      {/* Browse Schedules */}
                      <Link
                        href="/review?tab=browse"
                        onClick={() => setReviewExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/review') && activeReviewTab === 'browse'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Browse Schedules</span>
                      </Link>

                      {/* Attempt History */}
                      <Link
                        href="/review?tab=history"
                        onClick={() => setReviewExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/review') && activeReviewTab === 'history'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Attempt History</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Admin Panel collapsible sub-menu */}
            {!profileLoading && profile?.role === 'admin' && (() => {
              const activeTab = searchParams.get('tab') || 'theories';
              return (
                <div
                  className="space-y-0.5 relative"
                  onMouseEnter={() => collapsed && setAdminExpanded(true)}
                  onMouseLeave={() => collapsed && setAdminExpanded(false)}
                >
                  <button
                    onClick={() => {
                      const nextVal = !adminExpanded;
                      setAdminExpanded(nextVal);
                      if (nextVal) {
                        setReviewExpanded(false);
                      }
                    }}
                    className={`flex items-center rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer ${collapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'justify-between w-full px-3 py-2'
                      } ${pathname.startsWith('/admin') && !adminExpanded
                        ? 'bg-primary/5 font-serif text-primary border-primary/10'
                        : 'text-muted-foreground font-serif hover:text-foreground hover:bg-secondary/45 border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src="/icons/admin.svg"
                        alt="Admin Icon"
                        width={30}
                        height={30}
                        className="w-5 h-5 shrink-0"
                        unoptimized
                      />
                      {!collapsed && <span>Admin Panel</span>}
                    </div>
                    {!collapsed && (
                      adminExpanded ? <ChevronUp className="w-3.5 h-3.5 font-bold" /> : <ChevronDown className="w-3.5 h-3.5 font-bold" />
                    )}
                  </button>

                  {/* Desktop Expanded sub-menu */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${adminExpanded && !collapsed
                      ? 'grid-rows-[1fr] opacity-100 mt-1'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                  >
                    <div className="overflow-hidden pl-4 space-y-0.5 border-l border-border/40 ml-5">
                      {/* Manage Theories */}
                      <Link
                        href="/admin?tab=theories"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'theories'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Manage Theories</span>
                      </Link>

                      {/* Manage MCQs */}
                      <Link
                        href="/admin?tab=questions"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'questions'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Manage MCQs</span>
                      </Link>

                      {/* Review Queue */}
                      <Link
                        href="/admin?tab=review"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'review'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Review Queue</span>
                          {draftCount > 0 && (
                            <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold bg-primary/90 text-white">{draftCount}</span>
                          )}
                        </div>
                      </Link>

                      {/* Manage Journeys */}
                      <Link
                        href="/admin?tab=journeys"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'journeys'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Manage Journeys</span>
                      </Link>
                    </div>
                  </div>

                  {/* Collapsed flyout popover menu */}
                  {collapsed && (
                    <div
                      className={`absolute left-[54px] top-0 z-50 bg-card border border-border rounded-2xl p-2.5 shadow-xl w-[150px] space-y-0.5 transition-all duration-300 ease-in-out transform origin-left before:content-[''] before:absolute before:right-full before:top-0 before:bottom-0 before:w-[25px] before:bg-transparent ${adminExpanded
                        ? 'translate-x-2 opacity-100 scale-100 pointer-events-auto'
                        : 'translate-x-0 opacity-0 scale-95 pointer-events-none'
                        }`}
                    >
                      <div className="text-[10px] font-serif font-bold text-primary/80 px-2 pb-1 border-b border-border/40 mb-1">Admin Menu</div>

                      {/* Manage Theories */}
                      <Link
                        href="/admin?tab=theories"
                        onClick={() => setAdminExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'theories'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Manage Theories</span>
                      </Link>

                      {/* Manage MCQs */}
                      <Link
                        href="/admin?tab=questions"
                        onClick={() => setAdminExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'questions'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Manage MCQs</span>
                      </Link>

                      {/* Review Queue */}
                      <Link
                        href="/admin?tab=review"
                        onClick={() => setAdminExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'review'
                          ? 'text-primary font-bold font-serif bg-primary/5'
                          : 'text-muted-foreground font-bold font-serif hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span>Review Queue</span>
                          {draftCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-primary/90 text-white">{draftCount}</span>
                          )}
                        </div>
                      </Link>

                      {/* Manage Journeys */}
                      <Link
                        href="/admin?tab=journeys"
                        onClick={() => setAdminExpanded(false)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${pathname.startsWith('/admin') && activeTab === 'journeys'
                          ? 'text-primary font-bold bg-primary/5'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/35'
                          }`}
                      >
                        <span>Manage Journeys</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}
          </nav>

          {/* Collapsible Recent Attempts List */}
          {!collapsed && (
            <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-border/40 px-1">
              <button
                onClick={() => setAttemptsExpanded(!attemptsExpanded)}
                className="flex items-center justify-between w-full text-[11px] font-bold font-serif text-muted-foreground/90 uppercase px-2 py-1 hover:text-foreground transition-all cursor-pointer text-left"
              >
                <span>Recent Attempts</span>
                {attemptsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {attemptsExpanded && (
                <div className="mt-2 space-y-2 overflow-y-auto flex-1 pr-1.5 scrollbar-thin">
                  {theoryPractices.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/60 italic px-2 py-1">No recent attempts</p>
                  ) : (
                    theoryPractices.map((practice) => (
                      <div
                        key={practice.theoryId}
                        onClick={() => router.push(`/practice?theoryId=${practice.theoryId}`)}
                        className="flex items-center justify-between p-2 hover:bg-secondary/50 rounded-xl transition-all cursor-pointer group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-[11px] font-serif font-bold text-foreground truncate group-hover:text-primary transition-colors" title={practice.theoryTitle}>
                            {practice.theoryTitle}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {formatDate(practice.lastActive)} • <span className="font-semibold text-primary/90">+{practice.xpEarned} XP</span>
                          </p>
                        </div>
                        <CircularProgress percentage={practice.accuracy} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Bottom Profile Panel ─── */}
        <div className="space-y-1 pt-3 border-t border-border/0 shrink-0 relative">
          {/* Dev Role Switcher */}
          {isDevMode() && profile && (
            <div className="px-1">
              <button
                onClick={handleRoleToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer ${profile.role === 'admin'
                  ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  } ${collapsed ? 'px-2 w-9 h-9 justify-center rounded-full' : 'w-full justify-center'}`}
                title="Dev Tool: Toggle role in DB"
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                {!collapsed && <span>Role: {profile.role}</span>}
              </button>
            </div>
          )}

          {/* Theme Switcher */}
          <div className="px-1">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all cursor-pointer w-full ${collapsed ? 'justify-center p-2' : ''
                }`}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 shrink-0 transition-transform duration-300 rotate-0 hover:rotate-12" />
                  {!collapsed && <span>Dark Mode</span>}
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 shrink-0 text-amber-500 transition-transform duration-300 rotate-0 hover:rotate-45" />
                  {!collapsed && <span>Light Mode</span>}
                </>
              )}
            </button>
          </div>

          {/* Popover Settings Dropdown Menu Overlay */}
          {profile && dropdownOpen && !collapsed && (
            <div
              className="fixed inset-0 z-40 bg-transparent cursor-default"
              onClick={() => setDropdownOpen(false)}
            />
          )}

          {/* Popover Settings Dropdown Menu */}
          {profile && dropdownOpen && !collapsed && (
            <div className="absolute bottom-14 left-1 right-1 bg-card border border-border rounded-xl shadow-lg z-50 p-1.5 space-y-0.5 animate-fade-in text-xs text-foreground">
              {/* Header Email */}
              <div className="px-3 py-2 text-[10px] text-muted-foreground truncate border-b border-border/40 pb-2 mb-1.5 font-bold tracking-wider">{userEmail ?? 'Guest Session'}</div>

              {/* Settings */}
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setShowSearchModal(true);
                }}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-secondary/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5 font-medium">
                  <Settings className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>Settings</span>
                </div>
                <span className="text-[9px] text-muted-foreground/60 tracking-wider">⇧⌘,</span>
              </button>

              {/* Language */}
              <button
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-secondary/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5 font-medium">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>Language</span>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              </button>
              {/* Get Help */}
              <button
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-secondary/50 transition-all cursor-pointer group font-medium">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span>Get help</span>
              </button>
              <div className="border-t border-border/40 my-1"></div>

              {/* Upgrade Plan */}
              <button
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-secondary/50 transition-all cursor-pointer group font-medium">
                <ArrowUpCircle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span>Upgrade plan</span>
              </button>

              {/* Learn more */}
              <button
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-secondary/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5 font-medium">
                  <Info className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>Learn more</span>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              </button>
              <div className="border-t border-border/40 my-1"></div>

              {/* Log out */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-left text-destructive hover:bg-destructive/5 transition-all cursor-pointer group font-semibold">
                <LogOut className="w-3.5 h-3.5 transition-colors" />
                <span>Log out</span>
              </button>
            </div>
          )}

          {/* Profile Card */}
          {profile ? (
            <div
              onClick={() => !collapsed && setDropdownOpen(!dropdownOpen)}
              className={`flex items-center justify-between p-1.5 rounded-xl hover:bg-secondary/50 active:bg-secondary/70 transition-all px-2 relative ${!collapsed ? 'cursor-pointer select-none' : ''}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white font-bold text-xs uppercase shadow-sm">
                  {userInitial}
                </div>
                {!collapsed && (
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground truncate capitalize">{roleLabel} plan</p>
                  </div>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="p-0.5 text-muted-foreground/60 hover:text-foreground transition-all cursor-pointer">
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            !profileLoading && (
              <Link
                href="/auth"
                className="flex w-full items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all shadow-sm">
                <User className="w-4 h-4" />
                {!collapsed && <span>Sign In</span>}
              </Link>
            )
          )}

          {/* Serif brand label */}
          {!collapsed && (
            <div className="flex justify-center border-t border-border/60 pt-3 mt-1">
              <Image
                src="/ally-blue-logo.svg"
                alt="Ally Logo"
                width={50}
                height={24}
                className="shrink-0" />
            </div>
          )}
        </div>
      </aside>

      {/* Spotlight Command Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-background/80 animate-fade-in"
          onClick={() => setShowSearchModal(false)}>
          <div
            className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}>
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm outline-none text-foreground placeholder-muted-foreground"
                autoFocus />
            </div>

            {/* Results Body */}
            <div className="max-h-[350px] overflow-y-auto p-4 space-y-4">
              {!searchQuery.trim() ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Search theories and journeys
                </div>
              ) : searchResults.theories.length === 0 && searchResults.journeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No results found matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <>
                  {/* Journeys Category */}
                  {searchResults.journeys.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1.5">Journeys</h4>
                      <div className="space-y-1">
                        {searchResults.journeys.map((j) => (
                          <Link
                            key={j.id}
                            href={`/practice?journeyId=${j.id}`}
                            onClick={() => setShowSearchModal(false)}
                            className="flex items-center justify-between p-2 hover:bg-secondary/60 rounded-xl transition-all text-xs font-semibold text-foreground group">
                            <span className="truncate group-hover:text-primary transition-colors">{j.title}</span>
                            <span className="text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">Practice</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Theories Category */}
                  {searchResults.theories.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1.5">Theories</h4>
                      <div className="space-y-1">
                        {searchResults.theories.map((t) => (
                          <Link
                            key={t.id}
                            href={`/practice?theoryId=${t.id}`}
                            onClick={() => setShowSearchModal(false)}
                            className="flex items-center justify-between p-2 hover:bg-secondary/60 rounded-xl transition-all text-xs font-semibold text-foreground group">
                            <div className="min-w-0 pr-2">
                              <p className="truncate group-hover:text-primary transition-colors">{t.title}</p>
                              <p className="text-[9px] text-muted-foreground font-normal mt-0.5">{t.domain}</p>
                            </div>
                            <span className="text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded shrink-0">Practice</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
