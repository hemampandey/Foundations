'use client';

import React, { useState } from 'react';
import { Save, Compass, ArrowUp, ArrowDown, X, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Journey, QuestionWithTheory } from '@/lib/types';

interface ManageJourneysProps {
  journeys: Journey[];
  questions: QuestionWithTheory[];
  loadingLists: boolean;
  loadDbData: () => Promise<void>;
}

export default function ManageJourneys({
  journeys,
  questions,
  loadingLists,
  loadDbData,
}: ManageJourneysProps) {
  // Journey form & editing state
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [journeyTitle, setJourneyTitle] = useState('');
  const [journeyPublished, setJourneyPublished] = useState(false);
  const [journeySelectedQuestionIds, setJourneySelectedQuestionIds] = useState<string[]>([]);
  const [journeySubmitLoading, setJourneySubmitLoading] = useState(false);
  const [journeyMessage, setJourneyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleEditJourney = async (journey: Journey) => {
    setEditingJourney(journey);
    setJourneyTitle(journey.title);
    setJourneyPublished(journey.published);
    setJourneyMessage(null);
    try {
      const { data, error } = await supabase
        .from('journey_questions')
        .select('question_id, sort_order')
        .eq('journey_id', journey.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const sortedIds = (data ?? []).map((row) => row.question_id);
      setJourneySelectedQuestionIds(sortedIds);
    } catch (err: unknown) {
      console.error('Failed to load journey questions', err);
    }
  };

  const handleSaveJourney = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setJourneyMessage(null);
    setJourneySubmitLoading(true);

    if (!journeyTitle.trim()) {
      setJourneyMessage({ type: 'error', text: 'Journey title is required.' });
      setJourneySubmitLoading(false);
      return;
    }

    if (journeyPublished && journeySelectedQuestionIds.length === 0) {
      setJourneyMessage({
        type: 'error',
        text: 'Cannot publish a journey with 0 questions. Please add questions first or save it as a Draft.',
      });
      setJourneySubmitLoading(false);
      return;
    }

    try {
      let journeyId = editingJourney?.id;

      if (editingJourney) {
        const { error } = await supabase
          .from('journeys')
          .update({ title: journeyTitle, published: journeyPublished })
          .eq('id', editingJourney.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('journeys')
          .insert({ title: journeyTitle, published: journeyPublished })
          .select()
          .single();
        if (error) throw error;
        journeyId = data.id;
      }

      const { error: delErr } = await supabase
        .from('journey_questions')
        .delete()
        .eq('journey_id', journeyId);
      if (delErr) throw delErr;

      if (journeySelectedQuestionIds.length > 0) {
        const rows = journeySelectedQuestionIds.map((qId, index) => ({
          journey_id: journeyId,
          question_id: qId,
          sort_order: index,
        }));
        const { error: insErr } = await supabase
          .from('journey_questions')
          .insert(rows);
        if (insErr) throw insErr;
      }

      setJourneyMessage({
        type: 'success',
        text: editingJourney ? 'Journey updated successfully!' : 'Journey created successfully!',
      });

      if (!editingJourney) {
        setJourneyTitle('');
        setJourneyPublished(false);
        setJourneySelectedQuestionIds([]);
      }

      await loadDbData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save journey.';
      setJourneyMessage({ type: 'error', text: message });
    } finally {
      setJourneySubmitLoading(false);
    }
  };

  const handleDeleteJourney = async (journeyId: string) => {
    if (!confirm('Are you sure you want to delete this journey?')) return;
    setJourneyMessage(null);
    try {
      const { error } = await supabase
        .from('journeys')
        .delete()
        .eq('id', journeyId);
      if (error) throw error;
      setJourneyMessage({ type: 'success', text: 'Journey deleted successfully!' });
      await loadDbData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete journey.';
      setJourneyMessage({ type: 'error', text: message });
    }
  };

  const approvedQuestions = questions.filter((q) => q.status === 'approved');

  return (
    <>
      {/* Create/Edit Journey Form */}
      <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 h-fit shadow-sm space-y-5">
        <h3 className="text-lg font-bold font-display flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          {editingJourney ? 'Edit Journey' : 'Create New Journey'}
        </h3>

        {journeyMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${journeyMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/10'
              : 'bg-destructive/10 text-destructive border border-destructive/10'
              }`}>
            {journeyMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveJourney} className="space-y-2">
          <div>
            <input
              id="j-title"
              type="text"
              required
              value={journeyTitle}
              onChange={(e) => setJourneyTitle(e.target.value)}
              placeholder="Journey Title"
              className="w-full px-3 py-2.5 border border-border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"/>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              id="j-published"
              type="checkbox"
              checked={journeyPublished}
              onChange={(e) => setJourneyPublished(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
            <label htmlFor="j-published" className="text-xs font-semibold text-foreground cursor-pointer">Publish Journey (Make visible to learners)</label>
          </div>

          {/* Selected Questions (Ordered List) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Journey Questions Order ({journeySelectedQuestionIds.length} Selected)
            </label>
            {journeySelectedQuestionIds.length === 0 ? (
              <div className="text-center p-4 border border-dashed border-border rounded-xl bg-background/50 text-[11px] text-muted-foreground">
                No questions selected yet. Check questions below to add them to this journey.
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto border border-border rounded-xl p-2 bg-background/30">
                {journeySelectedQuestionIds.map((qId, index) => {
                  const question = questions.find((q) => q.id === qId);
                  if (!question) return null;
                  return (
                    <div
                      key={qId}
                      className="flex items-center justify-between p-2 border border-border bg-card rounded-xl text-xs"
                    >
                      <span className="truncate max-w-[200px] font-medium" title={question.stem}>
                        {index + 1}. {question.stem}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => {
                            const newIds = [...journeySelectedQuestionIds];
                            const temp = newIds[index];
                            newIds[index] = newIds[index - 1];
                            newIds[index - 1] = temp;
                            setJourneySelectedQuestionIds(newIds);
                          }}
                          className="p-1 hover:bg-secondary rounded disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === journeySelectedQuestionIds.length - 1}
                          onClick={() => {
                            const newIds = [...journeySelectedQuestionIds];
                            const temp = newIds[index];
                            newIds[index] = newIds[index + 1];
                            newIds[index + 1] = temp;
                            setJourneySelectedQuestionIds(newIds);
                          }}
                          className="p-1 hover:bg-secondary rounded disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setJourneySelectedQuestionIds(
                              journeySelectedQuestionIds.filter((id) => id !== qId)
                            );
                          }}
                          className="p-1 hover:bg-destructive/10 text-destructive rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            {editingJourney && (
              <button
                type="button"
                onClick={() => {
                  setEditingJourney(null);
                  setJourneyTitle('');
                  setJourneyPublished(false);
                  setJourneySelectedQuestionIds([]);
                  setJourneyMessage(null);
                }}
                className="flex-1 py-2.5 px-4 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-all cursor-pointer">Cancel</button>
            )}
            <button
              type="submit"
              disabled={journeySubmitLoading}
              className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 disabled:opacity-50"
            >
              {journeySubmitLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingJourney ? 'Update Journey' : 'Create Journey'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Available Questions List */}
        <div className="pt-4 border-t border-border space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Available Questions to Add
          </label>
          {approvedQuestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approved MCQs to add to journey.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {approvedQuestions.map((q) => {
                const isChecked = journeySelectedQuestionIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all text-xs cursor-pointer ${isChecked
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-secondary/30'
                      }`}
                    onClick={() => {
                      if (isChecked) {
                        setJourneySelectedQuestionIds(
                          journeySelectedQuestionIds.filter((id) => id !== q.id)
                        );
                      } else {
                        setJourneySelectedQuestionIds([...journeySelectedQuestionIds, q.id]);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"/>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-foreground truncate" title={q.stem}>{q.stem}</p>
                      <div className="flex gap-1.5 text-[9px] font-medium text-muted-foreground">
                        <span className="bg-secondary px-1 py-0.2 rounded truncate max-w-[120px]">{q.theories?.title ?? 'Unknown'}</span>
                        <span>Difficulty: L{q.difficulty}</span>
                        <span className="uppercase">{q.bloom_level}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Journeys List */}
      <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 h-fit min-h-[400px]">
        <h3 className="text-lg font-bold font-display mb-4">
          Existing Journeys ({journeys.length})
        </h3>

        {loadingLists ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : journeys.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Compass className="w-12 h-12 mx-auto mb-2 text-muted-foreground/45" />
            <p>No journeys created yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {journeys.map((j) => (
              <div
                key={j.id}
                className="p-4 rounded-2xl border border-border bg-background/30 hover:border-primary/20 transition-all flex justify-between items-center text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold font-display text-sm text-foreground">{j.title}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${j.published
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10'
                        : 'bg-secondary text-secondary-foreground border-border'
                        }`}
                    >
                      {j.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Created: {new Date(j.created_at).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditJourney(j)}
                    className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 hover:bg-primary/20 transition-all cursor-pointer flex items-center gap-1 font-semibold">
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteJourney(j.id)}
                    className="p-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/10 hover:bg-destructive/20 transition-all cursor-pointer flex items-center gap-1 font-semibold">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>);}
