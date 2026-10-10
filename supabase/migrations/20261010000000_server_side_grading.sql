-- Server-side grading & XP awarding
--
-- Before: the browser graded its own answers, inserted the attempt row, and
-- called increment_xp(p_user_id, p_xp_earned, ...), a SECURITY DEFINER
-- function that trusted both arguments. Any signed-in user could award any
-- user any amount of XP, and could also write user_progress directly.
--
-- After: submit_attempt() is the only way to record an attempt or earn XP.
-- It identifies the caller with auth.uid(), grades against the stored
-- answer, and updates attempts + user_progress in a single transaction.

-- ─── 1. Record XP per attempt ───

alter table public.attempts add column if not exists xp_earned integer not null default 0;

-- Backfill history using the flat rule the client applied before this migration.
update public.attempts set xp_earned = case when is_correct then 10 else 2 end
where xp_earned = 0;

-- ─── 2. Grading RPC ───

create or replace function public.submit_attempt(
  p_question_id uuid,
  p_chosen_index integer,
  p_response_ms integer
)
returns table (
  is_correct boolean,
  correct_index integer,
  xp_earned integer,
  total_xp integer,
  level integer,
  leveled_up boolean,
  streak_days integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_correct_index integer;
  v_option_count integer;
  v_is_correct boolean;
  v_xp integer;
  v_response_ms integer := least(greatest(coalesce(p_response_ms, 0), 0), 3600000);
  v_today date := (now() at time zone 'utc')::date;
  v_total integer;
  v_level integer;
  v_streak integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select q.correct_index, jsonb_array_length(q.options)
    into v_correct_index, v_option_count
  from questions q
  where q.id = p_question_id and q.status = 'approved';

  if not found then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  if p_chosen_index is null or p_chosen_index < 0 or p_chosen_index >= v_option_count then
    raise exception 'Invalid option index' using errcode = '22023';
  end if;

  v_is_correct := p_chosen_index = v_correct_index;

  -- Anti-farming: re-answering the same question within an hour is still
  -- recorded (for analytics and SM-2) but earns no XP.
  if exists (
    select 1 from attempts a
    where a.user_id = v_user
      and a.question_id = p_question_id
      and a.created_at > now() - interval '1 hour'
  ) then
    v_xp := 0;
  else
    v_xp := case when v_is_correct then 10 else 2 end;
  end if;

  insert into attempts (user_id, question_id, chosen_index, is_correct, response_ms, xp_earned)
  values (v_user, p_question_id, p_chosen_index, v_is_correct, v_response_ms, v_xp);

  -- Upsert locks the progress row, so concurrent submissions serialize
  -- instead of losing updates.
  insert into user_progress as up (user_id, xp, level, streak_days, last_active_at)
  values (v_user, v_xp, calculate_level_from_xp(v_xp), 1, now())
  on conflict (user_id) do update set
    xp = up.xp + excluded.xp,
    level = calculate_level_from_xp(up.xp + excluded.xp),
    streak_days = case (v_today - (up.last_active_at at time zone 'utc')::date)
      when 0 then greatest(up.streak_days, 1)
      when 1 then up.streak_days + 1
      else 1
    end,
    last_active_at = now()
  returning up.xp, up.level, up.streak_days into v_total, v_level, v_streak;

  return query select
    v_is_correct,
    v_correct_index,
    v_xp,
    v_total,
    v_level,
    v_level > calculate_level_from_xp(v_total - v_xp),
    v_streak;
end;
$$;

revoke execute on function public.submit_attempt(uuid, integer, integer) from public, anon;
grant execute on function public.submit_attempt(uuid, integer, integer) to authenticated;

-- ─── 3. Remove the trusting RPC ───

drop function if exists public.increment_xp(uuid, integer, text);

-- ─── 4. Lock down direct writes ───

-- Attempts can only be created through submit_attempt().
drop policy if exists "Allow users to log their own attempts" on public.attempts;

-- Learners may still write their own mastery_scores, but not xp/level/streak.
drop policy if exists "Allow users to update their own progress" on public.user_progress;

revoke insert, update, delete on public.user_progress from authenticated, anon;
grant update (mastery_scores) on public.user_progress to authenticated;

create policy "Allow users to update their own mastery scores"
  on public.user_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
