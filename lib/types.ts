// ──────────────────────────────────────────────
// Foundations — Shared Type Definitions
// ──────────────────────────────────────────────

export interface Profile {
  id: string;
  role: 'admin' | 'learner';
  created_at: string;
}

export interface Theory {
  id: string;
  title: string;
  body_text: string;
  domain: string;
  status: 'draft' | 'published';
  created_at: string;
}

export interface Question {
  id: string;
  theory_id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: 1 | 2 | 3;
  bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  status: 'draft' | 'approved';
  source_excerpt?: string;
  created_at: string;
}

/** A question row joined with its parent theory title (from admin list queries). */
export interface QuestionWithTheory extends Question {
  theories?: { title: string } | null;
}

export interface Attempt {
  id: string;
  user_id: string;
  question_id: string;
  chosen_index: number;
  is_correct: boolean;
  response_ms: number;
  created_at: string;
}

export interface AttemptWithQuestion extends Attempt {
  question?: {
    stem: string;
    theories?: {
      id: string;
      title: string;
    } | null;
  } | null;
}

export interface UserProgress {
  user_id: string;
  xp: number;
  level: number;
  streak_days: number;
  mastery_scores: Record<string, number>;
  last_active_at: string;
}

export interface ReviewSchedule {
  user_id: string;
  question_id: string;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  repetitions: number;
  created_at: string;
}

export interface Journey {
  id: string;
  title: string;
  published: boolean;
  created_at: string;
}

export interface JourneyQuestion {
  journey_id: string;
  question_id: string;
  sort_order: number;
}

export type BloomLevel = Question['bloom_level'];
export type Difficulty = Question['difficulty'];
export type TheoryStatus = Theory['status'];
export type QuestionStatus = Question['status'];
export type UserRole = Profile['role'];

