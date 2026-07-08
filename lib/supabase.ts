import { createClient } from '@supabase/supabase-js';

// Supabase Client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Re-export types so existing import paths still work.
export type { Profile, Theory, Question, Attempt, UserProgress } from './types';

// Auth helpers

import type { Profile } from './types';

/** Fetch the profile row for the currently authenticated user. */
export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[Foundations] Error fetching profile:', error.message);
      return null;
    }
    return data as Profile;
  } catch (err) {
    console.error('[Foundations] Unexpected error fetching profile:', err);
    return null;
  }
}

/**
 * DEV-ONLY: Directly change the logged-in user's role in the database.
 *
 * Gated behind `NEXT_PUBLIC_DEV_MODE=true`. In production this function
 * is a no-op that throws so the caller's catch-block can show a message.
 */
export async function devUpdateUserRole(role: 'admin' | 'learner'): Promise<void> {
  if (process.env.NEXT_PUBLIC_DEV_MODE !== 'true') {
    throw new Error('Role switching is only available in development mode.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to change roles.');

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', user.id);

  if (error) {
    throw error;
  }
}
