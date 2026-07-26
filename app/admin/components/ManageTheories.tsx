'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Edit, Layers, Settings, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Theory, Question } from '@/lib/types';
import { useToast } from '@/app/components/ToastProvider';

interface ManageTheoriesProps {
  theories: Theory[];
  loadingLists: boolean;
  loadDbData: (silent?: boolean) => Promise<void>;
}

const GENERATION_TIPS = [
  "Formulating high-quality diagnostic stems...",
  "Aligning difficulty levels to Bloom's taxonomy...",
  "Verifying options are mutually exclusive...",
  "Extracting matching source excerpts with accuracy...",
  "Generating professional explanation text...",
  "Consulting the AI counselling methodology guidelines..."
];

interface PdfJsItem {
  str: string;
}

interface PdfJsTextContent {
  items: PdfJsItem[];
}

interface PdfJsPage {
  getTextContent: () => Promise<PdfJsTextContent>;
}

interface PdfJsDocument {
  numPages: number;
  getPage: (pageNo: number) => Promise<PdfJsPage>;
}

interface PdfJsLib {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (options: { data: ArrayBuffer }) => {
    promise: Promise<PdfJsDocument>;
  };
}

interface WindowWithPdfJs extends Window {
  pdfjsLib?: PdfJsLib;
}

// Dynamic Loader for PDF.js to avoid bundle weight & configuration issues
const loadPdfJs = async (): Promise<PdfJsLib | null> => {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as WindowWithPdfJs;
  if (win.pdfjsLib) return win.pdfjsLib;

  return new Promise<PdfJsLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const loadedWin = window as unknown as WindowWithPdfJs;
      if (loadedWin.pdfjsLib) {
        loadedWin.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(loadedWin.pdfjsLib);
      } else {
        reject(new Error('PDF.js loaded but pdfjsLib object is missing.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js engine from CDN.'));
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) throw new Error('PDF engine is not available on server-side.');

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
};

interface MammothLib {
  extractRawText: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }>;
}

interface WindowWithMammoth extends Window {
  mammoth?: MammothLib;
}

const loadMammoth = async (): Promise<MammothLib | null> => {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as WindowWithMammoth;
  if (win.mammoth) return win.mammoth;

  return new Promise<MammothLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload = () => {
      const loadedWin = window as unknown as WindowWithMammoth;
      if (loadedWin.mammoth) {
        resolve(loadedWin.mammoth);
      } else {
        reject(new Error('Mammoth loaded but mammoth object is missing.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Docx engine from CDN.'));
    document.head.appendChild(script);
  });
};

const extractTextFromDocx = async (file: File): Promise<string> => {
  const mammoth = await loadMammoth();
  if (!mammoth) throw new Error('Docx engine is not available on server-side.');

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    return extractTextFromPdf(file);
  } else if (extension === 'docx') {
    return extractTextFromDocx(file);
  } else if (extension === 'txt') {
    return file.text();
  } else {
    throw new Error('Unsupported file format. Please upload a .pdf, .docx, or .txt file.');
  }
};

export default function ManageTheories({
  theories,
  loadingLists,
  loadDbData,
}: ManageTheoriesProps) {
  // Theory form state
  const { showToast } = useToast();
  const [theoryTitle, setTheoryTitle] = useState('');
  const [theoryBody, setTheoryBody] = useState('');
  const [theoryDomain, setTheoryDomain] = useState('');
  const [theoryStatus, setTheoryStatus] = useState<'draft' | 'published'>('published');
  const [theorySubmitLoading, setTheorySubmitLoading] = useState(false);

  // Inline Theory editing state
  const [inlineEditingTheoryId, setInlineEditingTheoryId] = useState<string | null>(null);
  const [inlineTheoryTitle, setInlineTheoryTitle] = useState('');
  const [inlineTheoryBody, setInlineTheoryBody] = useState('');
  const [inlineTheoryDomain, setInlineTheoryDomain] = useState('');
  const [inlineTheoryStatus, setInlineTheoryStatus] = useState<'draft' | 'published'>('published');

  // MCQ generation state per theory ID
  const [generatingForTheoryId, setGeneratingForTheoryId] = useState<string | null>(null);
  const [activeSettingsTheoryId, setActiveSettingsTheoryId] = useState<string | null>(null);
  const [theoryConfig, setTheoryConfig] = useState<Record<string, { count: string; instructions: string }>>({});
  const [currentTipIdx, setCurrentTipIdx] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const [fileExtracting, setFileExtracting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isInline: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileExtracting(true);
    try {
      const extractedText = await extractTextFromFile(file);
      if (!extractedText.trim()) {
        throw new Error('File appears to be empty or does not contain readable text.');
      }

      if (isInline) {
        setInlineTheoryBody(extractedText);
      } else {
        setTheoryBody(extractedText);
        if (!theoryTitle) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setTheoryTitle(cleanName.replace(/\b\w/g, c => c.toUpperCase()));
        }
      }

      showToast(`✓ Extracted ${extractedText.length} characters from ${file.name}!`, 'success');
    } catch (err: unknown) {
      console.error('[Foundations] File text extraction failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to extract text from file.';
      showToast(msg, 'error');
    } finally {
      setFileExtracting(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (generatingForTheoryId === null) return;

    const interval = setInterval(() => {
      setCurrentTipIdx((prev) => (prev + 1) % GENERATION_TIPS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [generatingForTheoryId]);

  const handleCreateTheory = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
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

      showToast('Theory created successfully!', 'success');
      setTheoryTitle('');
      setTheoryBody('');
      setTheoryDomain('');
      setTheoryStatus('published');

      await loadDbData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create theory.';
      showToast(message, 'error');
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
    const config = theoryConfig[theory.id] || { count: '3', instructions: '' };
    const parsedCount = parseInt(config.count, 10);
    const countVal = isNaN(parsedCount) || parsedCount <= 0 ? 3 : parsedCount;
    const instructionsVal = config.instructions;

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
          customInstructions: instructionsVal,
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

      setGeneratingForTheoryId(null);

      showToast(`Successfully generated ${generatedQuestions.length} draft questions! Review them in the Review Queue.`, 'success');

      setTheoryConfig((prev) => ({
        ...prev,
        [theory.id]: {
          ...prev[theory.id],
          instructions: '',
        }
      }));
      loadDbData();
      window.dispatchEvent(new CustomEvent('sync-sidebar-badges'));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        showToast('MCQ generation was cancelled.', 'info');
        return;
      }
      const message = err instanceof Error ? err.message : 'Error generating MCQs.';
      showToast(message, 'error');
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
        <h3 className="text-lg text-primary font-bold font-inria mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Add New Theory
        </h3>

        <form onSubmit={handleCreateTheory} className="space-y-4">
          <div>
            <label htmlFor="theory-title" className="block text-xs font-inria text-primary uppercase tracking-wider mb-1.5">Theory Title</label>
            <input
              id="theory-title"
              type="text"
              required
              autoComplete="off"
              value={theoryTitle}
              onChange={(e) => setTheoryTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="theory-domain" className="block text-xs font-inria text-primary uppercase tracking-wider mb-1.5">Domain / Tag</label>
              <input
                id="theory-domain"
                type="text"
                required
                autoComplete="off"
                value={theoryDomain}
                onChange={(e) => setTheoryDomain(e.target.value)}
                className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"/>
            </div>
            <div>
              <label htmlFor="theory-status" className="block text-xs font-inria text-primary uppercase tracking-wider mb-1.5">Status</label>
              <select
                id="theory-status"
                value={theoryStatus}
                onChange={(e) => setTheoryStatus(e.target.value as 'draft' | 'published')}
                className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="theory-body" className="block text-xs font-inria text-primary uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Theory Text/Notes</span>
              <span className="text-[10px] text-muted-foreground font-sans normal-case">Or upload a PDF, DOCX, or TXT file</span>
            </label>
            <textarea
              id="theory-body"
              required
              rows={6}
              value={theoryBody}
              onChange={(e) => setTheoryBody(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-sans resize-y"/>
          </div>

          {/* Drag/Drop File Upload Zone */}
          <div className="border border-dashed border-border/80 bg-secondary/10 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 relative transition-all hover:bg-secondary/30">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => handleFileUpload(e, false)}
              disabled={fileExtracting}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              title="Upload PDF, DOCX, or TXT"
            />
            {fileExtracting ? (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-primary animate-pulse">Extracting text content...</span>
              </div>
            ) : (
              <>
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-foreground">Click to upload or drag & drop PDF, DOCX, or TXT</p>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={theorySubmitLoading}
            className="w-full py-2.5 px-4 bg-primary text-secondary font-semibold font-inria tracking-wider rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 disabled:opacity-50">
            {theorySubmitLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (<>
                <Plus className="w-4 h-4" />
                Add Theory
              </>)}
          </button>
        </form>
      </div>

      {/* Theory List */}
      <div className="lg:col-span-7 bg-card border border-border rounded-3xl p-6 h-fit min-h-[400px]">
        <div className="border-b border-border pb-4 mb-4">
          <h3 className="text-md font-bold font-inria text-primary">Existing Theories ({theories.length})</h3>
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
                    className="p-5 rounded-xl border border-primary bg-card/75 shadow-sm space-y-4 text-xs animate-fade-in">
                    <div className="flex justify-between items-center border-b border-border/40 pb-1">
                      <span className="text-[10px] font-bold text-primary uppercase">Edit Theory</span>
                      <span className="text-[10px] text-muted-foreground">ID: {theory.id.substring(0, 8)}…</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Theory Title</label>
                        <input
                          type="text"
                          autoComplete="off"
                          value={inlineTheoryTitle}
                          onChange={(e) => setInlineTheoryTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Domain / Tag</label>
                        <input
                          type="text"
                          autoComplete="off"
                          value={inlineTheoryDomain}
                          onChange={(e) => setInlineTheoryDomain(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                        <select
                          value={inlineTheoryStatus}
                          onChange={(e) => setInlineTheoryStatus(e.target.value as 'draft' | 'published')}
                          className="w-full px-2.5 py-1.5 border border-border bg-background rounded-xl text-xs">
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Theory Body Text (Material)</label>
                        <span className="text-[8px] text-muted-foreground font-sans">Or upload a PDF, DOCX, or TXT to extract text</span>
                      </div>
                      <textarea
                        value={inlineTheoryBody}
                        onChange={(e) => setInlineTheoryBody(e.target.value)}
                        rows={5}
                        className="w-full px-2.5 py-2 border border-border bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"/>
                    </div>

                    {/* Inline File Upload Zone */}
                    <div className="border border-dashed border-border/70 bg-secondary/10 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1.5 relative transition-all hover:bg-secondary/25">
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => handleFileUpload(e, true)}
                        disabled={fileExtracting}
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                        title="Upload PDF, DOCX, or TXT"
                      />
                      {fileExtracting ? (
                        <div className="flex flex-col items-center gap-1 py-0.5">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span className="text-[9px] font-bold text-primary animate-pulse">Extracting text...</span>
                        </div>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-foreground">Click or drag PDF, DOCX, or TXT to replace body text</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => setInlineEditingTheoryId(null)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all cursor-pointer">Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveInlineTheory(theory.id)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-primary hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5">
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
                  className="p-4 rounded-xl border border-border hover:border-primary/20 transition-all bg-background/50 flex flex-col justify-between gap-3 animate-fade-in">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold font-serif text-sm tracking-tight">{theory.title}</h4>
                      <span className={`px-2 py-0.5 rounded-[8px] text-[9px] tracking-wider font-bold uppercase border ${pillClass}`}>{theory.domain}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-serif mt-1.5 line-clamp-4">{theory.body_text}</p>

                    {activeSettingsTheoryId === theory.id && (
                      <div className="mt-3 p-3 bg-secondary/40 rounded-xl border border-border/60 space-y-2.5 animate-fade-in text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold font-serif text-foreground">
                          <Settings className="w-3 h-3 text-primary" />
                          <span>Generation Settings</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-1">
                            <label className="block text-[8px] font-bold font-serif text-muted-foreground uppercase tracking-wider mb-1">Count</label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={theoryConfig[theory.id]?.count ?? '3'}
                              onChange={(e) => {
                                setTheoryConfig({
                                  ...theoryConfig,
                                  [theory.id]: {
                                    count: e.target.value,
                                    instructions: theoryConfig[theory.id]?.instructions ?? '',
                                  }
                                });
                              }}
                              className="w-full px-2.5 py-1 border border-border bg-background rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-xs font-semibold"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8px] font-bold font-serif text-muted-foreground uppercase tracking-wider mb-1">Instructions</label>
                            <input
                              type="text"
                              placeholder="e.g., Focus on the core principles of relativity."
                              value={theoryConfig[theory.id]?.instructions ?? ''}
                              onChange={(e) => {
                                setTheoryConfig({
                                  ...theoryConfig,
                                  [theory.id]: {
                                    count: theoryConfig[theory.id]?.count ?? '3',
                                    instructions: e.target.value,
                                  }
                                });
                              }}
                              className="w-full px-2.5 py-1 border border-border bg-background rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/40 pt-3 flex justify-between items-center text-[10px] text-muted-foreground/75">
                    <span>ID: {theory.id.substring(0, 8)}…</span>
                    <div className="flex items-center gap-2.5">
                      <span className={`font-bold font-serif ${theory.status === 'published' ? 'text-emerald-500' : 'text-amber-500'}`}>{theory.status.toUpperCase()}</span>
                      <button
                        onClick={() => {
                          setInlineEditingTheoryId(theory.id);
                          setInlineTheoryTitle(theory.title);
                          setInlineTheoryBody(theory.body_text);
                          setInlineTheoryDomain(theory.domain);
                          setInlineTheoryStatus(theory.status);
                        }}
                        className="px-2 py-1 rounded bg-primary/10 text-primary font-serif border border-primary/10 font-bold hover:bg-primary/20 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveSettingsTheoryId(activeSettingsTheoryId === theory.id ? null : theory.id);
                        }}
                        className={`p-1.5 rounded border transition-all cursor-pointer flex items-center justify-center ${activeSettingsTheoryId === theory.id
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground'
                          }`}
                        title="Generation Settings">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleGenerateMcqs(theory)}
                        disabled={generatingForTheoryId !== null}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold font-serif text-white transition-all cursor-pointer flex items-center gap-1 ${generatingForTheoryId === theory.id
                          ? 'bg-primary/50 cursor-not-allowed'
                          : 'bg-primary hover:bg-primary/95 shadow-sm'
                          }`}>
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
              <p className="text-xs text-muted-foreground italic h-8 flex items-center justify-center px-4">&ldquo;{GENERATION_TIPS[currentTipIdx]}&rdquo;</p>
            </div>
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="w-full py-2 px-4 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-all cursor-pointer">Cancel Generation</button>
          </div>
        </div>
      )}
    </>
  );}
