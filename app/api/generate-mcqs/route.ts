import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildMcqPrompt, parseGeneratedQuestions } from '@/lib/mcq-generation';
import { acquireGenerationSlot, rateLimitHeaders, requestFingerprint } from '@/lib/generation-guard';

// Server-side Supabase client using the service role key.
// This bypasses RLS so we can verify the caller's role securely.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_QUESTION_COUNT = 10;
const MAX_THEORY_BODY_LENGTH = 20_000; // characters

export async function POST(req: Request) {
  let releaseSlot: (() => Promise<void>) | undefined;

  try {
    // ── Auth Check ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }

    // ── Role Check ──
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can generate MCQs.' },
        { status: 403 }
      );
    }

    // ── API Key Check ──
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;
    const apiKey = openRouterApiKey || openAiApiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API key is not configured. Please set OPENROUTER_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    // ── Input Validation ──
    const { theoryTitle, theoryBody, count: rawCount = 3, customInstructions } = await req.json();

    if (typeof theoryTitle !== 'string' || typeof theoryBody !== 'string' || !theoryTitle || !theoryBody) {
      return NextResponse.json(
        { error: 'Missing theoryTitle or theoryBody in request body' },
        { status: 400 }
      );
    }

    if (theoryBody.length > MAX_THEORY_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Theory body is too long (max ${MAX_THEORY_BODY_LENGTH.toLocaleString()} characters).` },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(Number(rawCount) || 3, 1), MAX_QUESTION_COUNT);

    // ── Cost Controls (Redis) ──
    const slot = await acquireGenerationSlot(
      user.id,
      requestFingerprint([theoryTitle, theoryBody, count, customInstructions ?? ''])
    );
    if (!slot.ok) {
      return NextResponse.json(
        { error: slot.error },
        { status: slot.status, headers: rateLimitHeaders(slot.rateLimit, slot.status === 429) }
      );
    }
    releaseSlot = slot.release;

    // ── Build Prompt ──
    const prompt = buildMcqPrompt({
      theoryTitle,
      theoryBody,
      count,
      customInstructions: typeof customInstructions === 'string' ? customInstructions : undefined,
    });

    // ── Configure Provider & Endpoint ──
    const isOpenRouter = Boolean(openRouterApiKey || apiKey.startsWith('sk-or-'));
    const endpoint = isOpenRouter
      ? (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions')
      : (process.env.OPENAI_BASE_URL
          ? `${process.env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`
          : 'https://api.openai.com/v1/chat/completions');

    const model = isOpenRouter
      ? (process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (isOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Foundations Learning Platform';
    }

    // ── Call AI Provider ──
    const aiResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that outputs only valid, structured JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[AI Provider API Error]:', errorText);
      let errorMsg = aiResponse.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMsg = errorText;
      }
      return NextResponse.json(
        { error: `AI Provider returned an error (${aiResponse.status}): ${errorMsg}` },
        { status: aiResponse.status }
      );
    }

    const data = await aiResponse.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: 'AI provider returned an empty completion response.' },
        { status: 500 }
      );
    }

    // ── Parse & Validate Response ──
    let result;
    try {
      result = parseGeneratedQuestions(rawContent, theoryBody);
    } catch {
      return NextResponse.json(
        { error: 'AI provider returned malformed JSON. Please try again.' },
        { status: 502 }
      );
    }

    if (result.rejected.length > 0) {
      console.warn('[Generate MCQs] Rejected malformed questions:', result.rejected);
    }

    if (result.questions.length === 0) {
      return NextResponse.json(
        { error: 'AI provider returned no valid questions. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { questions: result.questions, rejected: result.rejected },
      { headers: rateLimitHeaders(slot.rateLimit) }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Generate MCQs Route Error]:', message);
    return NextResponse.json({ error: 'An internal error occurred while generating questions.' }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
