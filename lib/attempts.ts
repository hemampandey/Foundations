import { supabase } from '@/lib/supabase';

export interface AttemptResult {
  isCorrect: boolean;
  correctIndex: number;
  xpEarned: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  streakDays: number;
}

interface SubmitAttemptRow {
  is_correct: boolean;
  correct_index: number;
  xp_earned: number;
  total_xp: number;
  level: number;
  leveled_up: boolean;
  streak_days: number;
}

/**
 * Record an answer via the submit_attempt RPC. Grading, XP, level and
 * streak are all computed server-side for the signed-in user.
 */
export async function submitAttempt(
  questionId: string,
  chosenIndex: number,
  responseMs: number
): Promise<AttemptResult> {
  const { data, error } = await supabase
    .rpc('submit_attempt', {
      p_question_id: questionId,
      p_chosen_index: chosenIndex,
      p_response_ms: Math.round(responseMs),
    })
    .single<SubmitAttemptRow>();

  if (error) throw error;

  return {
    isCorrect: data.is_correct,
    correctIndex: data.correct_index,
    xpEarned: data.xp_earned,
    totalXp: data.total_xp,
    level: data.level,
    leveledUp: data.leveled_up,
    streakDays: data.streak_days,
  };
}
