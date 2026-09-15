import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the service role key.
// This bypasses RLS so we can verify the caller's role securely.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_QUESTION_COUNT = 10;
const MAX_THEORY_BODY_LENGTH = 20_000; // characters

export async function POST(req: Request) {
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

    if (!theoryTitle || !theoryBody) {
      return NextResponse.json(
        { error: 'Missing theoryTitle or theoryBody in request body' },
        { status: 400 }
      );
    }

    if (typeof theoryBody === 'string' && theoryBody.length > MAX_THEORY_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Theory body is too long (max ${MAX_THEORY_BODY_LENGTH.toLocaleString()} characters).` },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(Number(rawCount) || 3, 1), MAX_QUESTION_COUNT);

    // ── Build Prompt ──
    let prompt = `
You are an expert educator drafting high-quality multiple choice questions (MCQs) to test a learner's mastery in a theory concept.

Theory Title: ${theoryTitle}
Theory Body:
${theoryBody}

Generate exactly ${count} Multiple Choice Questions based on the text above. 
Each question must test conceptual understanding rather than simple rote memorization.

CRITICAL REQUIREMENT: For each question, you must shuffle the four options randomly. You MUST distribute the correct answers evenly across all possible indices (0, 1, 2, and 3) so there is no bias towards any specific choice (such as option-2/index 1).
`;

    if (customInstructions && typeof customInstructions === 'string' && customInstructions.trim()) {
      prompt += `
Additional Custom Instructions to follow:
- ${customInstructions.trim().substring(0, 500)}
`;
    }

    prompt += `
Your response must be a single, valid JSON object with a key "questions" containing an array of objects. 
Each object in the "questions" array must match this schema EXACTLY:
{
  "stem": "string (the question statement)",
  "options": ["string", "string", "string", "string"], (exactly 4 options)
  "correct_index": number (0, 1, 2, or 3 pointing to the correct choice in the options array),
  "explanation": "string (clear, professional explanation of why the correct option is right and the others are incorrect)",
  "difficulty": number (1 = Easy, 2 = Medium, 3 = Hard),
  "bloom_level": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
  "source_excerpt": "string (the exact sentence or short phrase from the Theory Body that supports the correct answer)"
}

Do not include any wrapper text, markdown formatting like \`\`\`json, or explanations outside the JSON structure. Returns ONLY the raw JSON.
`;

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
    let parsed;
    try {
      let cleanContent = rawContent.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }
      parsed = JSON.parse(cleanContent);
    } catch {
      try {
        const start = rawContent.indexOf('{');
        const end = rawContent.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          parsed = JSON.parse(rawContent.substring(start, end + 1));
        } else {
          throw new Error('No JSON object found');
        }
      } catch {
        return NextResponse.json(
          { error: 'AI provider returned malformed JSON. Please try again.' },
          { status: 520 }
        );
      }
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return NextResponse.json(
        { error: 'Invalid response format: "questions" array is missing.' },
        { status: 520 }
      );
    }

    return NextResponse.json({ questions: parsed.questions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Generate MCQs Route Error]:', message);
    return NextResponse.json({ error: 'An internal error occurred while generating questions.' }, { status: 500 });
  }
}
