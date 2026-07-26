'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Save, Layers, Trash2, Search, ChevronDown, ChevronUp, MoreVertical, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Theory, QuestionWithTheory, BloomLevel } from '@/lib/types';

interface ManageMCQsProps {
  theories: Theory[];
  questions: QuestionWithTheory[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionWithTheory[]>>;
  loadingLists: boolean;
  loadDbData: (silent?: boolean) => Promise<void>;
}

export default function ManageMCQs({
  theories,
  questions,
  setQuestions,
  loadingLists,
  loadDbData,
}: ManageMCQsProps) {
  // Question form state
  const [selectedTheoryId, setSelectedTheoryId] = useState('');
  const [qStem, setQStem] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState<number>(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qDifficulty, setQDifficulty] = useState<1 | 2 | 3>(1);
  const [qBloomLevel, setQBloomLevel] = useState<BloomLevel>('remember');
  const [qStatus, setQStatus] = useState<'draft' | 'approved'>('approved');
  const [qSourceExcerpt, setQSourceExcerpt] = useState('');
  const [qSubmitLoading, setQSubmitLoading] = useState(false);
  const [qMessage, setQMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTheoryId, setFilterTheoryId] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterBloomLevel, setFilterBloomLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineStem, setInlineStem] = useState('');
  const [inlineOptions, setInlineOptions] = useState<string[]>(['', '', '', '']);
  const [inlineCorrectIndex, setInlineCorrectIndex] = useState<number>(0);
  const [inlineExplanation, setInlineExplanation] = useState('');
  const [inlineDifficulty, setInlineDifficulty] = useState<1 | 2 | 3>(1);
  const [inlineBloomLevel, setInlineBloomLevel] = useState<BloomLevel>('remember');

  useEffect(() => {
    if (!qMessage) return;
    const t = setTimeout(() => setQMessage(null), 5000);
    return () => clearTimeout(t);
  }, [qMessage]);

  const handleCreateQuestion = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQMessage(null);

    if (!selectedTheoryId) {
      setQMessage({ type: 'error', text: 'Please select a theory.' });
      return;
    }

    setQSubmitLoading(true);

    try {
      const { error } = await supabase
        .from('questions')
        .insert({
          theory_id: selectedTheoryId,
          stem: qStem,
          options: qOptions,
          correct_index: qCorrectIndex,
          explanation: qExplanation,
          difficulty: qDifficulty,
          bloom_level: qBloomLevel,
          status: qStatus,
          source_excerpt: qSourceExcerpt || null,
        }).select();

      if (error) throw error;
      setQMessage({ type: 'success', text: 'MCQ created successfully!' });

      setQStem('');
      setQOptions(['', '', '', '']);
      setQExplanation('');
      setQSourceExcerpt('');
      setQCorrectIndex(0);
      setSelectedTheoryId('');

      await loadDbData();
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create question.';
      setQMessage({ type: 'error', text: message });
    } finally {
      setQSubmitLoading(false);
    }
  };

  const handleStartInlineEdit = (q: QuestionWithTheory) => {
    setInlineEditingId(q.id);
    setInlineStem(q.stem);
    setInlineOptions([...q.options]);
    setInlineCorrectIndex(q.correct_index);
    setInlineExplanation(q.explanation);
    setInlineDifficulty(q.difficulty);
    setInlineBloomLevel(q.bloom_level);
  };

  const handleSaveInlineEdit = async (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? {
              ...q,
              stem: inlineStem,
              options: inlineOptions,
              correct_index: inlineCorrectIndex,
              explanation: inlineExplanation,
              difficulty: inlineDifficulty,
              bloom_level: inlineBloomLevel,
            } : q)
    );
    setInlineEditingId(null);

    try {
      const { error } = await supabase
        .from('questions')
        .update({
          stem: inlineStem,
          options: inlineOptions,
          correct_index: inlineCorrectIndex,
          explanation: inlineExplanation,
          difficulty: inlineDifficulty,
          bloom_level: inlineBloomLevel,
        })
        .eq('id', id);

      if (error) throw error;
      loadDbData();
    } catch (err: unknown) {
      console.error('Failed to save inline edit:', err);
      loadDbData();
    }
  };

  const handleDeleteMCQ = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this MCQ?')) return;
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setInlineEditingId(null);
      await loadDbData();
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err) {
      console.error('Failed to delete question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const nextOpts = [...qOptions];
    nextOpts[index] = val;
    setQOptions(nextOpts);
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = !searchQuery || 
      q.stem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.options.some(opt => opt.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesTheory = !filterTheoryId || q.theory_id === filterTheoryId;
    const matchesDifficulty = !filterDifficulty || q.difficulty === Number(filterDifficulty);
    const matchesBloom = !filterBloomLevel || q.bloom_level === filterBloomLevel;
    const matchesStatus = !filterStatus || q.status === filterStatus;
    
    return matchesSearch && matchesTheory && matchesDifficulty && matchesBloom && matchesStatus;
  });

  return (
    <>
      {/* Create MCQ Form */}
      <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-4 h-fit shadow-sm">
        <h3 className="text-lg text-primary font-bold font-inria mb-2.5 flex items-center gap-2">
          Write MCQ Manually
        </h3>

        {qMessage && (
          <div className={`p-4 mb-2 rounded-xl text-xs border transition-opacity ${qMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>{qMessage.text}</div>
        )}

        <form onSubmit={handleCreateQuestion} className="space-y-4">
          <div>
            <label htmlFor="q-theory" className="block text-sm font-bold font-inria text-primary mb-1">Select Theory</label>
            <select
              id="q-theory"
              required
              value={selectedTheoryId}
              onChange={(e) => setSelectedTheoryId(e.target.value)}
              className="w-full px-3 py-2 font-serif border border-border bg-background rounded-xl focus:ring-3 focus:ring-primary focus:border-transparent text-sm">
              <option value="">Choose a Theory</option>
              {theories.map((t) => (
                <option key={t.id} value={t.id}>{t.title} ({t.domain})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="q-stem" className="block text-sm font-bold font-inria text-primary mb-1">Question</label>
            <textarea
              id="q-stem"
              required
              rows={2}
              value={qStem}
              onChange={(e) => setQStem(e.target.value)}
              className="w-full px-2 py-2 font-inria border border-border bg-background rounded-xl focus:ring-3 focus:ring-primary focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* MCQ Choices */}
          <div className="space-y-2.5">
            <label className="block text-sm font-bold font-inria text-primary">Choices & Correct Answer</label>
            {qOptions.map((opt, idx) => {
              const isSelected = qCorrectIndex === idx;
              return (
                <div key={idx} className="flex items-center gap-2 w-full">
                  {/* Letter Label Box */}
                  <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-bold font-serif text-xs select-none transition-all duration-200 ${
                    isSelected 
                      ? 'bg-emerald-500/20 text-[#15803D] dark:bg-emerald-500/30 dark:text-emerald-400' 
                      : 'bg-slate-50 dark:bg-neutral-800/50 text-slate-600 dark:text-neutral-400'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </div>

                  {/* Radio Button */}
                  <input
                    type="radio"
                    name="correct-choice"
                    checked={qCorrectIndex === idx}
                    onChange={() => setQCorrectIndex(idx)}
                    className="w-3 h-3 cursor-pointer shrink-0"
                    aria-label={`Mark choice ${String.fromCharCode(65 + idx)} as correct`}
                  />

                  {/* Text Input */}
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Choice ${String.fromCharCode(65 + idx)}`}
                    className={`flex-1 px-3.5 py-2.5 font-serif rounded-xl text-xs transition-all duration-200 ${
                      isSelected
                        ? 'bg-emerald-500/20 dark:bg-emerald-500/30 border-[#D1F2D9] dark:border-emerald-900/30 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/50'
                        : 'bg-white dark:bg-neutral-800 border-slate-100 dark:border-neutral-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/10 focus:border-primary/40'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div>
            <label htmlFor="q-explanation" className="block text-sm font-inria font-bold text-primary mb-1">Explanation</label>
            <textarea
              id="q-explanation"
              required
              rows={3}
              value={qExplanation}
              onChange={(e) => setQExplanation(e.target.value)}
              placeholder="Provide a detailed explanation of why the correct answer is right and why others are incorrect."
              className="w-full p-2 border border-border font-inria bg-background rounded-sm focus:outline-none focus:ring-3 focus:ring-primary focus:border-transparent text-sm resize"/>
          </div>

          <div>
            <label htmlFor="q-source" className="block text-sm font-inria font-bold text-primary mb-1">Source Excerpt (Optional)</label>
            <textarea
              id="q-source"
              rows={2}
              value={qSourceExcerpt}
              onChange={(e) => setQSourceExcerpt(e.target.value)}
              placeholder="Quote the exact line/phrase from the theory body that supports this answer..."
              className="w-full p-2 border border-border font-inria bg-background rounded-sm focus:outline-none focus:ring-3 focus:ring-primary focus:border-transparent text-sm resize"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="q-difficulty" className="block text-sm font-inria font-bold text-primary mb-1.5">Difficulty</label>
              <select
                id="q-difficulty"
                value={qDifficulty}
                onChange={(e) => setQDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full px-2 py-2 font-serif border border-border bg-background rounded-xl text-xs"
              >
                <option value={1}>1 (Easy)</option>
                <option value={2}>2 (Medium)</option>
                <option value={3}>3 (Hard)</option>
              </select>
            </div>

            <div>
              <label htmlFor="q-bloom" className="block text-sm font-inria font-bold text-primary mb-1.5">Bloom Level</label>
              <select
                id="q-bloom"
                value={qBloomLevel}
                onChange={(e) => setQBloomLevel(e.target.value as BloomLevel)}
                className="w-full px-2 py-2 font-serif border border-border bg-background rounded-xl text-xs"
              >
                <option value="remember">Remember</option>
                <option value="understand">Understand</option>
                <option value="apply">Apply</option>
                <option value="analyze">Analyze</option>
                <option value="evaluate">Evaluate</option>
                <option value="create">Create</option>
              </select>
            </div>

            <div>
              <label htmlFor="q-status" className="block text-sm font-inria font-bold text-primary mb-1.5">Status</label>
              <select
                id="q-status"
                value={qStatus}
                onChange={(e) => setQStatus(e.target.value as 'draft' | 'approved')}
                className="w-full px-2 py-2 font-serif border border-border bg-background rounded-xl text-xs"
              >
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <button type="submit"
            disabled={qSubmitLoading}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold font-serif rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 disabled:opacity-50">
            {qSubmitLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (<>
                <Plus className="w-4 h-4" />
                Add & Approve MCQ
              </>)}
          </button>
        </form>
      </div>

      {/* Questions List */}
      <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6 h-fit min-h-[400px]">
        <div className="flex flex-col gap-3 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-primary tracking-tight font-inria">Existing Questions</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/10 font-mono">Total: {filteredQuestions.length}</span>
          </div>
          
          {/* Horizontal Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center w-full">
            {/* Search Input */}
            <div className="relative">
              <input
                type="search"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-background rounded-xl text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            </div>

            {/* Theories Filter */}
            <select
              value={filterTheoryId}
              onChange={(e) => setFilterTheoryId(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 dark:border-neutral-700 bg-background rounded-xl text-[11px] font-semibold font-serif text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
            >
              <option value="">All Theories</option>
              {theories.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>

            {/* Difficulty Filter */}
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 dark:border-neutral-700 bg-background rounded-xl text-[11px] font-semibold font-serif text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">All Difficulty</option>
              <option value="1">L1 (Easy)</option>
              <option value="2">L2 (Medium)</option>
              <option value="3">L3 (Hard)</option>
            </select>

            {/* Bloom Level Filter */}
            <select
              value={filterBloomLevel}
              onChange={(e) => setFilterBloomLevel(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 dark:border-neutral-700 bg-background rounded-xl text-[11px] font-semibold font-serif text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">All Bloom Levels</option>
              <option value="remember">Remember</option>
              <option value="understand">Understand</option>
              <option value="apply">Apply</option>
              <option value="analyze">Analyze</option>
              <option value="evaluate">Evaluate</option>
              <option value="create">Create</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 dark:border-neutral-700 bg-background rounded-xl text-[11px] font-semibold font-serif text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {loadingLists ? (
          <div className="space-y-4 animate-fade-in">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/40 p-4 space-y-3 bg-card">
                <div className="flex justify-between items-center">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
                <div className="skeleton h-3.5 w-2/3" />
                <div className="skeleton h-3 w-5/6" />
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-2 text-muted-foreground/45" />
            <p>No questions created yet.</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-2 text-muted-foreground/45" />
            <p>No questions match the active search and filters.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[760px] overflow-y-auto pr-2">
            {filteredQuestions.map((q) => {
              const expanded = expandedIds[q.id] ?? false;
              
              // Difficulty color theme
              let diffText = 'L1';
              let diffBgClass = 'bg-emerald-50 border border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30';
              if (q.difficulty === 2) {
                diffText = 'L2';
                diffBgClass = 'bg-[#FFF5E6] border border-[#FFE2C2] text-[#D69E2E] dark:bg-amber-950/20 dark:border-amber-900/30';
              } else if (q.difficulty === 3) {
                diffText = 'L3';
                diffBgClass = 'bg-[#FFF0E6] border border-[#FFD2B8] text-[#DD6B20] dark:bg-orange-950/20 dark:border-orange-900/30';
              }
              
              // Bloom Level color theme
              let bloomBgClass = 'bg-[#EBF8FF] border border-[#BEE3F8] text-[#3182CE] dark:bg-blue-950/20 dark:border-blue-900/30';
              if (q.bloom_level === 'evaluate' || q.bloom_level === 'create' || q.bloom_level === 'analyze') {
                bloomBgClass = 'bg-[#FAF5FF] border border-[#E9D8FD] text-[#805AD5] dark:bg-purple-950/20 dark:border-purple-900/30';
              } else if (q.bloom_level === 'remember') {
                bloomBgClass = 'bg-slate-50 border border-slate-200 text-slate-600 dark:bg-neutral-800 dark:border-neutral-700';
              }

              return (
                <div
                  key={q.id}
                  className="p-3 rounded-2xl border border-primary/20 dark:border-neutral-800 bg-white dark:bg-neutral-800 shadow-sm flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-md relative"
                >
                  {inlineEditingId === q.id ? (
                    <div className="space-y-4 text-xs">
                      <div className="flex justify-between items-center pb-2">
                        <span className="pl-0.5 text-sm font-inria font-bold text-primary uppercase">Edit MCQ</span>
                        <span className="text-[10px] text-muted-foreground">ID: {q.id.substring(0, 8)}…</span>
                      </div>

                      <div>
                        <label className="block text-sm font-inria font-bold text-muted-foreground mb-1">Question</label>
                        <textarea
                          value={inlineStem}
                          onChange={(e) => setInlineStem(e.target.value)}
                          rows={3}
                          className="w-full px-2.5 py-2 font-inria text-xs border border-border bg-background rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="block text-sm font-inria font-bold text-muted-foreground">Choices &amp; Correct Index</label>
                        {inlineOptions.map((opt, oIdx) => {
                          const isSelected = inlineCorrectIndex === oIdx;
                          return (
                            <div key={oIdx} className="flex items-center gap-2 w-full">
                              {/* Letter Label Box */}
                              <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-serif font-bold text-xs select-none transition-all duration-200 ${
                                isSelected 
                                  ? 'bg-emerald-500/20 text-[#15803D] dark:bg-emerald-950/30 dark:text-emerald-400' 
                                  : 'bg-slate-50 dark:bg-neutral-800/50 text-slate-600 dark:text-neutral-400'
                              }`}>
                                {String.fromCharCode(65 + oIdx)}
                              </div>

                              {/* Radio Button */}
                              <input
                                type="radio"
                                name={`inline-correct-approved-${q.id}`}
                                checked={inlineCorrectIndex === oIdx}
                                onChange={() => setInlineCorrectIndex(oIdx)}
                                className="w-3 h-3 cursor-pointer shrink-0"
                              />

                              {/* Text Input */}
                              <input
                                type="text"
                                required
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...inlineOptions];
                                  newOpts[oIdx] = e.target.value;
                                  setInlineOptions(newOpts);
                                }}
                                className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-serif focus:outline-none transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-emerald-500/20 dark:bg-emerald-950/10 text-slate-800 dark:text-slate-200'
                                    : 'bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div>
                        <label className="block text-sm font-bold font-inria text-muted-foreground mb-1">Explanation</label>
                        <textarea
                          value={inlineExplanation}
                          onChange={(e) => setInlineExplanation(e.target.value)}
                          rows={3}
                          className="w-full p-2 font-serif border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-3 focus:ring-primary"/>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold font-inria text-muted-foreground mb-1">Difficulty</label>
                          <select
                            value={inlineDifficulty}
                            onChange={(e) => setInlineDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                            className="w-full px-2 py-1.5 font-serif border border-border bg-background rounded-xl text-xs"
                          >
                            <option value={1}>L1 (Easy)</option>
                            <option value={2}>L2 (Medium)</option>
                            <option value={3}>L3 (Hard)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold font-inria text-muted-foreground mb-1">Bloom Level</label>
                          <select
                            value={inlineBloomLevel}
                            onChange={(e) => setInlineBloomLevel(e.target.value as BloomLevel)}
                            className="w-full px-2 py-1.5 font-serif border border-border bg-background rounded-xl text-xs"
                          >
                            <option value="remember">Remember</option>
                            <option value="understand">Understand</option>
                            <option value="apply">Apply</option>
                            <option value="analyze">Analyze</option>
                            <option value="evaluate">Evaluate</option>
                            <option value="create">Create</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1 border-t border-border/40">

                        <button
                          type="button"
                          onClick={() => setInlineEditingId(null)}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold font-serif bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer">Cancel</button>
                        <button
                          type="button"
                          onClick={() => handleSaveInlineEdit(q.id)}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold font-serif text-white bg-primary hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Header Row */}
                      <div className="flex justify-between items-center gap-4 relative">
                        {/* Theory Tag */}
                        <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-serif font-bold bg-primary/20 text-primary border border-primary/20 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-900/40 select-none">{q.theories?.title ?? 'Unknown Theory'}</span>
                        
                        {/* Action buttons on the right */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStartInlineEdit(q)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>

                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === q.id ? null : q.id)}
                              className="p-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 shadow-sm transition-all cursor-pointer flex items-center justify-center"
                              title="More options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeMenuId === q.id && (
                              <div className="absolute right-0 top-10 z-30 bg-card border border-border rounded-xl shadow-lg p-1 w-24">
                                <button
                                  onClick={() => {
                                    handleDeleteMCQ(q.id);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 text-left text-xs font-semibold transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => toggleExpand(q.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer flex items-center justify-center"
                          >
                            {expanded ? <ChevronUp className="w-4 h-4 stroke-[3]" /> : <ChevronDown className="w-4 h-4 stroke-[3]" />}
                          </button>
                        </div>
                      </div>

                      {/* Question Stem */}
                      <p className="font-bold font-inria text-slate-900 dark:text-slate-100 text-sm leading-snug max-w-full">{q.stem}</p>

                      {/* Accordion content */}
                      {expanded && (
                        <div className="space-y-3.5 animate-fade-in pt-1">
                          {/* Correct option shown in green box */}
                          <div className="border border-emerald-100 bg-[#F0FAF3] text-[#1D7A46] dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30 font-semibold text-xs p-2.5 px-3.5 rounded-xl flex items-center gap-2">
                            <span className="font-extrabold tracking-wider">{String.fromCharCode(65 + q.correct_index)}.</span>
                            <span>{q.options[q.correct_index]}</span>
                          </div>

                          {/* Explanation Box */}
                          <div className="bg-primary/10 dark:bg-neutral-800/40 border border-primary/5 ring-0 dark:border-neutral-700/30 p-2 rounded-xl text-xs text-[#4A5568] dark:text-neutral-300">
                            <strong className="text-foreground font-bold">Explanation:</strong> {q.explanation}
                          </div>

                          {/* Source Excerpt */}
                          {q.source_excerpt && (
                            <div className="bg-primary/5 dark:bg-neutral-800/20 border border-slate-100/80 dark:border-neutral-700/20 p-2 rounded-xl text-xs italic text-[#4A5568] dark:text-neutral-300 leading-relaxed">
                              <strong className="text-foreground font-bold not-italic">Quote:</strong> &ldquo;{q.source_excerpt}&rdquo;
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bottom Badges Row */}
                      <div className="flex flex-wrap items-center gap-1 text-[9px] select-none">
                        <span className={`px-2 py-0.5 rounded-[6px] font-extrabold uppercase ${diffBgClass}`}>
                          {diffText}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-[6px] font-semibold capitalize ${bloomBgClass}`}>
                          {q.bloom_level}
                        </span>
                        {q.status === 'approved' ? (
                          <span className="px-2.5 py-0.5 rounded-[6px] font-semibold bg-[#E6FFFA] border border-[#B2F5EA] text-[#319795] dark:bg-teal-950/20 dark:border-teal-900/30 flex items-center gap-1">
                            Approved
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-[6px] font-semibold bg-slate-50 border border-slate-200 text-slate-500 dark:bg-neutral-800 dark:border-neutral-700">Draft</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );}
