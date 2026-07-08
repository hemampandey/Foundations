Project: "Foundations" — a theory-mastery trainer for counsellors
One-liner: An admin loads counselling theory (text/notes); the app turns it into adaptive, spaced-repetition MCQ journeys that build durable conceptual mastery, with levels and scores to keep learners coming back.

Stack
Frontend: Next.js (App Router) on Vercel
DB + Auth: Supabase (Postgres, Row Level Security, Supabase Auth)
MCQ generation: Anthropic API called from a Next.js server route (key stays server-side, never in the client)
Two roles: admin (authors content) and learner (takes journeys)
Data model (core tables)
theories — id, title, body_text, domain/tag, status
questions — id, theory_id, stem, options (jsonb), correct_index, explanation, difficulty (1–3), bloom_level, status (draft/approved), source_excerpt
journeys — id, title, ordered set of theories/questions, published flag
attempts — id, user_id, question_id, chosen_index, is_correct, response_ms, created_at
review_schedule — user_id, question_id, ease_factor, interval_days, due_at, repetitions (the SM-2 state)
user_progress — user_id, xp, level, streak_days, per-domain mastery score
Admin features
Paste or upload theory text → server route calls the Anthropic API to draft a batch of MCQs (stem, 4 options, correct answer, explanation, a difficulty tag, and the source excerpt the question came from).
Review queue — admin edits/approves/rejects each generated question before it goes live. This human-in-loop step is non-negotiable for clinical accuracy; questions stay draft until approved.
Group approved questions into named journeys and publish.
Learner features
Pick a journey → answer MCQs one at a time, get the explanation immediately after each answer.
Adaptive difficulty: track a running mastery estimate per domain. Serve harder questions as accuracy climbs, ease off after a wrong streak. A simple running-accuracy band (e.g. >80% → bump difficulty, <50% → drop) is enough for v1; mention Elo as a stretch.
Spaced recall: every answered question is scheduled with SM-2 (the Anki algorithm — well-documented, ~40 lines). Correct + confident answers push the interval out; misses reset it. A daily "Due for review" deck resurfaces items right before they'd be forgotten.
Engagement: XP per correct answer, levels, daily streak, and a per-domain mastery bar so progress feels visible.
Suggested milestones
M1 — Skeleton: Supabase schema + RLS, auth, admin can manually add a theory and one hand-written MCQ, learner can answer it. (Proves the stack end-to-end.)
M2 — Generation + review: Anthropic API route generates MCQs from theory text; admin review queue works.
M3 — Journeys + scoring: publishable journeys, attempts logged, XP/levels/streak.
M4 — Adaptive + spaced recall: difficulty adaptation + SM-2 scheduler with a daily review deck.