#  Foundations

> **An adaptive spaced-repetition learning platform with document ingestion, an AI question-generation pipeline, server-authoritative grading, and Redis-backed cost controls.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Redis](https://img.shields.io/badge/Upstash-Redis-dc382d?style=for-the-badge&logo=redis)](https://upstash.com/)
[![CI](https://github.com/hemampandey/Foundations/actions/workflows/ci.yml/badge.svg)](https://github.com/hemampandey/Foundations/actions/workflows/ci.yml)

---

## Overview

**Foundations** is built to bridge learning science with modern AI-driven educational operations. Designed for students, clinicians, and professionals mastering complex theoretical frameworks (such as psychological counselling theories, medical concepts, or certification exams), Foundations flattens the *Ebbinghaus Forgetting Curve* through personalized active recall.

The platform combines a **learner-facing Spaced Repetition Engine (SM-2)** with an **Admin Operations Console** that turns study documents (PDF, DOCX, TXT) or pasted text into schema-validated Multiple Choice Questions (MCQs) via an LLM, with a human review queue before anything reaches learners.

---

## Key Features

### 1. Learning Science & Spaced Repetition (SM-2)
* **SuperMemo-2 (SM-2) Algorithm**: Calculates cognitive recall quality (ratings 0 to 5) after every attempt to update the question's **Easiness Factor (EF)** and schedule exact review dates.
* **Bloom's Taxonomy Alignment**: Questions target specific cognitive levels (*Remember*, *Understand*, *Apply*, *Analyze*, *Evaluate*).
* **Daily Spaced Review Decks**: Automated review queues prioritize overdue items chronologically without penalizing learners who miss a day.

### 2. Document Ingestion & AI Question Generation
* **Client-Side Document Parsing**: Upload **PDF**, **DOCX** or **TXT** files and the text is extracted in the browser. `pdf.js` and `mammoth.js` are lazy-loaded from a CDN only when needed, so they add nothing to the main bundle and no file ever touches the server.
* **Schema-Validated LLM Output**: Every generated question is validated with [Zod](https://zod.dev/) (exactly 4 distinct options, valid answer index, difficulty 1–3, Bloom level). Malformed questions are dropped individually instead of failing the batch.
* **Hallucination Check**: Each question cites a `source_excerpt`; the server verifies it actually appears in the theory text and flags unverified ones for reviewers.
* **Admin Review & Moderation Queue**: AI-generated questions enter a `draft` status for inline editing and approval before learners ever see them.
* **Redis Cost Controls**: Per-user sliding-window rate limiting and an in-flight lock that stops double-clicks/retries from paying for the same LLM call twice (see below).

### 3. Analytics & Gamification
* **Activity Heatmap**: Visualizes study consistency.
* **XP, Levels & Streaks**: XP is awarded **server-side** (10 for a correct answer, 2 for an attempt) with an anti-farming cooldown; levels and daily streaks are computed in the same database transaction.
* **Achievement Badges**: Dynamic rewards system tracking milestones like *Speed Demon*, *Perfectionist*, and *Cross-Domain Mastery*.

### 4. Premium Modern UX
* **Distraction-Free Practice Interface**: Full-screen quiz mode with warning exit confirmation dialogs and glassmorphism backdrop blur.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), Custom Design Tokens, CSS Keyframes, Dark/Light Themes |
| **Database & Auth** | [Supabase PostgreSQL](https://supabase.com/), Row Level Security (RLS), PL/pgSQL RPCs, JWT Authentication |
| **Caching & Rate Limiting** | [Upstash Redis](https://upstash.com/) (`@upstash/ratelimit` sliding window, `SET NX EX` locks) |
| **AI** | OpenRouter / OpenAI-compatible chat completions, [Zod](https://zod.dev/) output validation |
| **Document Parsing** | Client-side `pdf.js` (PDF) and `mammoth.js` (DOCX), lazy-loaded from CDN; native File API (TXT) |
| **Testing & CI** | [Vitest](https://vitest.dev/), [PGlite](https://pglite.dev/) (in-process Postgres for RLS/RPC tests), GitHub Actions |
| **Icons & Audio** | [Lucide React](https://lucide.dev/), Web Audio API (interactive sound feedback) |

---

## 📁 Repository Structure

```
foundations/
├── app/
│   ├── admin/                # Admin Console & Document-to-Quiz AI Pipeline
│   ├── api/
│   │   └── generate-mcqs/    # Server route: auth → Redis guard → LLM → Zod validation
│   ├── auth/                 # Login & Registration authentication flows
│   ├── components/           # Reusable UI components (Sidebar, Layout, Toast, Modals)
│   ├── dashboard/            # Learner Dashboard with activity heatmap & statistics
│   ├── journeys/             # Sequential learning path journeys
│   ├── practice/             # Interactive practice session quiz engine
│   ├── progress/             # Achievement badges, streak records, & mastery stats
│   ├── review/               # Spaced Repetition review decks (Forecast, Browse, History)
│   └── theories/             # Theory cards & domain directory
├── lib/
│   ├── __tests__/            # Unit tests (SM-2, adaptive difficulty, LLM parsing, Redis guard)
│   ├── attempts.ts           # Client wrapper for the submit_attempt RPC
│   ├── generation-guard.ts   # Redis rate limiting + in-flight request locks
│   ├── mcq-generation.ts     # Prompt construction & Zod validation of LLM output
│   ├── sm2.ts                # SuperMemo-2 Spaced Repetition algorithm implementation
│   ├── supabase.ts           # Supabase client & Row Level Security helpers
│   ├── types.ts              # Core TypeScript interfaces & schemas
│   └── utils.ts              # XP calculations, formatting, & helper utilities
├── supabase/
│   ├── schema.sql            # Base schema, RLS policies, functions
│   ├── migrations/           # Incremental migrations (apply in filename order)
│   └── tests/                # Database integration tests (RLS, grading RPC)
├── public/                   # Static assets & icons
└── app/globals.css           # Design tokens, theme variables, & keyframe animations
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 20.9+** installed on your system.

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/hemampandey/Foundations.git
cd Foundations/foundations
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Generator (OpenRouter)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-4o-mini # Optional, defaults to openai/gpt-4o-mini

# Redis (optional; without it, rate limiting and request locks are disabled)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
GENERATION_RATE_LIMIT_PER_HOUR=10 # Optional, defaults to 10
```

See [`.env.example`](.env.example) for the full list.

### 4. Set Up the Database
In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql), then each file in [`supabase/migrations/`](supabase/migrations/) in filename order.

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Test & Build
```bash
npm test            # unit + database integration tests
npm run lint && npm run typecheck
npm run build && npm run start
```

---

## 🧬 SuperMemo-2 (SM-2) Algorithm Implementation

Foundations evaluates every answer attempt with a quality score $q \in [0, 5]$ based on accuracy and response time:

$$\text{EF}' = \text{EF} + \left(0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)\right)$$

* If rating $q < 3$: Repetition count $n$ resets to $0$, and interval $I$ resets to $1\text{ day}$.
* If rating $q \ge 3$:
  * $n = 1 \implies I_1 = 1\text{ day}$
  * $n = 2 \implies I_2 = 6\text{ days}$
  * $n > 2 \implies I_n = I_{n-1} \times \text{EF}$

---

## 🔒 Security & Data Integrity

### Server-authoritative grading
Answers are graded inside Postgres by a single `submit_attempt(question_id, chosen_index, response_ms)` RPC. It identifies the caller with `auth.uid()`, grades against the stored answer, records the attempt and updates XP, level and streak in **one transaction** (the `user_progress` upsert row-lock serializes concurrent submissions).

This replaced an earlier design where the browser graded itself and called an `increment_xp(user_id, xp)` function that trusted both arguments, so any signed-in user could award any user arbitrary XP. The [migration](supabase/migrations/20261010000000_server_side_grading.sql) removes that function, drops direct-insert access to `attempts`, and uses column-level grants so learners can update only their own `mastery_scores`, never `xp`, `level` or `streak_days`. Re-answering a question within an hour is recorded for spaced repetition but earns no XP.

### Tested access control
[`supabase/tests/grading.test.ts`](supabase/tests/grading.test.ts) runs the real schema and migrations against in-process Postgres ([PGlite](https://pglite.dev/)) with a Supabase-style `auth.uid()` and `anon`/`authenticated` roles. It reproduces the original exploit before migrating, then asserts that RLS and grants block it afterwards. CI runs it on every push.

### Other measures
* **Row Level Security (RLS)** on every table; users can only read and mutate their own attempts, schedules and progress.
* **Role-Based Access Control**: admin features and the generation API require the `admin` role, verified server-side.
* **Security headers** (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) via the Next.js proxy.

---

## ⚡ Redis Cost Controls

Every MCQ generation is a paid LLM call. Before calling the provider, [`lib/generation-guard.ts`](lib/generation-guard.ts) applies two Redis checks (Upstash, HTTP-based so it works from serverless functions):

1. **In-flight lock**: `SET foundations:generate:inflight:{user}:{sha256(request)} NX EX 120`. An identical request already in progress gets `409` instead of a second paid call. It's checked first, so duplicates don't burn rate-limit quota, and released in a `finally` block.
2. **Sliding-window rate limit**: `GENERATION_RATE_LIMIT_PER_HOUR` per admin (default 10), returned as `X-RateLimit-*` headers, with `429` + `Retry-After` when exceeded.

Results are deliberately **not** cached: regenerating for the same theory is how admins get *new* questions, so a cache would hand back duplicates. If Redis is unconfigured or unreachable the guard **fails open** and logs a warning, keeping generation available behind admin auth.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
