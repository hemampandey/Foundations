'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Edit, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Theory, Question } from '@/lib/types';

interface ManageTheoriesProps {
  theories: Theory[];
  loadingLists: boolean;
  loadDbData: () => Promise<void>;
}

const GENERATION_TIPS = [
  "Formulating high-quality diagnostic stems...",
  "Aligning difficulty levels to Bloom's taxonomy...",
  "Verifying options are mutually exclusive...",
  "Extracting matching source excerpts with accuracy...",
  "Generating professional explanation text...",
  "Consulting the AI counselling methodology guidelines..."
];

export default function ManageTheories({
  theories,
  loadingLists,
  loadDbData,
}: ManageTheoriesProps) {
  // Theory form state
  const [theoryTitle, setTheoryTitle] = useState('');
  const [theoryBody, setTheoryBody] = useState('');
  const [theoryDomain, setTheoryDomain] = useState('');
  const [theoryStatus, setTheoryStatus] = useState<'draft' | 'published'>('published');
  const [theorySubmitLoading, setTheorySubmitLoading] = useState(false);
  const [theoryMessage, setTheoryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inline Theory editing state
  const [inlineEditingTheoryId, setInlineEditingTheoryId] = useState<string | null>(null);
  const [inlineTheoryTitle, setInlineTheoryTitle] = useState('');
  const [inlineTheoryBody, setInlineTheoryBody] = useState('');
  const [inlineTheoryDomain, setInlineTheoryDomain] = useState('');
  const [inlineTheoryStatus, setInlineTheoryStatus] = useState<'draft' | 'published'>('published');

  // MCQ generation loading state per theory ID
  const [generatingForTheoryId, setGeneratingForTheoryId] = useState<string | null>(null);
  const [generationCount, setGenerationCount] = useState<string>('3');
  const [customInstructions, setCustomInstructions] = useState('');
  const [currentTipIdx, setCurrentTipIdx] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (generatingForTheoryId === null) return;

    const interval = setInterval(() => {
      setCurrentTipIdx((prev) => (prev + 1) % GENERATION_TIPS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [generatingForTheoryId]);

  useEffect(() => {
    if (!theoryMessage) return;
    const t = setTimeout(() => setTheoryMessage(null), 5000);
    return () => clearTimeout(t);
  }, [theoryMessage]);

  const handleCreateTheory = async (e: React.FormEvent) => {
    e.preventDefault();
    setTheoryMessage(null);
    setTheorySubmitLoading(true);

    try {
      const { error } = await supabase
        .from('theories')
        .insert({
          title: theoryTitle,
          body_text: theoryBody,
          domain: theoryDomain,
          status: theoryStatus,
        })
        .select();

      if (error) throw error;

      setTheoryMessage({ type: 'success', text: 'Theory created successfully!' });
      setTheoryTitle('');
      setTheoryBody('');
      setTheoryDomain('');
      setTheoryStatus('published');

      await loadDbData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create theory.';
      setTheoryMessage({ type: 'error', text: message });
    } finally {
      setTheorySubmitLoading(false);
    }
  };

  const handleSaveInlineTheory = async (theoryId: string) => {
    try {
      const { error } = await supabase
        .from('theories')
        .update({
          title: inlineTheoryTitle,
          body_text: inlineTheoryBody,
          domain: inlineTheoryDomain,
          status: inlineTheoryStatus,
        })
        .eq('id', theoryId);

      if (error) throw error;

      setInlineEditingTheoryId(null);
      await loadDbData();
    } catch (err: unknown) {
      console.error('[Foundations] Failed to save inline theory:', err);
    }
  };

  const handleGenerateMcqs = async (theory: Theory) => {
    setGeneratingForTheoryId(theory.id);
    setCurrentTipIdx(0);
    const parsedCount = parseInt(generationCount, 10);
    const countVal = isNaN(parsedCount) || parsedCount <= 0 ? 3 : parsedCount;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? '';

      const res = await fetch('/api/generate-mcqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          theoryTitle: theory.title,
          theoryBody: theory.body_text,
          count: countVal,
          customInstructions: customInstructions,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate MCQs from AI.');
      }

      const generatedQuestions = data.questions;

      const rows = generatedQuestions.map((q: Omit<Question, 'id' | 'theory_id' | 'status' | 'created_at'>) => ({
        theory_id: theory.id,
        stem: q.stem,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        bloom_level: q.bloom_level,
        status: 'draft',
        source_excerpt: q.source_excerpt || null,
      }));

      const { error: dbErr } = await supabase.from('questions').insert(rows);
      if (dbErr) throw dbErr;

      setTheoryMessage({
        type: 'success',
        text: `Successfully generated ${generatedQuestions.length} draft questions! Review them in the Review Queue.`,
      });

      setCustomInstructions('');
      await loadDbData();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setTheoryMessage({ type: 'success', text: 'MCQ generation was cancelled.' });
        return;
      }
      const message = err instanceof Error ? err.message : 'Error generating MCQs.';
      setTheoryMessage({ type: 'error', text: message });
    } finally {
      abortControllerRef.current = null;
      setGeneratingForTheoryId(null);
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setGeneratingForTheoryId(null);
  };

  return (
    <>
      {/* Create Theory Form */}
      <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 h-fit shadow-sm">
        <h3 className="text-lg font-bold font-display mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Add New Theory
        </h3>

        {theoryMessage && (
          <div
            className={`p-4 mb-4 rounded-xl text-xs border transition-opacity ${theoryMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
          >
            {theoryMessage.text}
          </div>
        )}

        <form onSubmit={handleCreateTheory} className="space-y-4">
          <div>
            <label htmlFor="theory-title" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Theory Title
            </label>
            <input
              id="theory-title"
              type="text"
              required
              value={theoryTitle}
              onChange={(e) => setTheoryTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="theory-domain" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Domain / Tag
              </label>
              <input
                id="theory-domain"
                type="text"
                required
                value={theoryDomain}
                onChange={(e) => setTheoryDomain(e.target.value)}
                className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label htmlFor="theory-status" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                id="theory-status"
                value={theoryStatus}
                onChange={(e) => setTheoryStatus(e.target.value as 'draft' | 'published')}
                className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="theory-body" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Theory Text/Notes
            </label>
            <textarea
              id="theory-body"
              required
              rows={6}
              value={theoryBody}
              onChange={(e) => setTheoryBody(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-sans resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={theorySubmitLoading}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 disabled:opacity-50"
          >
            {theorySubmitLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Theory
              </>
            )}
          </button>
        </form>
      </div>

      {/* Theory List */}
      <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 h-fit min-h-[400px]">
        <div className="border-b border-border pb-4 mb-4 space-y-3">
          <h3 className="text-sm font-bold font-display text-foreground">
            Existing Theories ({theories.length})
          </h3>
          <div className="p-4 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-transparent shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span>Question Configuration</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="generation-count" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Questions per Theory
                </label>
                <input
                  id="generation-count"
                  type="number"
                  min={1}
                  max={20}
                  value={generationCount}
                  onChange={(e) => setGenerationCount(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs font-semibold"
                  placeholder="3"
                />
              </div>
              <div>
                <label htmlFor="custom-instructions" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Instructions
                </label>
                <input
                  id="custom-instructions"
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {loadingLists ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : theories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-2 text-muted-foreground/45" />
            <p>No theories loaded yet.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {theories.map((theory) => {
              let pillClass = 'bg-secondary text-secondary-foreground border-border';
              const domainLower = theory.domain.toLowerCase();
              if (domainLower.includes('cbt') || domainLower.includes('cognit')) {
                pillClass = 'bg-indigo-500/5 text-indigo-600 border-indigo-500/10 dark:text-indigo-400';
              } else if (domainLower.includes('human') || domainLower.includes('gestalt')) {
                pillClass = 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:text-emerald-400';
              } else if (domainLower.includes('psycho')) {
                pillClass = 'bg-rose-500/5 text-rose-600 border-rose-500/10 dark:text-rose-400';
              }

              if (inlineEditingTheoryId === theory.id) {
                return (
                  <div
                    key={theory.id}
                    className="p-5 rounded-xl border border-primary bg-card/75 shadow-sm space-y-4 text-xs animate-fade-in"
                  >
                    <div className="flex justify-between items-center border-b border-border/40 pb-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Edit Theory</span>
                      <span className="text-[10px] text-muted-foreground">ID: {theory.id.substring(0, 8)}…</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Theory Title
                        </label>
                        <input
                          type="text"
                          value={inlineTheoryTitle}
                          onChange={(e) => setInlineTheoryTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Domain / Tag
                        </label>
                        <input
                          type="text"
                          value={inlineTheoryDomain}
                          onChange={(e) => setInlineTheoryDomain(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Status
                        </label>
                        <select
                          value={inlineTheoryStatus}
                          onChange={(e) => setInlineTheoryStatus(e.target.value as 'draft' | 'published')}
                          className="w-full px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs"
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Theory Body Text (Material)
                      </label>
                      <textarea
                        value={inlineTheoryBody}
                        onChange={(e) => setInlineTheoryBody(e.target.value)}
                        rows={5}
                        className="w-full px-2.5 py-2 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => setInlineEditingTheoryId(null)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveInlineTheory(theory.id)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-primary hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={theory.id}
                  className="p-4 rounded-xl border border-border hover:border-primary/20 transition-all bg-background/50 flex flex-col justify-between gap-3 animate-fade-in"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold font-display text-sm">{theory.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${pillClass}`}>
                        {theory.domain}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                      {theory.body_text}
                    </p>
                  </div>

                  <div className="border-t border-border/40 pt-3 flex justify-between items-center text-[10px] text-muted-foreground/75">
                    <span>ID: {theory.id.substring(0, 8)}…</span>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-semibold ${theory.status === 'published' ? 'text-emerald-500' : 'text-amber-500'
                          }`}
                      >
                        {theory.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => {
                          setInlineEditingTheoryId(theory.id);
                          setInlineTheoryTitle(theory.title);
                          setInlineTheoryBody(theory.body_text);
                          setInlineTheoryDomain(theory.domain);
                          setInlineTheoryStatus(theory.status);
                        }}
                        className="px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/10 font-bold hover:bg-primary/20 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleGenerateMcqs(theory)}
                        disabled={generatingForTheoryId !== null}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold text-white transition-all cursor-pointer flex items-center gap-1 ${generatingForTheoryId === theory.id
                          ? 'bg-primary/50 cursor-not-allowed'
                          : 'bg-primary hover:bg-primary/95 shadow-sm'
                          }`}
                      >
                        <span>{generatingForTheoryId === theory.id ? 'Generating...' : 'Generate MCQs'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {generatingForTheoryId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-sm w-full mx-4 text-center space-y-4 shadow-2xl animate-scale-in">
            <div className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="space-y-2">
              <h3 className="text-base font-bold font-display text-foreground">AI MCQ Generation in Progress</h3>
              <p className="text-xs text-muted-foreground italic h-8 flex items-center justify-center px-4">
                &ldquo;{GENERATION_TIPS[currentTipIdx]}&rdquo;
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="w-full py-2 px-4 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-all cursor-pointer"
            >
              Cancel Generation
            </button>
          </div>
        </div>
      )}
    </>
  );
}
