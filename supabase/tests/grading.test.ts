/**
 * Integration tests for supabase/schema.sql + migrations, run against real
 * Postgres (PGlite, in-process). A minimal auth schema stands in for
 * Supabase's so RLS, grants and auth.uid() behave as they do in production.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_DIR = join(__dirname, '..');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const Q1 = '20000000-0000-0000-0000-000000000001'; // approved, answer 2
const Q2 = '20000000-0000-0000-0000-000000000002'; // approved, answer 0
const Q3 = '20000000-0000-0000-0000-000000000003'; // draft

let db: PGlite;
let legacyAttemptXp: number | undefined;

const read = (file: string) => readFileSync(join(SUPABASE_DIR, file), 'utf8');
const migrations = () =>
  readdirSync(join(SUPABASE_DIR, 'migrations')).filter((f) => f.endsWith('.sql')).sort();

/** Run a query as a signed-in user (or anon when user is null). */
async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

interface SubmitRow {
  is_correct: boolean;
  correct_index: number;
  xp_earned: number;
  total_xp: number;
  level: number;
  leveled_up: boolean;
  streak_days: number;
}

const submit = async (user: string | null, question: string, choice: number) =>
  (await as<SubmitRow>(user, 'select * from submit_attempt($1, $2, $3)', [question, choice, 3000])).rows[0];

const progress = async (user: string) =>
  (await db.query<{ xp: number; mastery_scores: Record<string, number> }>(
    'select xp, mastery_scores from user_progress where user_id = $1', [user]
  )).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    -- Supabase databases run in UTC
    set timezone to 'UTC';
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
  `);
  await db.exec(read('schema.sql'));
  // Supabase grants these roles broad privileges by default; RLS does the filtering.
  await db.exec(`
    grant all on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema public to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
    insert into theories (id, title, body_text, domain)
      values ('10000000-0000-0000-0000-000000000000', 'T', 'Body', 'CBT');
    insert into questions (id, theory_id, stem, options, correct_index, explanation, status) values
      ('${Q1}', '10000000-0000-0000-0000-000000000000', 'Q1', '["a","b","c","d"]', 2, 'e', 'approved'),
      ('${Q2}', '10000000-0000-0000-0000-000000000000', 'Q2', '["a","b","c","d"]', 0, 'e', 'approved'),
      ('${Q3}', '10000000-0000-0000-0000-000000000000', 'Q3', '["a","b","c","d"]', 0, 'e', 'draft');
  `);

  // Pre-migration state: one legacy attempt, and the XP exploit is live.
  await db.exec(`insert into attempts (user_id, question_id, chosen_index, is_correct, response_ms)
                 values ('${A}', '${Q1}', 2, true, 1000)`);
  await as(A, `select increment_xp($1, 1000000, '2026-10-10T10:00:00.000Z')`, [B]);
  expect((await progress(B)).xp).toBe(1_000_000);

  for (const file of migrations()) await db.exec(read(`migrations/${file}`));

  legacyAttemptXp = (await db.query<{ xp_earned: number }>('select xp_earned from attempts')).rows[0]?.xp_earned;
}, 30_000);

beforeEach(async () => {
  await db.exec('delete from attempts; delete from user_progress;');
});

describe('server-side grading migration', () => {
  it('backfills xp_earned on pre-existing attempts', () => {
    expect(legacyAttemptXp).toBe(10);
  });

  it('removes increment_xp, closing the arbitrary-XP exploit', async () => {
    await expect(as(A, `select increment_xp($1, 1000000, '2026-10-10T10:00:00.000Z')`, [B])).rejects.toThrow(/does not exist/);
  });
});

describe('submit_attempt', () => {
  it('grades correct answers server-side and awards 10 XP', async () => {
    expect(await submit(A, Q1, 2)).toMatchObject({
      is_correct: true, correct_index: 2, xp_earned: 10, total_xp: 10, level: 1, leveled_up: false, streak_days: 1,
    });
  });

  it('awards 2 XP for a wrong answer and reveals the correct index', async () => {
    expect(await submit(A, Q2, 3)).toMatchObject({ is_correct: false, correct_index: 0, xp_earned: 2 });
  });

  it('records but does not reward re-answering within an hour', async () => {
    await submit(A, Q1, 2);
    expect(await submit(A, Q1, 2)).toMatchObject({ xp_earned: 0, total_xp: 10 });
    const { rows } = await db.query<{ xp_earned: number }>('select xp_earned from attempts order by created_at');
    expect(rows.map((r) => r.xp_earned)).toEqual([10, 0]);
  });

  it('only ever credits the caller', async () => {
    await submit(A, Q1, 2);
    expect(await progress(B)).toBeUndefined();
  });

  it('detects level-ups', async () => {
    await db.exec(`insert into user_progress (user_id, xp, level) values ('${A}', 95, 1)`);
    expect(await submit(A, Q1, 2)).toMatchObject({ total_xp: 105, level: 2, leveled_up: true });
  });

  it('extends the streak on consecutive days and resets after a gap', async () => {
    await db.exec(`insert into user_progress (user_id, streak_days, last_active_at)
                   values ('${A}', 4, now() - interval '1 day')`);
    expect((await submit(A, Q1, 2)).streak_days).toBe(5);

    await db.exec(`update user_progress set last_active_at = now() - interval '3 days'`);
    expect((await submit(A, Q2, 0)).streak_days).toBe(1);
  });

  it('rejects anonymous callers, draft questions and invalid options', async () => {
    await expect(submit(null, Q1, 2)).rejects.toThrow(/permission denied/);
    await expect(submit(A, Q3, 0)).rejects.toThrow(/Question not found/);
    await expect(submit(A, Q1, 4)).rejects.toThrow(/Invalid option index/);
    await expect(submit(A, Q1, -1)).rejects.toThrow(/Invalid option index/);
  });
});

describe('row-level security after migration', () => {
  it('blocks direct inserts into attempts', async () => {
    await expect(
      as(A, `insert into attempts (user_id, question_id, chosen_index, is_correct, response_ms)
             values ($1, $2, 0, true, 1)`, [A, Q1])
    ).rejects.toThrow(/row-level security/);
  });

  it('blocks learners from writing xp or creating progress rows', async () => {
    await submit(A, Q1, 2);
    await expect(as(A, 'update user_progress set xp = 999999 where user_id = $1', [A])).rejects.toThrow(/permission denied/);
    await expect(as(B, 'insert into user_progress (user_id, xp) values ($1, 999999)', [B])).rejects.toThrow(/permission denied/);
  });

  it('still lets learners update only their own mastery scores', async () => {
    await submit(A, Q1, 2);
    await submit(B, Q1, 2);
    await as(A, `update user_progress set mastery_scores = '{"CBT": 80}' where user_id = $1`, [A]);
    await as(A, `update user_progress set mastery_scores = '{"CBT": 0}' where user_id = $1`, [B]);
    expect((await progress(A)).mastery_scores).toEqual({ CBT: 80 });
    expect((await progress(B)).mastery_scores).toEqual({});
  });
});
