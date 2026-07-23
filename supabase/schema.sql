-- Foundations Schema Setup

-- 1. Create Profiles Table (user roles)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('admin', 'learner')) default 'learner',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 2. Create Security Helper Function to retrieve roles without infinite recursion
create or replace function public.get_user_role(user_id uuid)
returns text as $$
  select role from public.profiles where id = user_id;
$$ language sql security definer set search_path = public;

-- 3. Trigger to automatically create a profile on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'learner');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Create Theories Table
create table public.theories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_text text not null,
  domain text not null,
  status text not null check (status in ('draft', 'published')) default 'published',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on theories
alter table public.theories enable row level security;

-- 5. Create Questions Table
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  theory_id uuid references public.theories(id) on delete cascade not null,
  stem text not null,
  options jsonb not null, -- Array of strings e.g. ["Choice A", "Choice B", ...]
  correct_index integer not null check (correct_index >= 0 and correct_index < 10),
  explanation text not null,
  difficulty integer not null check (difficulty between 1 and 3) default 1,
  bloom_level text not null check (bloom_level in ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')) default 'remember',
  status text not null check (status in ('draft', 'approved')) default 'draft',
  source_excerpt text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on questions
alter table public.questions enable row level security;

-- 6. Create Attempts Table
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  chosen_index integer not null,
  is_correct boolean not null,
  response_ms integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on attempts
alter table public.attempts enable row level security;

-- 7. Create Journeys Table
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  published boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on journeys
alter table public.journeys enable row level security;

-- 8. Create Journey Questions Junction Table (to map ordered questions inside a journey)
create table public.journey_questions (
  journey_id uuid references public.journeys(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  sort_order integer not null,
  primary key (journey_id, question_id)
);

-- Enable RLS on journey_questions
alter table public.journey_questions enable row level security;

-- 9. Create Review Schedule Table (SM-2 Spaced Recall State)
create table public.review_schedule (
  user_id uuid references auth.users(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  ease_factor numeric not null default 2.5,
  interval_days integer not null default 0,
  due_at timestamp with time zone default timezone('utc'::text, now()) not null,
  repetitions integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, question_id)
);

-- Enable RLS on review_schedule
alter table public.review_schedule enable row level security;

-- 10. Create User Progress Table (Gamification, XP, Streaks)
create table public.user_progress (
  user_id uuid references auth.users(id) on delete cascade primary key,
  xp integer not null default 0,
  level integer not null default 1,
  streak_days integer not null default 0,
  mastery_scores jsonb not null default '{}'::jsonb, -- e.g. {"CBT": 80, "Psychoanalysis": 45}
  last_active_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on user_progress
alter table public.user_progress enable row level security;


-- ================= RLS POLICIES =================

-- Profiles Policies
create policy "Allow authenticated users to read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- SECURITY: Only admins can update profiles (prevents learner self-escalation to admin).
-- In dev mode, devUpdateUserRole() uses the anon key which respects RLS,
-- so the dev toggle only works when the current user is already an admin.
create policy "Only admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

-- Theories Policies
create policy "Allow authenticated users to read published theories"
  on public.theories for select
  to authenticated
  using (status = 'published' or public.get_user_role(auth.uid()) = 'admin');

create policy "Allow admins to modify theories"
  on public.theories for all
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

-- Questions Policies
create policy "Allow authenticated users to read approved questions"
  on public.questions for select
  to authenticated
  using (status = 'approved' or public.get_user_role(auth.uid()) = 'admin');

create policy "Allow admins to modify questions"
  on public.questions for all
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

-- Attempts Policies
create policy "Allow users or admins to read attempts"
  on public.attempts for select
  to authenticated
  using (auth.uid() = user_id or public.get_user_role(auth.uid()) = 'admin');

create policy "Allow users to log their own attempts"
  on public.attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Journeys Policies
create policy "Allow authenticated users to read published journeys"
  on public.journeys for select
  to authenticated
  using (published = true or public.get_user_role(auth.uid()) = 'admin');

create policy "Allow admins to modify journeys"
  on public.journeys for all
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

-- Journey Questions Policies
create policy "Allow authenticated users to read journey questions"
  on public.journey_questions for select
  to authenticated
  using (true);

create policy "Allow admins to modify journey questions"
  on public.journey_questions for all
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

-- Review Schedule Policies
create policy "Allow users to manage their own review schedules"
  on public.review_schedule for all
  to authenticated
  using (auth.uid() = user_id);

-- User Progress Policies
create policy "Allow authenticated users to view progress"
  on public.user_progress for select
  to authenticated
  using (true);

create policy "Allow users to update their own progress"
  on public.user_progress for all
  to authenticated
  using (auth.uid() = user_id);

-- ─── Helper Functions & RPCs ───

-- Calculate level based on XP formula
create or replace function public.calculate_level_from_xp(xp integer)
returns integer as $$
declare
  lvl integer := 1;
  rem integer := xp;
begin
  while rem >= lvl * 100 loop
    rem := rem - lvl * 100;
    lvl := lvl + 1;
  end loop;
  return lvl;
end;
$$ language plpgsql immutable;

-- Security Definer function to increment user progress safely and atomically (prevents lost updates)
create or replace function public.increment_xp(
  p_user_id uuid,
  p_xp_earned integer,
  p_last_active_at text
)
returns void as $$
declare
  current_xp integer := 0;
  new_xp integer := 0;
  new_level integer := 1;
  new_streak integer := 1;
  last_active timestamp with time zone;
  last_active_date date;
  now_date date;
  diff_days integer;
begin
  -- Fetch current progress
  select xp, streak_days, last_active_at into current_xp, new_streak, last_active
  from public.user_progress
  where user_id = p_user_id;

  if not found then
    -- Record does not exist, insert initial values
    insert into public.user_progress (user_id, xp, level, streak_days, last_active_at)
    values (p_user_id, p_xp_earned, public.calculate_level_from_xp(p_xp_earned), 1, to_timestamp(p_last_active_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    return;
  end if;

  -- Recalculate streak
  if last_active is not null then
    last_active_date := last_active::date;
    now_date := to_timestamp(p_last_active_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')::date;
    diff_days := now_date - last_active_date;

    if diff_days = 1 then
      new_streak := new_streak + 1;
    elsif diff_days > 1 then
      new_streak := 1;
    end if;
  else
    new_streak := 1;
  end if;

  if new_streak <= 0 then
    new_streak := 1;
  end if;

  new_xp := current_xp + p_xp_earned;
  new_level := public.calculate_level_from_xp(new_xp);

  update public.user_progress
  set xp = new_xp,
      level = new_level,
      streak_days = new_streak,
      last_active_at = to_timestamp(p_last_active_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  where user_id = p_user_id;
end;
$$ language plpgsql security definer;


-- ─── Performance Indexes ───

-- Index for finding and sorting attempts by user
CREATE INDEX IF NOT EXISTS idx_attempts_user_created 
ON public.attempts (user_id, created_at DESC);

-- Index for counting/filtering questions by theory and status
CREATE INDEX IF NOT EXISTS idx_questions_theory_status 
ON public.questions (theory_id, status);

-- Index for fetching due review schedules
CREATE INDEX IF NOT EXISTS idx_review_schedule_user_due 
ON public.review_schedule (user_id, due_at ASC);

-- Index for journey questions matching
CREATE INDEX IF NOT EXISTS idx_journey_questions_mapping 
ON public.journey_questions (journey_id);

