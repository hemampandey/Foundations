'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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

  // Trap focus
  useEffect(() => {
    if (open && dialogRef.current) {
      const firstButton = dialogRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [open]);

  if (!open) return null;

  const confirmClasses =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
      : 'bg-primary text-primary-foreground hover:opacity-90 shadow-primary/20';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onCancel}/>

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {variant === 'danger' && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500"> <AlertTriangle className="w-5 h-5" /> </div>
              )}
              <div>
                <h3 id="confirm-dialog-title" className="text-base font-bold font-display text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-xl"
              aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex gap-3 p-4 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm border border-border bg-background text-foreground hover:bg-secondary transition-all cursor-pointer">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all cursor-pointer shadow-md ${confirmClasses}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
