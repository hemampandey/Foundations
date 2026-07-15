'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Save, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Theory, QuestionWithTheory, BloomLevel } from '@/lib/types';

interface ManageMCQsProps {
  theories: Theory[];
  questions: QuestionWithTheory[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionWithTheory[]>>;
  loadingLists: boolean;
  loadDbData: () => Promise<void>;
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

  const handleOptionChange = (index: number, val: string) => {
    const nextOpts = [...qOptions];
    nextOpts[index] = val;
    setQOptions(nextOpts);
  };

  const approvedQuestions = questions.filter((q) => q.status === 'approved');

  return (
    <>
      {/* Create MCQ Form */}
      <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6 h-fit shadow-sm">
        <h3 className="text-lg font-bold font-display mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-inria" />
          Write MCQ Question
        </h3>

        {qMessage && (
          <div
            className={`p-4 mb-4 rounded-xl text-xs border transition-opacity ${qMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
          >
            {qMessage.text}
          </div>
        )}

        <form onSubmit={handleCreateQuestion} className="space-y-4">
          <div>
            <label htmlFor="q-theory" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Select Theory
            </label>
            <select
              id="q-theory"
              required
              value={selectedTheoryId}
              onChange={(e) => setSelectedTheoryId(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              <option value="">Choose a Theory</option>
              {theories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.domain})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="q-stem" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Question
            </label>
            <textarea
              id="q-stem"
              required
              rows={2}
              value={qStem}
              onChange={(e) => setQStem(e.target.value)}
              className="w-full px-2 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* MCQ Choices */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choices &amp; Correct Answer</label>
            {qOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct-choice"
                  checked={qCorrectIndex === idx}
                  onChange={() => setQCorrectIndex(idx)}
                  className="w-4 h-4 text-primary focus:ring-primary border-border bg-background cursor-pointer"
                  aria-label={`Mark choice ${String.fromCharCode(65 + idx)} as correct`}
                />
                <input
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Choice ${String.fromCharCode(65 + idx)}`}
                  className="w-full px-3 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"/>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="q-explanation" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Explanation</label>
            <textarea
              id="q-explanation"
              required
              rows={3}
              value={qExplanation}
              onChange={(e) => setQExplanation(e.target.value)}
              placeholder="Provide a detailed explanation of why the correct answer is right and why others are incorrect."
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none"/>
          </div>

          <div>
            <label htmlFor="q-source" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Source Excerpt (Optional)</label>
            <textarea
              id="q-source"
              rows={2}
              value={qSourceExcerpt}
              onChange={(e) => setQSourceExcerpt(e.target.value)}
              placeholder="Quote the exact line/phrase from the theory body that supports this answer..."
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="q-difficulty" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Difficulty</label>
              <select
                id="q-difficulty"
                value={qDifficulty}
                onChange={(e) => setQDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full px-2 py-2 border border-border bg-background rounded-xl text-xs"
              >
                <option value={1}>1 (Easy)</option>
                <option value={2}>2 (Medium)</option>
                <option value={3}>3 (Hard)</option>
              </select>
            </div>

            <div>
              <label htmlFor="q-bloom" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Bloom Level</label>
              <select
                id="q-bloom"
                value={qBloomLevel}
                onChange={(e) => setQBloomLevel(e.target.value as BloomLevel)}
                className="w-full px-2 py-2 border border-border bg-background rounded-xl text-xs"
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
              <label htmlFor="q-status" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</label>
              <select
                id="q-status"
                value={qStatus}
                onChange={(e) => setQStatus(e.target.value as 'draft' | 'approved')}
                className="w-full px-2 py-2 border border-border bg-background rounded-xl text-xs"
              >
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={qSubmitLoading}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 disabled:opacity-50">
            {qSubmitLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (<>
                <Plus className="w-4 h-4" />
                Add &amp; Approve MCQ
              </>)}
          </button>
        </form>
      </div>

      {/* Questions List */}
      <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6 h-fit min-h-[400px]">
        <h3 className="text-lg font-bold font-display mb-4">Existing Questions ({approvedQuestions.length})</h3>

        {loadingLists ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : approvedQuestions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-2 text-muted-foreground/45" />
            <p>No approved questions created yet.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {approvedQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-border hover:border-primary/20 transition-all bg-background/50 flex flex-col justify-between gap-3 text-xs"
              >
                {inlineEditingId === q.id ? (
                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between items-center border-b border-border/40 pb-2">
                      <span className="text-[10px] font-bold text-primary uppercase">Edit MCQ</span>
                      <span className="text-[10px] text-muted-foreground">ID: {q.id.substring(0, 8)}…</span>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Question Stem</label>
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
                            name={`inline-correct-approved-${q.id}`}
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
                            className="flex-1 px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
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
                        className="w-full px-2.5 py-2 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
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
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer">Cancel</button>
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
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/10 truncate max-w-[200px]" title={q.theories?.title}>
                        {q.theories?.title ?? 'Unknown Theory'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartInlineEdit(q)}
                          className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/10 font-bold hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-600 font-bold uppercase tracking-wide border border-amber-500/10">
                          L{q.difficulty}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-600 uppercase font-bold tracking-wide border border-blue-500/10">
                          {q.bloom_level}
                        </span>
                      </div>
                    </div>

                    <p className="font-bold text-foreground mt-2 font-display text-sm leading-snug">{q.stem}</p>

                    <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
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

                    <p className="mt-3 text-muted-foreground bg-secondary/35 p-3 rounded-xl border border-border/40 leading-relaxed">
                      <strong className="text-foreground">Explanation:</strong> {q.explanation}
                    </p>

                    {q.source_excerpt && (
                      <p className="mt-2 text-muted-foreground/70 italic text-[11px]">
                        <strong>Quote:</strong> &ldquo;{q.source_excerpt}&rdquo;
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );}
