import { describe, it, expect } from 'vitest';
import { buildMcqPrompt, extractJson, parseGeneratedQuestions } from '@/lib/mcq-generation';

const THEORY = 'Person-centred therapy holds that the counsellor must offer unconditional positive regard. Empathy is a core condition.';

const valid = {
  stem: 'Which condition is central to person-centred therapy?',
  options: ['Unconditional positive regard', 'Free association', 'Systematic desensitisation', 'Cognitive restructuring'],
  correct_index: 0,
  explanation: 'Rogers identified unconditional positive regard as a core condition.',
  difficulty: 2,
  bloom_level: 'understand',
  source_excerpt: 'the counsellor must offer   unconditional positive regard',
};

describe('extractJson', () => {
  it('parses plain, fenced, and prose-wrapped JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go: {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });

  it('throws when there is no JSON object', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('parseGeneratedQuestions', () => {
  it('accepts valid questions and verifies the excerpt against the source', () => {
    const { questions, rejected } = parseGeneratedQuestions(JSON.stringify({ questions: [valid] }), THEORY);
    expect(rejected).toEqual([]);
    expect(questions).toHaveLength(1);
    expect(questions[0].excerpt_verified).toBe(true);
  });

  it('flags excerpts that do not appear in the source text', () => {
    const fabricated = { ...valid, source_excerpt: 'Rogers founded the approach in 1902.' };
    const { questions } = parseGeneratedQuestions(JSON.stringify({ questions: [fabricated] }), THEORY);
    expect(questions[0].excerpt_verified).toBe(false);
  });

  it('drops malformed questions but keeps the rest of the batch', () => {
    const batch = [
      valid,
      { ...valid, options: ['A', 'B', 'C'] },
      { ...valid, correct_index: 4 },
      { ...valid, options: ['Same', 'same', 'Other', 'Another'] },
    ];
    const { questions, rejected } = parseGeneratedQuestions(JSON.stringify({ questions: batch }), THEORY);
    expect(questions).toHaveLength(1);
    expect(rejected.map((r) => r.index)).toEqual([1, 2, 3]);
  });

  it('coerces numeric strings and normalises bloom levels', () => {
    const loose = { ...valid, correct_index: '2', difficulty: '3', bloom_level: 'Analyze' };
    const { questions } = parseGeneratedQuestions(JSON.stringify({ questions: [loose] }), THEORY);
    expect(questions[0]).toMatchObject({ correct_index: 2, difficulty: 3, bloom_level: 'analyze' });
  });

  it('falls back to "understand" for unknown bloom levels', () => {
    const odd = { ...valid, bloom_level: 'memorise' };
    const { questions } = parseGeneratedQuestions(JSON.stringify({ questions: [odd] }), THEORY);
    expect(questions[0].bloom_level).toBe('understand');
  });

  it('throws when the questions array is missing', () => {
    expect(() => parseGeneratedQuestions('{"items":[]}', THEORY)).toThrow(/questions/);
  });
});

describe('buildMcqPrompt', () => {
  it('includes the requested count and truncates custom instructions', () => {
    const prompt = buildMcqPrompt({ theoryTitle: 'T', theoryBody: 'B', count: 4, customInstructions: 'x'.repeat(800) });
    expect(prompt).toContain('Generate exactly 4 Multiple Choice Questions');
    expect(prompt).toContain('x'.repeat(500));
    expect(prompt).not.toContain('x'.repeat(501));
  });
});
