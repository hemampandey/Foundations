/**
 * MCQ Generation — prompt construction and output validation.
 *
 * Kept free of network/Next.js dependencies so it can be unit tested.
 * The API route handles auth and the provider call; this module owns
 * what we ask the model for and what we accept back.
 */

import { z } from 'zod';

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;

const GeneratedQuestionSchema = z
  .object({
    stem: z.string().trim().min(10),
    options: z.array(z.string().trim().min(1)).length(4),
    correct_index: z.coerce.number().int().min(0).max(3),
    explanation: z.string().trim().min(10),
    difficulty: z.coerce.number().int().min(1).max(3),
    bloom_level: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(BLOOM_LEVELS))
      .catch('understand'),
    source_excerpt: z.string().trim().default(''),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4, {
    message: 'Options must be distinct',
    path: ['options'],
  });

type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export interface PromptInput {
  theoryTitle: string;
  theoryBody: string;
  count: number;
  customInstructions?: string;
}

export function buildMcqPrompt({ theoryTitle, theoryBody, count, customInstructions }: PromptInput): string {
  let prompt = `
You are an expert educator drafting high-quality multiple choice questions (MCQs) to test a learner's mastery in a theory concept.

Theory Title: ${theoryTitle}
Theory Body:
${theoryBody}

Generate exactly ${count} Multiple Choice Questions based on the text above.
Each question must test conceptual understanding rather than simple rote memorization.

CRITICAL REQUIREMENT: For each question, you must shuffle the four options randomly. You MUST distribute the correct answers evenly across all possible indices (0, 1, 2, and 3) so there is no bias towards any specific choice (such as option-2/index 1).
`;

  if (customInstructions && customInstructions.trim()) {
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

  return prompt;
}

/** Extract a JSON object from raw model text, tolerating code fences and stray prose. */
export function extractJson(raw: string): unknown {
  let clean = raw.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  try {
    return JSON.parse(clean);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('No JSON object found');
    return JSON.parse(raw.substring(start, end + 1));
  }
}

/** Collapse whitespace and case so excerpts can be matched against the source. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface ParseResult {
  questions: (GeneratedQuestion & { excerpt_verified: boolean })[];
  rejected: { index: number; reason: string }[];
}

/**
 * Validate model output question-by-question. Malformed questions are
 * dropped (and reported) rather than failing the whole batch, and each
 * kept question is flagged with whether its source excerpt actually
 * appears in the theory text, a cheap hallucination signal for reviewers.
 */
export function parseGeneratedQuestions(raw: string, theoryBody: string): ParseResult {
  const parsed = extractJson(raw);
  const list = (parsed as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) throw new Error('"questions" array is missing');

  const source = normalize(theoryBody);
  const result: ParseResult = { questions: [], rejected: [] };

  list.forEach((item, index) => {
    const check = GeneratedQuestionSchema.safeParse(item);
    if (!check.success) {
      const issue = check.error.issues[0];
      result.rejected.push({ index, reason: `${issue.path.join('.') || 'question'}: ${issue.message}` });
      return;
    }
    const excerpt = normalize(check.data.source_excerpt);
    result.questions.push({
      ...check.data,
      excerpt_verified: excerpt.length > 0 && source.includes(excerpt),
    });
  });

  return result;
}
