/**
 * Unit tests for Phase 5: Streaming Turns & Real-time Communication
 */

'use strict';

const { evaluateTurnStream } = require('../services/interviewer/adaptiveEngine');
const llm = require('../services/llm');

jest.mock('../services/llm');
jest.mock('../models/CodingProblemDetails', () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(null),
  }),
}));

describe('Phase 5: Streaming & Real-Time Turns', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('1. evaluateTurnStream streams message deltas via onToken callback', async () => {
    // Mock llm.stream to yield chunks of a JSON response
    async function* mockStream() {
      yield '{"action": "followup", ';
      yield '"message": "Can you explain ';
      yield 'how you handled ';
      yield 'the edge cases?", ';
      yield '"score": 7, ';
      yield '"signals": {"clarity": 7, "depth": 7, "correctness": 8}}';
    }

    llm.stream.mockImplementation(mockStream);

    const interview = {
      role: 'Software Engineer',
      questions: [{ questionId: 'q1', questionText: 'Describe a difficult bug you solved.' }],
      turns: [],
      config: { mode: 'hr', maxQuestions: 5 },
    };

    const tokensReceived = [];
    const decision = await evaluateTurnStream({
      interview,
      questionIndex: 0,
      text: 'I had a race condition in our distributed cache.',
      onToken: (delta) => tokensReceived.push(delta),
    });

    expect(decision.action).toBe('followup');
    expect(decision.score).toBe(7);
    expect(decision.message).toBe('Can you explain how you handled the edge cases?');

    const concatenatedTokens = tokensReceived.join('');
    expect(concatenatedTokens).toBe('Can you explain how you handled the edge cases?');
  });

  test('2. Streams correctly when message property comes first in JSON', async () => {
    async function* mockStream() {
      yield '{"message": "Nice approach. ';
      yield 'What is the time complexity?", ';
      yield '"action": "hint", "score": 8}';
    }

    llm.stream.mockImplementation(mockStream);

    const interview = {
      role: 'Full Stack Engineer',
      questions: [{ questionId: 'q2', questionText: 'Two Sum', isCodingProblem: true }],
      turns: [],
      config: { mode: 'dsa', maxQuestions: 5 },
    };

    const tokens = [];
    const decision = await evaluateTurnStream({
      interview,
      questionIndex: 0,
      text: 'I used a hash map to look up complements in O(1).',
      onToken: (delta) => tokens.push(delta),
    });

    expect(decision.action).toBe('hint');
    expect(decision.message).toBe('Nice approach. What is the time complexity?');
    expect(tokens.join('')).toBe('Nice approach. What is the time complexity?');
  });

  test('3. Falls back gracefully when streaming encounters an error', async () => {
    llm.stream.mockImplementation(async function* () {
      throw new Error('Connection reset mid-stream');
    });

    llm.generate.mockResolvedValueOnce({
      action: 'next',
      message: 'Understood. Moving on to the next question.',
      score: 6,
      signals: { clarity: 6, depth: 6, correctness: 6 },
    });

    const interview = {
      role: 'Backend Engineer',
      questions: [{ questionId: 'q3', questionText: 'Explain database indexing.' }],
      turns: [],
      config: { mode: 'mixed', maxQuestions: 3 },
    };

    const tokens = [];
    const decision = await evaluateTurnStream({
      interview,
      questionIndex: 0,
      text: 'Indexes use B-trees to provide fast lookups.',
      onToken: (delta) => tokens.push(delta),
    });

    expect(decision.action).toBe('next');
    expect(decision.message).toContain('Moving on to the next question');
    // Whole message emitted to ensure client voice synthesis receives it
    expect(tokens.join('')).toBe('Understood. Moving on to the next question.');
  });

  test('4. Enforces limit overrides in streaming mode when followups are exhausted', async () => {
    async function* mockStream() {
      yield '{"action": "followup", "message": "Can you elaborate further?", "score": 6}';
    }

    llm.stream.mockImplementation(mockStream);

    // Interview where 2 follow-ups have already been used for this question
    const interview = {
      role: 'HR Manager',
      questions: [{ questionId: 'q4', questionText: 'Tell me about a leadership failure.' }],
      turns: [
        { speaker: 'ai', type: 'followup', questionRef: 'q4', text: 'Followup 1' },
        { speaker: 'ai', type: 'followup', questionRef: 'q4', text: 'Followup 2' },
      ],
      config: { mode: 'hr', maxQuestions: 5 },
    };

    const decision = await evaluateTurnStream({
      interview,
      questionIndex: 0,
      text: 'I communicated with stakeholders.',
      onToken: () => {},
    });

    // Action should be overridden from followup to next because max followups reached
    expect(decision.action).toBe('next');
    expect(decision.message).toContain("move on to the next question");
  });
});
