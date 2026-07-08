'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, LogIn, Sparkles, CheckCircle2, AlertCircle, User } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

export default function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Client-side password length validation
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        type: 'error',
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        setMessage({
          type: 'success',
          text: 'Account created! Please check your email for verification, or log in if auto-confirmed.',
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMessage({ type: 'success', text: 'Welcome back! Redirecting…' });

        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during authentication.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-[80vh] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4 animate-pulse-glow">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Foundations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Theory-mastery trainer for mental health professionals
          </p>
        </div>

        {/* Auth Card */}
        <div className="overflow-hidden border rounded-2xl bg-card border-border shadow-xl shadow-primary/5">
          {/* Tabs */}
          <div className="flex border-b border-border bg-secondary/30">
            <button
              onClick={() => {
                setActiveTab('login');
                setMessage(null);
              }}
              className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 border-b-2 cursor-pointer ${activeTab === 'login'
                ? 'border-primary text-primary bg-card'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab('signup');
                setMessage(null);
              }}
              className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 border-b-2 cursor-pointer ${activeTab === 'signup'
                ? 'border-primary text-primary bg-card'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              Create Account
            </button>
          </div>

          <div className="p-8">
            {message && (
              <div
                className={`flex items-start p-4 mb-6 rounded-xl border text-sm ${message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
                  }`}
                role="alert"
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-foreground">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-foreground">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
                {activeTab === 'signup' && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Minimum {MIN_PASSWORD_LENGTH} characters
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : activeTab === 'login' ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                ) : (
                  <>
                    <User className="w-5 h-5" />
                    Sign Up
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
