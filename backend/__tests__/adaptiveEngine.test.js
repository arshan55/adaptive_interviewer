/**
 * Unit tests for Phase 3: Adaptive Interviewer Engine & Reporting
 */

'use strict';

const {
  computeAdaptedDifficulty,
  MAX_FOLLOWUPS,
  MAX_HINTS,
} = require('../services/interviewer/adaptiveEngine');
const { computeCommunicationStats } = require('../services/interviewer/reportGenerator');

describe('Phase 3: Adaptive Interviewer Loop', () => {
  describe('Dynamic Difficulty Adaptation', () => {
    test('1. Increases difficulty from easy to medium after two strong answers', () => {
      // First strong answer (score 8)
      const first = computeAdaptedDifficulty('easy', 8, 0);
      expect(first.newDifficulty).toBe('easy');
      expect(first.newStreak).toBe(1);

      // Second strong answer (score 9)
      const second = computeAdaptedDifficulty(first.newDifficulty, 9, first.newStreak);
      expect(second.newDifficulty).toBe('medium');
      expect(second.newStreak).toBe(0); // streak reset on level up
    });

    test('2. Increases difficulty from medium to hard after two more strong answers', () => {
      const first = computeAdaptedDifficulty('medium', 7, 0);
      expect(first.newStreak).toBe(1);

      const second = computeAdaptedDifficulty('medium', 8, first.newStreak);
      expect(second.newDifficulty).toBe('hard');
      expect(second.newStreak).toBe(0);
    });

    test('3. Lowers difficulty from hard to medium after two weak answers', () => {
      // First weak answer (score 3)
      const first = computeAdaptedDifficulty('hard', 3, 0);
      expect(first.newDifficulty).toBe('hard');
      expect(first.newStreak).toBe(-1);

      // Second weak answer (score 4)
      const second = computeAdaptedDifficulty(first.newDifficulty, 4, first.newStreak);
      expect(second.newDifficulty).toBe('medium');
      expect(second.newStreak).toBe(0);
    });

    test('4. Neutral score (5 or 6) resets the streak without changing difficulty', () => {
      const step1 = computeAdaptedDifficulty('medium', 8, 0);
      expect(step1.newStreak).toBe(1);

      // Neutral answer
      const step2 = computeAdaptedDifficulty(step1.newDifficulty, 6, step1.newStreak);
      expect(step2.newDifficulty).toBe('medium');
      expect(step2.newStreak).toBe(0);
    });

    test('5. Difficulty does not decrease below easy or exceed hard', () => {
      const atEasy = computeAdaptedDifficulty('easy', 2, -2);
      expect(atEasy.newDifficulty).toBe('easy');

      const atHard = computeAdaptedDifficulty('hard', 10, 2);
      expect(atHard.newDifficulty).toBe('hard');
    });
  });

  describe('Communication Telemetry Aggregation', () => {
    test('6. Computes average WPM and total filler words accurately', () => {
      const turns = [
        { speaker: 'ai', text: 'Tell me about yourself.' },
        {
          speaker: 'candidate',
          text: 'I am a backend engineer...',
          metrics: { wpm: 120, fillerWordsCount: 2 },
        },
        { speaker: 'ai', text: 'Can you elaborate on your action?' },
        {
          speaker: 'candidate',
          text: 'I migrated our database...',
          metrics: { wpm: 140, fillerWordsCount: 3 },
        },
      ];

      const stats = computeCommunicationStats(turns);
      expect(stats.averageWpm).toBe(130);
      expect(stats.totalFillerWords).toBe(5);
      expect(stats.paceAssessment).toContain('Optimal');
    });

    test('7. Detects fast pace when average WPM exceeds threshold', () => {
      const turns = [
        {
          speaker: 'candidate',
          text: 'Rapid explanation...',
          metrics: { wpm: 190, fillerWordsCount: 1 },
        },
      ];

      const stats = computeCommunicationStats(turns);
      expect(stats.averageWpm).toBe(190);
      expect(stats.paceAssessment).toContain('Fast pace');
    });
  });
});

