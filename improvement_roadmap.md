# Foundations — Improvement Roadmap

## 🟢 Tier 1 — Quick Wins (1–2 days each)

### 1. Learner Onboarding Flow
Currently, a new user lands on the dashboard with zero context. Add a first-time welcome modal or guided walkthrough that explains:
- What journeys are
- How the daily review deck works
- What XP/streaks mean

### 2. Empty State Illustrations
Pages like Progress, Review, and Dashboard show raw text when there's no data. Replace with illustrated empty states ("No reviews due — you're all caught up! 🎉") to make the app feel alive even before the learner starts.

### 3. Toast Notifications
Admin actions (approve, reject, save) currently have no visible feedback beyond optimistic state changes. Add a lightweight toast system (bottom-right corner) so the user gets confirmation like "✓ MCQ approved" or "✗ Question deleted".

### 4. Keyboard Shortcuts for Practice
During MCQ practice, allow learners to press `1`, `2`, `3`, `4` to select an answer and `Enter` to confirm. Power users will love this.

---

## 🟡 Tier 2 — Medium Effort (3–7 days each)

### 6. Learner Analytics Dashboard
The current Progress page shows mock data. Wire it to real Supabase queries:
- **Accuracy over time** — query `attempts` grouped by week
- **Domain mastery radar** — pull from `user_progress.mastery_scores`
- **Heatmap** — count attempts per day for the last 12 weeks
- **Response time trends** — average `response_ms` per session

### 7. Journey Progress Tracking
Currently there's no way for a learner to see how far they are through a journey. Add a `journey_progress` table or compute it client-side:
```
journey_progress = (answered questions in journey) / (total questions in journey)
```
Show a progress bar on each journey card.

### 8. PDF/Document Upload for Theories
Currently admins paste raw text. Add a file upload flow that:
- Accepts `.pdf`, `.docx`, or `.txt`
- Extracts text server-side (using `pdf-parse` or similar)
- Populates the theory body field automatically

### 9. Question Feedback Loop
Let learners flag questions ("This explanation is unclear", "Answer seems wrong"). Store flags in a `question_flags` table. Surface flagged questions in the admin Review Queue with a badge count.

### 10. Bulk MCQ Actions in Review Queue
Allow admins to select multiple draft questions and approve/reject them in one click instead of one-by-one.

### 11. Mastery Score Updates
The `mastery_scores` JSONB field in `user_progress` exists but isn't being updated after practice sessions. Wire the practice completion flow to update domain-specific mastery percentages based on running accuracy.

---

## 🔴 Tier 3 — Ambitious Features (1–3 weeks each)

### 12. Real-time Collaborative Review
Use Supabase Realtime subscriptions so that if two admins are reviewing questions simultaneously, they see updates live (a question approved by Admin A disappears from Admin B's queue instantly).

### 13. Elo-based Difficulty Rating
The current adaptive difficulty uses fixed bands (≥80% → hard, 50-79% → medium, <50% → easy). Replace or supplement with an **Elo rating system**:
- Each question gets an Elo score
- Each learner gets an Elo score
- When a learner answers, both scores update based on the outcome
- Questions are served by matching learner Elo to question Elo

This creates much finer-grained difficulty targeting than 3 discrete bands.

### 14. Multi-tenant / Organization Support
Add an `organizations` table so multiple counselling schools can use the platform independently, each with their own admins, theories, and learner pools.

### 15. Mobile PWA / Native App
The app is responsive but not installable. Add a `manifest.json`, service worker, and offline caching so learners can install it on their phone home screen and do reviews even with intermittent connectivity.

### 16. AI-Powered Explanation Enhancement
After a learner gets a question wrong, use the AI to generate a personalized micro-explanation based on:
- The wrong option they chose
- Their historical weak areas
- The source theory text

This goes beyond the static `explanation` field and creates a tutoring-like experience.

### 17. Cohort/Classroom Mode
Allow an admin to create a "cohort" (e.g., "2026 Batch A"), assign journeys to it, and view aggregate analytics (class average accuracy, completion rates, struggling students).

---

## 🔧 Technical Debt & Infrastructure

### 18. Service Role Key Setup
The API route currently creates an authenticated client per-request because `SUPABASE_SERVICE_ROLE_KEY` is missing from `.env.local`. Adding the service role key would simplify server-side auth and reduce per-request overhead.

### 19. Component Extraction
Several page files are very large (e.g., [review/page.tsx](file:///Users/hemam/Projects/Foundations/foundations/app/review/page.tsx) and [practice/page.tsx](file:///Users/hemam/Projects/Foundations/foundations/app/practice/page.tsx)). Break them into smaller, focused components for maintainability.

### 20. API Route Error Monitoring
Add structured error logging (e.g., Sentry or Supabase Edge Functions logs) to the `/api/generate-mcqs` route so you can track AI generation failures in production.

### 21. Rate Limiting
The MCQ generation endpoint calls an external AI API with no rate limiting. Add basic rate limiting (e.g., max 5 generations per admin per hour) to prevent accidental cost spikes.

### 22. Automated Testing
Add at minimum:
- Unit tests for [sm2.ts](file:///Users/hemam/Projects/Foundations/foundations/lib/sm2.ts) and [adaptive.ts](file:///Users/hemam/Projects/Foundations/foundations/lib/adaptive.ts) (pure functions, easy to test)
- Integration tests for the `/api/generate-mcqs` route
- E2E tests for the learner practice flow
