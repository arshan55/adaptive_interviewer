/**
 * Unit tests for backend/services/llm/index.js
 *
 * Tests:
 * 1. When Groq is first and succeeds, Gemini is never called.
 * 2. When Groq returns 429, Gemini is called as fallback.
 * 3. When both providers fail, generate() returns the safe default.
 * 4. Invalid JSON → one repair attempt → on second failure, safe default.
 * 5. When a provider call exceeds LLM_TIMEOUT_MS, it's treated as failure and fallback is tried.
 */

'use strict';

// --- Mocks must be set up before require() ---
const mockGroqGenerate = jest.fn();
const mockGeminiGenerate = jest.fn();

jest.mock('../services/llm/providers/groq', () => ({
  name: 'groq',
  generate: mockGroqGenerate,
}));

jest.mock('../services/llm/providers/gemini', () => ({
  name: 'gemini',
  generate: mockGeminiGenerate,
}));

// Set env before loading the module
process.env.LLM_PROVIDER_ORDER = 'groq,gemini';
process.env.LLM_TIMEOUT_MS = '5000';
process.env.GROQ_API_KEY = 'test-key';
process.env.GOOGLE_AI_API_KEY = 'test-key';

const { generate } = require('../services/llm/index');
const { feedbackSchema, SAFE_FEEDBACK_DEFAULT } = require('../services/llm/schemas/feedbackSchema');

const VALID_FEEDBACK = JSON.stringify({
  score: 7,
  feedback: 'Good answer.',
  improvements: ['Be more concise.'],
});

const MESSAGES = [{ role: 'user', content: 'Test question' }];

describe('LLM provider layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Groq succeeds → Gemini never called
  // ---------------------------------------------------------------------------
  test('1. When Groq succeeds, Gemini is never called', async () => {
    mockGroqGenerate.mockResolvedValueOnce(VALID_FEEDBACK);

    const result = await generate({
      task: 'fast',
      messages: MESSAGES,
      json: true,
      schema: feedbackSchema,
      safeDefault: SAFE_FEEDBACK_DEFAULT,
    });

    expect(mockGroqGenerate).toHaveBeenCalledTimes(1);
    expect(mockGeminiGenerate).not.toHaveBeenCalled();
    expect(result.score).toBe(7);
    expect(result.feedback).toBe('Good answer.');
  });

  // ---------------------------------------------------------------------------
  // Test 2: Groq 429 → Gemini called as fallback
  // ---------------------------------------------------------------------------
  test('2. When Groq returns 429, Gemini is called as fallback', async () => {
    const rateLimitErr = new Error('Rate limit: 429 too many requests');
    rateLimitErr.status = 429;
    mockGroqGenerate.mockRejectedValueOnce(rateLimitErr);
    mockGeminiGenerate.mockResolvedValueOnce(VALID_FEEDBACK);

    const result = await generate({
      task: 'fast',
      messages: MESSAGES,
      json: true,
      schema: feedbackSchema,
      safeDefault: SAFE_FEEDBACK_DEFAULT,
    });

    expect(mockGroqGenerate).toHaveBeenCalledTimes(1);
    expect(mockGeminiGenerate).toHaveBeenCalledTimes(1);
    expect(result.score).toBe(7);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Both providers fail → safe default returned
  // ---------------------------------------------------------------------------
  test('3. When both providers fail, safe default is returned', async () => {
    mockGroqGenerate.mockRejectedValue(new Error('Groq down'));
    mockGeminiGenerate.mockRejectedValue(new Error('Gemini down'));

    const result = await generate({
      task: 'fast',
      messages: MESSAGES,
      json: true,
      schema: feedbackSchema,
      safeDefault: SAFE_FEEDBACK_DEFAULT,
    });

    expect(result).toEqual(SAFE_FEEDBACK_DEFAULT);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Invalid JSON → repair attempted once → safe default on second failure
  // ---------------------------------------------------------------------------
  test('4. Invalid JSON → one repair attempt → safe default on total failure', async () => {
    // First call: returns broken JSON
    mockGroqGenerate
      .mockResolvedValueOnce('{ broken json }')   // initial call
      .mockRejectedValueOnce(new Error('repair failed')); // repair retry
    mockGeminiGenerate.mockResolvedValueOnce('{ also broken }'); // gemini fallback also invalid

    const result = await generate({
      task: 'fast',
      messages: MESSAGES,
      json: true,
      schema: feedbackSchema,
      safeDefault: SAFE_FEEDBACK_DEFAULT,
    });

    // After all failures: safe default
    expect(result).toEqual(SAFE_FEEDBACK_DEFAULT);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Provider times out → treated as failure, fallback tried
  // ---------------------------------------------------------------------------
  test('5. When Groq times out, Gemini fallback is tried', async () => {
    // Simulate a timeout: use a promise that never resolves, with a very short
    // LLM_TIMEOUT_MS override for this test
    process.env.LLM_TIMEOUT_MS = '50';

    mockGroqGenerate.mockReturnValueOnce(
      new Promise((resolve) => setTimeout(resolve, 2000)) // longer than 50ms timeout
    );
    mockGeminiGenerate.mockResolvedValueOnce(VALID_FEEDBACK);

    const result = await generate({
      task: 'fast',
      messages: MESSAGES,
      json: true,
      schema: feedbackSchema,
      safeDefault: SAFE_FEEDBACK_DEFAULT,
    });

    expect(mockGeminiGenerate).toHaveBeenCalledTimes(1);
    expect(result.score).toBe(7);

    // Restore
    process.env.LLM_TIMEOUT_MS = '5000';
  }, 10000);
});

