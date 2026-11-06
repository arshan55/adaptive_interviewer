/**
 * Unit tests for Phase 4: Code Execution & Weighted Scoring Formula
 */

'use strict';

const { calculateWeightedCodeScore } = require('../services/prompts/codeAnswer');
const codeRunner = require('../services/codeRunner');

describe('Phase 4: Code Execution & Scoring', () => {
  describe('calculateWeightedCodeScore formula', () => {
    test('1. Full test pass rate (1.0) with strong LLM review yields high score', () => {
      // 1.0 * 7 + 10 * 0.3 = 7 + 3 = 10
      const score1 = calculateWeightedCodeScore(1.0, 10);
      expect(score1).toBe(10);

      // 1.0 * 7 + 7 * 0.3 = 7 + 2.1 = 9.1 -> 9
      const score2 = calculateWeightedCodeScore(1.0, 7);
      expect(score2).toBe(9);
    });

    test('2. Partial test pass rate (0.5) scales proportionally', () => {
      // 0.5 * 7 + 8 * 0.3 = 3.5 + 2.4 = 5.9 -> 6
      const score = calculateWeightedCodeScore(0.5, 8);
      expect(score).toBe(6);
    });

    test('3. Zero pass rate (0.0) is capped at max 3 regardless of LLM score', () => {
      // Even if LLM erroneously thought code looked great (10), 0 passing tests caps score at 3
      const score = calculateWeightedCodeScore(0.0, 10);
      expect(score).toBeLessThanOrEqual(3);

      const scoreLow = calculateWeightedCodeScore(0.0, 3);
      expect(scoreLow).toBeLessThanOrEqual(3);
    });

    test('4. Gracefully falls back to LLM score when passRate is null/untested', () => {
      const score = calculateWeightedCodeScore(null, 7);
      expect(score).toBe(7);

      const scoreNan = calculateWeightedCodeScore(NaN, 8);
      expect(scoreNan).toBe(8);
    });

    test('5. Output is strictly clamped between 1 and 10', () => {
      expect(calculateWeightedCodeScore(-1, 0)).toBe(1);
      expect(calculateWeightedCodeScore(2.0, 15)).toBe(10);
    });
  });

  describe('Server-Side Code Runner Guardrails', () => {
    test('6. codeRunner.isAvailable() returns false when CODE_RUNNER_URL is not set', () => {
      delete process.env.CODE_RUNNER_URL;
      expect(codeRunner.isAvailable()).toBe(false);
    });

    test('7. codeRunner.execute() rejects safely when runner is disabled', async () => {
      delete process.env.CODE_RUNNER_URL;
      await expect(
        codeRunner.execute({ language: 'cpp', code: 'int main() {}' })
      ).rejects.toThrow(/Server-side code runner is disabled/i);
    });
  });
});

