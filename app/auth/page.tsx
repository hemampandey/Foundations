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
  const [checkingSession, setCheckingSession] = useState(true);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Google sign in.';
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      } else {
        setCheckingSession(false);
      }
    };
    checkUser();
  }, [router]);

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8fafc] animate-fade-in overflow-hidden relative text-slate-800">
      {/* Decorative ambient background particles */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-[#264D8E]/5 blur-[80px] pointer-events-none animate-drifting-1" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none animate-drifting-2" />

      {/* Left Column: Visual Intro Banner using brand-blue gradient */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#264D8E] via-[#21437c] to-[#14294d] overflow-hidden flex-col justify-between p-12 border-r border-slate-200/20">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-white/10 blur-[120px] pointer-events-none animate-drifting-3" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-400/20 blur-[100px] pointer-events-none animate-drifting-1" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-2.5 animate-scale-in stagger-1">
          <span className="font-inria font-bold text-xl text-white tracking-wider">Foundations</span>
        </div>

        {/* Mid Hero Section */}
        <div className="relative z-10 space-y-8 my-auto">
          <div className="space-y-4 animate-fade-in stagger-2">
            <h1 className="text-4xl font-extrabold font-display leading-[1.15] text-white tracking-tight">
              Build Durable Mastery of <br />
              <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">Theories</span>
            </h1>
            <p className="text-sm text-indigo-100/90 leading-relaxed max-w-md">A premium, spacing-optimized training platform designed to concrete conceptual foundations and decision making.</p>
          </div>

          {/* Benefit Cards */}
          <div className="space-y-4 max-w-md">
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all hover:bg-white/[0.07] animate-fade-in stagger-3">
              <div className="p-2 bg-white/10 text-white rounded-xl border border-white/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">SM-2 Spaced Recall</h4>
                <p className="text-[11px] text-indigo-100/80 mt-1 leading-relaxed">
                  Lock in theories with smart practice sessions scheduled precisely to match cognitive retention curves.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all hover:bg-white/[0.07] animate-fade-in stagger-4">
              <div className="p-2 bg-white/10 text-white rounded-xl border border-white/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI MCQ Generation</h4>
                <p className="text-[11px] text-indigo-100/80 mt-1 leading-relaxed">
                  Instantly transform reading materials and theories into high-quality diagnostic multiple-choice questions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all hover:bg-white/[0.07] animate-fade-in stagger-5">
              <div className="p-2 bg-white/10 text-white rounded-xl border border-white/20">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Gamified Milestones</h4>
                <p className="text-[11px] text-indigo-100/80 mt-1 leading-relaxed">
                  Earn daily experience points (XP), monitor accuracy levels, and build your consistency streak.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 border-t border-white/10 pt-4 flex justify-between items-center text-[10px] text-indigo-200/60 animate-fade-in stagger-6">
          <span>© {new Date().getFullYear()} Foundations</span>
          <span className="font-serif italic text-sm text-white/70">Ally</span>
        </div>
      </div>

      {/* Right Column: Interaction Form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-12 lg:px-20 relative bg-[#f8fafc]">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rounded-full bg-[#264D8E]/5 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm space-y-8 relative z-10">
          {/* Header Mobile Brand */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-3 animate-scale-in stagger-2">
            <div className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse-glow" />
            </div>
            <h2 className="text-3xl font-bold font-serif text-primary tracking-tight">{activeTab === 'login' ? 'Sign in to Foundations' : 'Create your account'}</h2>
            <p className="text-sm font-inria text-slate-500">
              {activeTab === 'login' 
                ? 'Welcome back! Enter your details to resume your training pathways.' 
                : 'Get started immediately to track your progress and practice questions.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="border border-slate-200/80 bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-100/70 space-y-6 animate-scale-in stagger-3">
            {/* Custom Tab Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white font-serif text-slate-900 shadow-sm border border-slate-200/30'
                    : 'font-serif text-slate-500 hover:text-slate-950'}`}>Sign In</button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-white font-serif text-slate-900 shadow-sm border border-slate-200/30'
                    : 'text-slate-500 font-serif hover:text-slate-950'}`}>Create Account</button>
            </div>

            {/* Alert Message */}
            {message && (
              <div
                className={`flex items-start p-3.5 rounded-xl border text-xs leading-relaxed ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-700'
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
                <label htmlFor="auth-email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#264D8E] focus:border-transparent transition-all text-xs placeholder:text-slate-400 text-slate-900"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="auth-password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#264D8E] focus:border-transparent transition-all text-xs placeholder:text-slate-400 text-slate-900"/>
                </div>
                {activeTab === 'signup' && (
                  <p className="text-[9px] text-slate-400 leading-snug">Minimum {MIN_PASSWORD_LENGTH} characters.</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold bg-[#264D8E] text-white hover:bg-[#1f3e73] hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-900/10 disabled:opacity-50 text-xs">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-xs animate-spin" />
                ) : activeTab === 'login' ? (<>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>) : (<>
                    <User className="w-4 h-4" />
                    <span>Sign Up</span>
                  </>)}
              </button>
            </form>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink font-serif mx-3 text-[11px] text-slate-500 uppercase font-bold ">Or continue with</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-xl font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
