'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentProfile } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  userEmail: string | null;
  refreshProfile: (showLoading?: boolean) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  userEmail: null,
  refreshProfile: async () => {},
});

export function useProfile() {
  return useContext(ProfileContext);
}

export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const refreshProfile = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const p = await getCurrentProfile();
      setProfile(p);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
      } else {
        setUserEmail(null);
      }
    } catch (err) {
      console.error('[Foundations] Error fetching profile:', err);
      setProfile(null);
      setUserEmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshProfile();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        Promise.resolve().then(() => {
          refreshProfile();
        });
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
    <ProfileContext.Provider value={{ profile, loading, userEmail, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
