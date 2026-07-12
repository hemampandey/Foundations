-- M4 Migration: review_schedules table for SM-2 spaced repetition
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS review_schedules (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  ease_factor FLOAT DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  due_at      TIMESTAMPTZ DEFAULT NOW(),
  repetitions INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- RLS: users can only see/update their own schedules
ALTER TABLE review_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own review schedules"
  ON review_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
