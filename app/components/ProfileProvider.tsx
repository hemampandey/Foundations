'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getCurrentProfile } from '@/lib/supabase';
import type { Profile, UserProgress } from '@/lib/types';

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  userEmail: string | null;
  refreshProfile: (showLoading?: boolean) => Promise<void>;
  progress: UserProgress | null;
  accuracy: number;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  userEmail: null,
  refreshProfile: async () => {},
  progress: null,
  accuracy: 0,
});

export function useProfile() {
  return useContext(ProfileContext);
}

export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);

  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const refreshProfile = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const p = await getCurrentProfile();
      setProfile((prev) => {
        if (prev && p && prev.id === p.id && prev.role === p.role) {
          return prev;
        }
        return p;
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail((prev) => prev === user.email ? prev : (user.email ?? null));
      } else {
        setUserEmail(null);
      }

      if (p) {
        // Fetch user progress
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', p.id)
          .maybeSingle();
        setProgress(progressData as UserProgress | null);

        // Fetch attempts for accuracy calculation
        const { data: attemptsData } = await supabase
          .from('attempts')
          .select('is_correct')
          .eq('user_id', p.id);
        
        const atts = attemptsData || [];
        const correct = atts.filter((a) => a.is_correct).length;
        const acc = atts.length > 0 ? Math.round((correct / atts.length) * 100) : 0;
        setAccuracy(acc);
      } else {
        setProgress(null);
        setAccuracy(0);
      }
    } catch (err) {
      console.error('[Foundations] Error fetching profile:', err);
      setProfile(null);
      setUserEmail(null);
      setProgress(null);
      setAccuracy(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshProfile();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only fetch the profile if we don't have one loaded yet to prevent window-focus/auto-refreshes from re-rendering the app.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!profileRef.current) {
          Promise.resolve().then(() => {
            refreshProfile();
          });
        }
      } else if (event === 'SIGNED_OUT') {
        Promise.resolve().then(() => {
          setProfile(null);
          setUserEmail(null);
          setLoading(false);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, userEmail, refreshProfile, progress, accuracy }}>
      {children}
    </ProfileContext.Provider>
  );
}
