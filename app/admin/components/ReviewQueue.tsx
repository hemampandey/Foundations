'use client';

import React, { useState } from 'react';
import { Save, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { QuestionWithTheory, BloomLevel } from '@/lib/types';
import { useToast } from '@/app/components/ToastProvider';

interface ReviewQueueProps {
  questions: QuestionWithTheory[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionWithTheory[]>>;
  loadingLists: boolean;
  loadDbData: (silent?: boolean) => Promise<void>;
  setActiveTab: (tab: 'theories' | 'questions' | 'review' | 'journeys') => void;
}

export default function ReviewQueue({
  questions,
  setQuestions,
  loadingLists,
  loadDbData,
  setActiveTab,
}: ReviewQueueProps) {
  const { showToast } = useToast();
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkRejectConfirm, setShowBulkRejectConfirm] = useState(false);
  const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());

  const toggleSelectQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const draftIds = questions.filter((q) => q.status === 'draft').map((q) => q.id);
    if (selectedIds.size === draftIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(draftIds));
    }
  };

  const handleBulkApprove = async () => {
    const idsToApprove = Array.from(selectedIds);
    if (idsToApprove.length === 0) return;

    setAnimatingOutIds((prev) => {
      const next = new Set(prev);
      idsToApprove.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds(new Set());

    try {
      const { error } = await supabase
        .from('questions')
        .update({ status: 'approved' })
        .in('id', idsToApprove);

      if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 500));

      setQuestions((prev) =>
        prev.map((q) => (idsToApprove.includes(q.id) ? { ...q, status: 'approved' } : q))
      );
      showToast(`✓ Approved ${idsToApprove.length} MCQs`, 'success');
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err) {
      console.error('Failed to bulk approve questions:', err);
      showToast('Failed to bulk approve questions.', 'error');
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        idsToApprove.forEach((id) => next.delete(id));
        return next;
      });
      loadDbData(true);
    } finally {
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        idsToApprove.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const handleBulkReject = async () => {
    const idsToReject = Array.from(selectedIds);
    if (idsToReject.length === 0) return;

    setAnimatingOutIds((prev) => {
      const next = new Set(prev);
      idsToReject.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds(new Set());
    setShowBulkRejectConfirm(false);

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .in('id', idsToReject);

      if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 500));

      setQuestions((prev) => prev.filter((q) => !idsToReject.includes(q.id)));
      showToast(`✗ Deleted ${idsToReject.length} questions`, 'info');
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err) {
      console.error('Failed to bulk delete questions:', err);
      showToast('Failed to bulk delete questions.', 'error');
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        idsToReject.forEach((id) => next.delete(id));
        return next;
      });
      loadDbData(true);
    } finally {
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        idsToReject.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanations((prev) => ({
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
        q.id === id
          ? {
              ...q,
              stem: inlineStem,
              options: inlineOptions,
              correct_index: inlineCorrectIndex,
              explanation: inlineExplanation,
              difficulty: inlineDifficulty,
              bloom_level: inlineBloomLevel,
            } : q )
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
      showToast('Changes saved', 'success');
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err: unknown) {
      console.error('Failed to save inline edit:', err);
      showToast('Failed to save changes.', 'error');
      loadDbData(true);
    }
  };

  const handleApproveQuestion = async (id: string) => {
    setAnimatingOutIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const { error } = await supabase
        .from('questions')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 500));

      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: 'approved' } : q))
      );
      showToast('MCQ approved', 'success');
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err: unknown) {
      console.error('[Foundations] Error approving question:', err);
      showToast('Failed to approve question.', 'error');
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadDbData(true);
    } finally {
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRejectQuestion = async (id: string) => {
    setAnimatingOutIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRejectingId(null);

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 500));

      setQuestions((prev) => prev.filter((q) => q.id !== id));
      showToast('Question deleted', 'info');
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err: unknown) {
      console.error('[Foundations] Error rejecting question:', err);
      showToast('Failed to reject question.', 'error');
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadDbData(true);
    } finally {
      setAnimatingOutIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const draftQuestions = questions.filter((q) => q.status === 'draft');

  return (
    <div className="lg:col-span-12 bg-card border border-border rounded-2xl p-6 min-h-[400px]">
      <div className="border-b border-border pb-4 mb-6">
        <h3 className="text-lg font-bold font-inria text-primary">MCQ Review Queue ({draftQuestions.length})</h3>
        <p className="text-xs font-inria text-muted-foreground mt-1">Approve or edit generated question drafts before they go live on learner dashboards.</p>
      </div>

      {loadingLists ? (
        <div className="space-y-4 animate-fade-in">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/40 p-5 space-y-4 bg-card">
              <div className="flex justify-between items-center">
                <div className="skeleton h-4 w-1/4" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : draftQuestions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Layers className="w-12 h-12 mx-auto mb-2 text-primary/30" />
          <p className="font-semibold text-sm">Review Queue is Empty</p>
          <p className="text-sm font-serif text-muted-foreground/80 mt-1">
            Go to the <strong className="text-primary cursor-pointer hover:underline" onClick={() => setActiveTab('theories')}>Theories Tab</strong> and click &ldquo;Generate MCQs&rdquo; to draft questions automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Actions Control Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/35 border border-border/60 rounded-2xl p-4 mb-6 text-xs select-none">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer font-bold font-serif text-primary">
                <input
                  type="checkbox"
                  checked={selectedIds.size === draftQuestions.length && draftQuestions.length > 0}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selectedIds.size > 0 && selectedIds.size < draftQuestions.length;
                    }
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded text-primary border-border focus:ring-primary cursor-pointer shrink-0"
                />
                <span>Select All</span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-[10px] text-muted-foreground font-bold">
                  ({selectedIds.size} selected)
                </span>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleBulkApprove}
                  className="flex-1 sm:flex-none py-2 px-4 rounded-xl text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all cursor-pointer text-center animate-scale-in"
                >
                  Approve Selected ({selectedIds.size})
                </button>
                
                {showBulkRejectConfirm ? (
                  <div className="flex items-center gap-2 flex-1 sm:flex-none bg-destructive/5 border border-destructive/20 rounded-xl p-1 px-2.5 animate-scale-in">
                    <span className="text-[10px] font-bold text-destructive font-serif">Delete selected?</span>
                    <button
                      onClick={() => setShowBulkRejectConfirm(false)}
                      className="py-1 px-2 rounded-lg text-[9px] font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkReject}
                      className="py-1 px-2 rounded-lg text-[9px] font-bold text-white bg-destructive hover:opacity-90 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBulkRejectConfirm(true)}
                    className="flex-1 sm:flex-none py-2 px-4 rounded-xl text-[10px] font-bold text-white bg-destructive hover:opacity-95 transition-all cursor-pointer text-center"
                  >
                    Reject Selected ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {draftQuestions.map((q) => (
              <div
                key={q.id}
                className={`transition-all duration-500 ease-in-out relative overflow-hidden ${
                  animatingOutIds.has(q.id)
                    ? 'max-h-0 p-0 my-0 border-0 opacity-0 scale-90 pointer-events-none gap-0'
                    : 'max-h-[800px] p-5 rounded-2xl border bg-card hover:border-primary/20 shadow-sm flex flex-col justify-between gap-5'
                } ${
                  selectedIds.has(q.id) && !animatingOutIds.has(q.id)
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md'
                    : 'border-border'
                }`}>
              {inlineEditingId === q.id ? (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b border-border/40 pb-0.5">
                    <span className="text-[10px] font-bold text-primary uppercase">Edit</span>
                    <span className="text-[10px] text-muted-foreground">ID: {q.id.substring(0, 8)}…</span>
                  </div>

                  <div>
                    <label className="block text-sm font-bold font-inria text-primary mb-1">Question</label>
                    <textarea
                      value={inlineStem}
                      onChange={(e) => setInlineStem(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-2 border border-border bg-background rounded-[8px] text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold font-inria text-primary">Choices & Correct Index</label>
                    {inlineOptions.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`inline-correct-${q.id}`}
                          checked={inlineCorrectIndex === oIdx}
                          onChange={() => setInlineCorrectIndex(oIdx)}
                          className="h-3.5 w-3.5 text-primary border-gray-300 focus:ring-primary shrink-0 cursor-pointer"/>
                        <span className="text-[10px] font-bold text-muted-foreground shrink-0 w-3">{String.fromCharCode(65 + oIdx)}</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...inlineOptions];
                            newOpts[oIdx] = e.target.value;
                            setInlineOptions(newOpts);
                          }}
                          className="flex-1 px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-bold font-inria text-primary mb-1">Explanation</label>
                    <textarea
                      value={inlineExplanation}
                      onChange={(e) => setInlineExplanation(e.target.value)}
                      rows={3}
                      className="w-full px-2.5 py-2 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold font-inria text-primary mb-1">Difficulty</label>
                      <select
                        value={inlineDifficulty}
                        onChange={(e) => setInlineDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-max px-2 py-1.5 border border-border bg-background rounded-xl text-xs">
                        <option value={1}>L1 (Easy)</option>
                        <option value={2}>L2 (Medium)</option>
                        <option value={3}>L3 (Hard)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold font-inria text-primary mb-1">Bloom Level</label>
                      <select
                        value={inlineBloomLevel}
                        onChange={(e) => setInlineBloomLevel(e.target.value as BloomLevel)}
                        className="w-max px-2 py-1.5 border border-border bg-background rounded-xl text-xs">
                        <option value="remember">Remember</option>
                        <option value="understand">Understand</option>
                        <option value="apply">Apply</option>
                        <option value="analyze">Analyze</option>
                        <option value="evaluate">Evaluate</option>
                        <option value="create">Create</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => setInlineEditingId(null)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer">Cancel</button>
                    <button
                      type="button"
                      onClick={() => handleSaveInlineEdit(q.id)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-primary hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (<>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleSelectQuestion(q.id)}
                          className="h-4 w-4 mt-0.5 rounded text-primary border-border focus:ring-primary cursor-pointer shrink-0"
                        />
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-serif uppercase bg-primary/10 text-primary border border-primary/10 max-w-[300px] truncate" title={q.theories?.title}>
                          {q.theories?.title ?? 'Theory Link'}
                        </span>
                      </div>
                      <div className="flex gap-1.5 text-[9px] font-bold shrink-0 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Difficulty: L{q.difficulty}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 uppercase">
                          {q.bloom_level}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold font-serif text-foreground">{q.stem}</h4>

                    <ul className="space-y-1.0 text-xs font-serif text-muted-foreground">
                      {q.options.map((opt: string, oIdx: number) => {
                        const isCorrect = oIdx === q.correct_index;
                        return (
                          <li
                            key={oIdx}
                            className={`flex items-start gap-2 p-1.5 rounded-xl border ${isCorrect ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:text-emerald-400 font-semibold' : 'border-transparent'}`}>
                            <span className="font-bold shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                            <span>{opt}</span>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="border border-border/40 rounded-xl overflow-hidden bg-secondary/35 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleExplanation(q.id)}
                        className="w-full flex items-center justify-between p-2 font-inria font-bold text-[12px] text-muted-foreground hover:bg-secondary/60 transition-all cursor-pointer">
                        <span>Answer & Explanation</span>
                        {expandedExplanations[q.id] ? (<ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />) : (<ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />)}
                      </button>

                      {expandedExplanations[q.id] && (
                        <div className="p-2 pt-0 border-t border-border/20 font-serif text-muted-foreground leading-relaxed animate-fade-in">{q.explanation}</div>
                      )}
                    </div>

                    {q.source_excerpt && (
                      <div className="text-[11px] text-muted-foreground italic pl-1 border-l border-border pt-0.5">
                        <strong>Source Excerpt:</strong> &ldquo;{q.source_excerpt}&rdquo;
                      </div>
                    )}
                  </div>

                  {rejectingId === q.id ? (
                    <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2.5 mt-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 bg-destructive/5 p-2.5 rounded-xl border border-destructive/10">
                      <span className="text-[10px] font-bold font-serif text-destructive">Confirm deletion?</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer">Cancel</button>
                        <button
                          type="button"
                          onClick={() => handleRejectQuestion(q.id)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-destructive hover:opacity-90 transition-all cursor-pointer">Confirm</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3 mt-auto">
                      <button
                        onClick={() => handleStartInlineEdit(q)}
                        className="py-1.5 px-3.5 rounded-xl text-[10px] font-bold font-serif text-secondary border border-border bg-primary/80 hover:bg-secondary transition-all cursor-pointer text-center">Edit</button>
                      <button
                        onClick={() => setRejectingId(q.id)}
                        className="py-1.5 px-3.5 rounded-xl text-[10px] font-bold font-serif text-white bg-red-500 hover:bg-red-600 shadow-sm transition-all cursor-pointer text-center">Reject</button>
                      <button
                        onClick={() => handleApproveQuestion(q.id)}
                        className="py-1.5 px-3.5 rounded-xl text-[10px] font-bold font-serif text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all cursor-pointer text-center">Approve</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </>
      )}
    </div>
  );
}
