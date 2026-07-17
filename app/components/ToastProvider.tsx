'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

interface ToastContextType {
  showToast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, text }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast container in bottom-right (like Windows notification) */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          let icon = <Info className="w-4 h-4 text-primary shrink-0" />;
          let borderTheme = 'border-border/80 bg-card/95 text-foreground';
          
          if (toast.type === 'success') {
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
            borderTheme = 'border-emerald-500/20 bg-card/95 text-foreground';
          } else if (toast.type === 'error') {
            icon = <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
            borderTheme = 'border-rose-500/20 bg-card/95 text-foreground';
          } else if (toast.type === 'warning') {
            icon = <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
            borderTheme = 'border-amber-500/20 bg-card/95 text-foreground';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md animate-slide-in-right transition-all duration-300 ${borderTheme}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{icon}</div>
                <p className="text-xs font-serif leading-relaxed text-foreground/90 font-medium pr-2">
                  {toast.text}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded-lg hover:bg-secondary shrink-0 focus:outline-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
