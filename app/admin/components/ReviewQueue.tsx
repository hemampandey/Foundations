'use client';

import React, { useState } from 'react';
import { Save, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { QuestionWithTheory, BloomLevel } from '@/lib/types';

interface ReviewQueueProps {
  questions: QuestionWithTheory[];
  loadingLists: boolean;
  loadDbData: () => Promise<void>;
  setActiveTab: (tab: 'theories' | 'questions' | 'review' | 'journeys') => void;
}

export default function ReviewQueue({
  questions,
  loadingLists,
  loadDbData,
  setActiveTab,
}: ReviewQueueProps) {
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
      setInlineEditingId(null);
      await loadDbData();
    } catch (err: unknown) {
      console.error('Failed to save inline edit:', err);
    }
  };

  const handleApproveQuestion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      await loadDbData();
    } catch (err: unknown) {
      console.error('[Foundations] Error approving question:', err);
    }
  };

  const handleRejectQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete/reject this question draft?')) return;
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadDbData();
    } catch (err: unknown) {
      console.error('[Foundations] Error deleting question:', err);
    }
  };

  const draftQuestions = questions.filter((q) => q.status === 'draft');

  return (
    <div className="lg:col-span-12 bg-card border border-border rounded-2xl p-6 min-h-[400px]">
      <div className="border-b border-border pb-4 mb-6">
        <h3 className="text-xl font-bold font-display text-foreground">
          MCQ Review Queue ({draftQuestions.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Approve or edit generated question drafts before they go live on learner dashboards.
        </p>
      </div>

      {loadingLists ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : draftQuestions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Layers className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
          <p className="font-semibold text-sm">Review Queue is Empty</p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Go to the <strong className="text-primary cursor-pointer hover:underline" onClick={() => setActiveTab('theories')}>Theories Tab</strong> and click &ldquo;Generate MCQs&rdquo; to draft questions automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {draftQuestions.map((q) => (
            <div
              key={q.id}
              className="p-5 rounded-2xl border border-border bg-card hover:border-primary/20 transition-all flex flex-col justify-between gap-5 relative shadow-sm"
            >
              {inlineEditingId === q.id ? (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <span className="text-[10px] font-bold text-primary uppercase">Edit</span>
                    <span className="text-[10px] text-muted-foreground">ID: {q.id.substring(0, 8)}…</span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Question Stem
                    </label>
                    <textarea
                      value={inlineStem}
                      onChange={(e) => setInlineStem(e.target.value)}
                      rows={3}
                      className="w-full px-2.5 py-2 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Choices &amp; Correct Index
                    </label>
                    {inlineOptions.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`inline-correct-${q.id}`}
                          checked={inlineCorrectIndex === oIdx}
                          onChange={() => setInlineCorrectIndex(oIdx)}
                          className="h-3.5 w-3.5 text-primary border-gray-300 focus:ring-primary shrink-0 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-muted-foreground shrink-0 w-3">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...inlineOptions];
                            newOpts[oIdx] = e.target.value;
                            setInlineOptions(newOpts);
                          }}
                          className="flex-1 px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Explanation
                    </label>
                    <textarea
                      value={inlineExplanation}
                      onChange={(e) => setInlineExplanation(e.target.value)}
                      rows={3}
                      className="w-full px-2.5 py-2 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Difficulty
                      </label>
                      <select
                        value={inlineDifficulty}
                        onChange={(e) => setInlineDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-full px-2 py-1.5 border border-border bg-background rounded-xl text-xs"
                      >
                        <option value={1}>L1 (Easy)</option>
                        <option value={2}>L2 (Medium)</option>
                        <option value={3}>L3 (Hard)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Bloom Level
                      </label>
                      <select
                        value={inlineBloomLevel}
                        onChange={(e) => setInlineBloomLevel(e.target.value as BloomLevel)}
                        className="w-full px-2 py-1.5 border border-border bg-background rounded-xl text-xs"
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

                  <div className="flex gap-2 pt-3 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => setInlineEditingId(null)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveInlineEdit(q.id)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-primary hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/10 max-w-[200px] truncate" title={q.theories?.title}>
                        {q.theories?.title ?? 'Theory Link'}
                      </span>
                      <div className="flex gap-1.5 text-[9px] font-bold">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                          Difficulty: L{q.difficulty}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 uppercase">
                          {q.bloom_level}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-foreground font-display leading-snug">
                      {q.stem}
                    </h4>

                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {q.options.map((opt: string, oIdx: number) => {
                        const isCorrect = oIdx === q.correct_index;
                        return (
                          <li
                            key={oIdx}
                            className={`flex items-start gap-2 p-1.5 rounded-xl border ${isCorrect
                              ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:text-emerald-400 font-semibold'
                              : 'border-transparent'
                              }`}
                          >
                            <span className="font-bold shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                            <span>{opt}</span>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="p-3 bg-secondary/50 border border-border/40 rounded-xl space-y-1 text-xs">
                      <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider block">
                        Explanation:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">
                        {q.explanation}
                      </p>
                    </div>

                    {q.source_excerpt && (
                      <div className="text-[10px] text-muted-foreground italic pl-1 border-l border-border pt-0.5">
                        <strong>Source Excerpt:</strong> &ldquo;{q.source_excerpt}&rdquo;
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-border/40 pt-4 mt-auto">
                    <button
                      onClick={() => handleApproveQuestion(q.id)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all cursor-pointer text-center"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStartInlineEdit(q)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-secondary-foreground border border-border bg-card hover:bg-secondary transition-all cursor-pointer text-center"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRejectQuestion(q.id)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-destructive hover:opacity-95 transition-all cursor-pointer text-center"
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
