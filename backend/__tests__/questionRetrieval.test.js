/**
 * Unit tests for Phase 2: Session config, patterns & question retrieval
 */

'use strict';

const { DSA_PATTERNS } = require('../config/patterns');
const { detectPatternsFromText } = require('../scripts/tagPatterns');
const {
  scoreQuestion,
  questionTopics,
} = require('../services/questionRetrieval');

describe('Phase 2: Patterns & Retrieval Configuration', () => {
  test('1. Canonical DSA patterns list contains expected 21 patterns', () => {
    expect(Array.isArray(DSA_PATTERNS)).toBe(true);
    expect(DSA_PATTERNS.length).toBe(21);
    expect(DSA_PATTERNS).toContain('two-pointers');
    expect(DSA_PATTERNS).toContain('sliding-window');
    expect(DSA_PATTERNS).toContain('tree-dfs');
    expect(DSA_PATTERNS).toContain('dp-1d');
    expect(DSA_PATTERNS).toContain('graph-bfs/dfs');
  });

  test('2. detectPatternsFromText detects patterns accurately from keywords', () => {
    const text1 = 'Find the longest substring without repeating characters using sliding window approach';
    const patterns1 = detectPatternsFromText(text1);
    expect(patterns1).toContain('sliding-window');

    const text2 = 'Traverse the binary tree using depth first search recursion';
    const patterns2 = detectPatternsFromText(text2);
    expect(patterns2).toContain('tree-dfs');

    const text3 = 'Two sum problem using two pointers on sorted array';
    const patterns3 = detectPatternsFromText(text3);
    expect(patterns3).toContain('two-pointers');
  });

  test('3. scoreQuestion awards pattern score bonus when requested pattern matches', () => {
    const questionWithPattern = {
      questionId: 'q-1',
      title: 'Valid Palindrome',
      questionText: 'Check if string is palindrome',
      topic: 'Strings',
      difficulty: 'easy',
      isCodingProblem: true,
      patterns: ['two-pointers'],
    };

    const questionWithoutPattern = {
      questionId: 'q-2',
      title: 'Valid Palindrome',
      questionText: 'Check if string is palindrome',
      topic: 'Strings',
      difficulty: 'easy',
      isCodingProblem: true,
      patterns: ['dp-1d'],
    };

    const context = {
      targetDifficulty: 'easy',
      seenKeys: new Set(),
      patterns: ['two-pointers'],
      preferredTopics: [],
      recentTopics: [],
    };

    const scoreWith = scoreQuestion(questionWithPattern, context);
    const scoreWithout = scoreQuestion(questionWithoutPattern, context);

    expect(scoreWith.patternScore).toBe(1);
    expect(scoreWithout.patternScore).toBe(0);
    expect(scoreWith.score).toBeGreaterThan(scoreWithout.score);
  });
});

