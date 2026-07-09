'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Mail, Lock, LogIn, Sparkles, CheckCircle2, 
  AlertCircle, User, Zap, Flame 
} from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background animate-fade-in">
      {/* Left Column: Visual Intro Banner */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0b0f19] overflow-hidden flex-col justify-between p-12 border-r border-border/25">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-500/10 blur-[100px] pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="font-display font-bold text-lg text-white tracking-tight">
            Foundations
          </span>
        </div>

        {/* Mid Hero Section */}
        <div className="relative z-10 space-y-8 my-auto">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold font-display leading-[1.15] text-white tracking-tight">
              Build Durable Mastery of <br />
              <span className="bg-gradient-to-r from-primary via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Counselling Theories
              </span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              A premium, spacing-optimized training platform designed to concrete conceptual foundations and decision making.
            </p>
          </div>

          {/* Benefit Cards */}
          <div className="space-y-4 max-w-md">
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/10 bg-white/[0.02] backdrop-blur-md transition-all hover:bg-white/[0.04]">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">SM-2 Spaced Recall</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Lock in theories with smart practice sessions scheduled precisely to match cognitive retention curves.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/10 bg-white/[0.02] backdrop-blur-md transition-all hover:bg-white/[0.04]">
              <div className="p-2 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI MCQ Generation</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Instantly transform reading materials and theories into high-quality diagnostic multiple-choice questions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/10 bg-white/[0.02] backdrop-blur-md transition-all hover:bg-white/[0.04]">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Gamified Milestones</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Earn daily experience points (XP), monitor accuracy levels, and build your consistency streak.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 border-t border-border/10 pt-4 flex justify-between items-center text-[10px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Foundations</span>
          <span className="font-serif italic text-sm text-white/50">Ally</span>
        </div>
      </div>

      {/* Right Column: Interaction Form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-12 lg:px-20 relative">
        {/* Subtle Ambient Glow for Light Mode */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm space-y-8 relative z-10">
          {/* Header Mobile Brand */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-3">
            <div className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse-glow" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground tracking-tight">
              {activeTab === 'login' ? 'Sign in to Foundations' : 'Create your account'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'login' 
                ? 'Welcome back! Enter your details to resume your training pathways.' 
                : 'Get started immediately to track progress and practice questions.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="border border-border bg-card rounded-2xl p-6 shadow-xl shadow-primary/5 space-y-6">
            {/* Custom Tab Switcher */}
            <div className="flex p-1 bg-secondary/50 rounded-sm border border-border/40">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Alert Message */}
            {message && (
              <div
                className={`flex items-start p-3.5 rounded-xl border text-xs leading-relaxed ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}
                role="alert"
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mr-2.5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2.5 shrink-0 mt-0.5" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="auth-email" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/60">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-xs placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="auth-password" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/60">
                    <Lock className="w-4 h-4" />
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-xs placeholder:text-muted-foreground/50"
                  />
                </div>
                {activeTab === 'signup' && (
                  <p className="text-[9px] text-muted-foreground/80 leading-snug">
                    Minimum {MIN_PASSWORD_LENGTH} characters.
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/10 disabled:opacity-50 text-xs"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-xs animate-spin" />
                ) : activeTab === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    <span>Sign Up</span>
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
