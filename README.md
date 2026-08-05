# 🎓 Foundations

> **An adaptive spaced-repetition learning platform paired with an AI-driven question generation and document ingestion pipeline.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🌟 Executive Overview

**Foundations** is built to bridge learning science with modern AI-driven educational operations. Designed for students, clinicians, and professionals mastering complex theoretical frameworks (such as psychological counselling theories, medical concepts, or certification exams), Foundations flattens the *Ebbinghaus Forgetting Curve* through personalized active recall.

The platform combines a **learner-facing Spaced Repetition Engine (SM-2)** with an **Admin Operations Console** that extracts text from raw study documents (PDF, Word, TXT) and generates distractor-validated Multiple Choice Questions (MCQs) in seconds.

---

## ✨ Key Features

### 🧠 1. Learning Science & Spaced Repetition (SM-2)
* **SuperMemo-2 (SM-2) Algorithm**: Calculates cognitive recall quality (ratings 0 to 5) after every attempt to update the question's **Easiness Factor (EF)** and schedule exact review dates.
* **Bloom's Taxonomy Alignment**: Questions target specific cognitive levels (*Remember*, *Understand*, *Apply*, *Analyze*, *Evaluate*).
* **Daily Spaced Review Decks**: Automated review queues prioritize overdue items chronologically without penalizing learners who miss a day.

### 🤖 2. AI Question Generation & Document Ingestion
* **Zero-Dependency Client-Side Parsing**: Drag-and-drop raw **PDF** (`pdf.js`), **Word** (`mammoth.js`), or **Plain Text** files to extract text instantly with 0ms server latency.
* **AI Distractor Validation**: Generates high-quality MCQs with detailed explanations, distractor options, and difficulty scoring (L1–L5).
* **Admin Review & Moderation Queue**: AI-generated questions enter a `draft` status for inline editing, distractor testing, and single-click bulk approvals.

### 📊 3. Analytics & Gamification
* **52-Week GitHub-Style Activity Heatmap**: Visualizes study consistency with edge-aware custom tooltips.
* **XP & Level Progression**: Earn XP based on accuracy, response speed, difficulty, and consecutive daily streak bonuses.
* **11 Unlockable Achievement Badges**: Dynamic rewards system tracking milestones like *Speed Demon*, *Perfectionist*, and *Cross-Domain Mastery*.

### 🎨 4. Premium Modern UX
* **iOS-Inspired App Launch Expansion**: Smooth spring-physics full-screen transitions (`cubic-bezier(0.16, 1, 0.3, 1)`).
* **Distraction-Free Practice Interface**: Full-screen quiz mode with warning exit confirmation dialogs and glassmorphism backdrop blur.
* **Cross-Browser Global Scrollbar Suppression**: Clean, borderless interface with invisible scrollbars across Chrome, Safari, Firefox, and Edge.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), Custom Design Tokens, CSS Keyframes, Dark/Light Themes |
| **Database & Auth** | [Supabase PostgreSQL](https://supabase.com/), Row Level Security (RLS) Policies, JWT Authentication |
| **Document Parsers** | Client-side `pdf.js` (PDF parsing), `mammoth.js` (DOCX parsing), Native Web File API |
| **Icons & Audio** | [Lucide React](https://lucide.dev/), Web Audio API (interactive sound feedback) |

---

## 📁 Repository Structure

```
foundations/
├── app/
│   ├── admin/                # Admin Console & Document-to-Quiz AI Pipeline
│   ├── api/
│   │   └── generate-mcqs/    # Serverless Edge API route for AI question generation
│   ├── auth/                 # Login & Registration authentication flows
│   ├── components/           # Reusable UI components (Sidebar, Layout, Toast, Modals)
│   ├── dashboard/            # Learner Dashboard with activity heatmap & statistics
│   ├── journeys/             # Sequential learning path journeys
│   ├── practice/             # Interactive practice session quiz engine
│   ├── progress/             # Achievement badges, streak records, & mastery stats
│   ├── review/               # Spaced Repetition review decks (Forecast, Browse, History)
│   └── theories/             # Theory cards & domain directory
├── lib/
│   ├── sm2.ts                # SuperMemo-2 Spaced Repetition algorithm implementation
│   ├── supabase.ts           # Supabase client & Row Level Security helpers
│   ├── types.ts              # Core TypeScript interfaces & schemas
│   └── utils.ts              # XP calculations, formatting, & helper utilities
├── public/                   # Static assets & audio effects
└── app/globals.css           # Design tokens, theme variables, & keyframe animations
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 18+** installed on your system.

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

# AI Generator Key (Optional for AI question generation)
OPENAI_API_KEY=your-openai-api-key
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production
```bash
npx eslint . && npm run build
npm run start
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

* **Row Level Security (RLS)**: Enforced across Supabase tables (`attempts`, `user_progress`, `review_schedule`). Users can only query and mutate their own data.
* **Role-Based Access Control**: Admin panel features require verified `admin` role attributes in the user profile table.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
