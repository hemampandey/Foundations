'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, FileText } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  // Trap focus to the Cancel (Stay) button by default instead of the Close 'X' button
  useEffect(() => {
    if (open && dialogRef.current) {
      const cancelButton = dialogRef.current.querySelector('.cancel-btn') as HTMLButtonElement;
      if (cancelButton) {
        cancelButton.focus();
      } else {
        const firstButton = dialogRef.current.querySelector('button');
        firstButton?.focus();
      }
    }
  }, [open]);

  if (!open) return null;

  const confirmClasses =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/10'
      : 'bg-primary text-primary-foreground hover:opacity-90 shadow-primary/10';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel}/>

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        {/* Close Button at top-right */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-xl hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pt-8 space-y-4">
          <div className="flex items-start gap-3.5">
            {variant === 'danger' ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="space-y-1.5 flex-1 pr-6">
              <h3 id="confirm-dialog-title" className="text-base font-bold font-inria text-primary">
                {title}
              </h3>
              <p className="text-xs font-serif text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-6 pt-0 select-none">
          <button
            onClick={onCancel}
            className="cancel-btn flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border border-border bg-background text-foreground hover:bg-secondary/60 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
