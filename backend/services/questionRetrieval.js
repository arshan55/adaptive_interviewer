const QuestionBank = require('../models/QuestionBank');

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
const ACCEPTANCE_TARGETS = {
  easy: 0.72,
  medium: 0.56,
  hard: 0.38,
};

const SCORE_WEIGHTS = {
  difficulty: 3,
  topics: 3,
  company: 2,
  frequency: 1.5,
  acceptance: 1.25,
  pattern: 2.5,
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const splitTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  return String(value || '')
    .split(/,|\|/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const MIXED_QUESTION_TYPES = ['dsa', 'fundamentals', 'behavioral'];

const classifyQuestion = (question) => {
  if (question?.isCodingProblem === true || /^\s*\[CODING_PROBLEM\]/i.test(question?.questionText || '')) {
    return 'dsa';
  }

  const tags = splitTags(question?.tags);
  const topic = normalizeText(question?.topic);
  const source = normalizeText(question?.sourceSystem);
  if (
    tags.includes('behavioral') ||
    tags.includes('hr') ||
    topic.startsWith('behavioral') ||
    source.includes('behavioral') ||
    (Array.isArray(question?.rubricNotes) && question.rubricNotes.length > 0)
  ) {
    return 'behavioral';
  }

  return 'fundamentals';
};

const questionIdentityKeys = (question) => unique([
  normalizeText(question.questionId),
  normalizeText(question.link),
  normalizeText(question.normalizedTitle),
  normalizeText(question.title),
  normalizeText(question.questionText),
]);

const questionTopics = (question) => unique([
  ...splitTags(question.tags),
  ...splitTags(question.topic),
]);

const jaccardScore = (left, right) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (!leftSet.size || !rightSet.size) {
    return 0;
  }

  let intersection = 0;
  leftSet.forEach((item) => {
    if (rightSet.has(item)) intersection += 1;
  });

  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
};

const acceptanceTargetForDifficulty = (difficulty) => ACCEPTANCE_TARGETS[difficulty] || 0.55;

const adjacentDifficultyScore = (candidateDifficulty, targetDifficulty) => {
  const targetIndex = DIFFICULTY_ORDER.indexOf(targetDifficulty);
  const candidateIndex = DIFFICULTY_ORDER.indexOf(candidateDifficulty);

  if (targetIndex === -1 || candidateIndex === -1) {
    return 0;
  }

  const distance = Math.abs(candidateIndex - targetIndex);
  if (distance === 0) return 1;
  if (distance === 1) return 0.55;
  return 0.15;
};

const scoreQuestion = (question, context) => {
  const topicSet = questionTopics(question);
  const preferredTopics = unique([
    ...splitTags(context.preferredTopics),
    ...splitTags(context.recentTopics),
  ]);
  const recentTopics = unique(splitTags(context.recentTopics));

  const topicOverlap = jaccardScore(topicSet, preferredTopics);
  const recentOverlap = jaccardScore(topicSet, recentTopics);

  const difficultyScore = adjacentDifficultyScore(question.difficulty, context.targetDifficulty);
  const companyScore = context.company && normalizeText(question.company) === normalizeText(context.company) ? 1 : 0;
  const frequencyScore = question.frequency ? Math.min(Math.log10(question.frequency + 1) / 2, 1) : 0;

  const acceptanceRate = typeof question.acceptanceRate === 'number' ? question.acceptanceRate : null;
  const acceptanceTarget = acceptanceTargetForDifficulty(context.targetDifficulty);
  const acceptanceScore = acceptanceRate === null
    ? 0
    : Math.max(0, 1 - Math.abs(acceptanceRate - acceptanceTarget));

  const repetitionPenalty = recentOverlap > 0.5 ? 1.5 : recentOverlap * 0.75;
  const duplicatePenalty = questionIdentityKeys(question).some((key) => context.seenKeys.has(key)) ? 6 : 0;

  // Phase 2: Pattern match score bonus when candidate requests specific DSA patterns
  let patternScore = 0;
  if (Array.isArray(context.patterns) && context.patterns.length > 0) {
    const qPatterns = Array.isArray(question.patterns) ? question.patterns : [];
    const hasPatternMatch = qPatterns.some((p) => context.patterns.includes(p));
    patternScore = hasPatternMatch ? 1 : 0;
  }

  const score = (
    (difficultyScore * SCORE_WEIGHTS.difficulty) +
    (topicOverlap * SCORE_WEIGHTS.topics) +
    (companyScore * SCORE_WEIGHTS.company) +
    (frequencyScore * SCORE_WEIGHTS.frequency) +
    (acceptanceScore * SCORE_WEIGHTS.acceptance) +
    (patternScore * SCORE_WEIGHTS.pattern) -
    repetitionPenalty -
    duplicatePenalty
  );

  return {
    score,
    topicOverlap,
    recentOverlap,
    companyScore,
    frequencyScore,
    acceptanceScore,
    patternScore,
    duplicatePenalty,
  };
};

const buildCandidateQuery = (context, loosenDifficulty = false, role = context.role, loosenPatterns = false, loosenCompany = false) => {
  const query = {
    role,
  };

  if (!loosenDifficulty && context.targetDifficulty) {
    query.difficulty = context.targetDifficulty;
  }

  if (context.company && !loosenCompany) {
    query.company = context.company;
  }

  // Phase 2: Mode filter (hr / dsa / mixed)
  if (context.mode === 'hr') {
    query.isCodingProblem = false;
  } else if (context.mode === 'dsa') {
    query.isCodingProblem = true;
  } else if (context.mode === 'mixed' && context.preferredCategory) {
    query.isCodingProblem = context.preferredCategory === 'dsa';
  } else if (context.mode === 'mixed' && typeof context.preferCoding === 'boolean') {
    query.isCodingProblem = context.preferCoding;
  }

  // Phase 2: Pattern filter
  if (!loosenPatterns && Array.isArray(context.patterns) && context.patterns.length > 0) {
    query.patterns = { $in: context.patterns };
  }

  return query;
};

const loadAndScoreCandidates = async (context, loosenDifficulty = false, loosenPatterns = false, loosenCompany = false) => {
  const roleCandidates = context.role === 'software-engineer'
    ? ['software-engineer']
    : [context.role, 'software-engineer'];

  const candidateGroups = await Promise.all(
    roleCandidates.map((role) =>
      QuestionBank.find(buildCandidateQuery(context, loosenDifficulty, role, loosenPatterns, loosenCompany)).lean()
    )
  );

  return candidateGroups
    .flat()
    .filter((question) => {
      if (context.mode === 'mixed' && context.preferredCategory && classifyQuestion(question) !== context.preferredCategory) {
        return false;
      }
      const identityKeys = questionIdentityKeys(question);
      return !identityKeys.some((key) => context.seenKeys.has(key));
    })
    .map((question) => ({
      question,
      metrics: scoreQuestion(question, {
        ...context,
        targetDifficulty: loosenDifficulty ? question.difficulty : context.targetDifficulty,
      }),
    }))
    .sort((left, right) => {
      if (right.metrics.score !== left.metrics.score) {
        return right.metrics.score - left.metrics.score;
      }

      if ((right.question.frequency || 0) !== (left.question.frequency || 0)) {
        return (right.question.frequency || 0) - (left.question.frequency || 0);
      }

      if ((right.metrics.acceptanceScore || 0) !== (left.metrics.acceptanceScore || 0)) {
        return (right.metrics.acceptanceScore || 0) - (left.metrics.acceptanceScore || 0);
      }

      return String(left.question.title || left.question.questionText || '').localeCompare(
        String(right.question.title || right.question.questionText || '')
      );
    });
};

const selectBestQuestion = async (context) => {
  // 1. Try exact difficulty & pattern filters
  const scored = await loadAndScoreCandidates(context, false, false);
  if (scored.length > 0) {
    return scored[0].question;
  }

  // 2. Fallback: loosen difficulty
  const fallbackScored = await loadAndScoreCandidates(context, true, false);
  if (fallbackScored.length > 0) {
    return fallbackScored[0].question;
  }

  // 3. Fallback: loosen patterns if specified
  if (Array.isArray(context.patterns) && context.patterns.length > 0) {
    const loosenPatternsScored = await loadAndScoreCandidates(context, true, true);
    if (loosenPatternsScored.length > 0) {
      return loosenPatternsScored[0].question;
    }
  }

  // Some existing QuestionBank records predate pattern tagging. For DSA
  // sessions, still return a coding question when pattern metadata is absent.
  if (context.mode === 'dsa') {
    const untaggedDsa = await loadAndScoreCandidates({ ...context, patterns: [] }, true, true, true);
    if (untaggedDsa.length > 0) return untaggedDsa[0].question;
  }

  // A company is a preference, not a hard requirement. If no matching DSA
  // problem exists for that company, keep DSA mode and use a role question.
  if (context.company) {
    const withoutCompany = await loadAndScoreCandidates(
      { ...context, patterns: [] }, true, true, true
    );
    if (withoutCompany.length > 0) return withoutCompany[0].question;
  }

  // Mixed interviews target a one-third rotation. If a category is empty for
  // this role/company, fill the slot from the next available category.
  if (context.mode === 'mixed' && context.preferredCategory) {
    const startIndex = MIXED_QUESTION_TYPES.indexOf(context.preferredCategory);
    const alternatives = [1, 2]
      .map((offset) => MIXED_QUESTION_TYPES[(startIndex + offset) % MIXED_QUESTION_TYPES.length]);

    for (const preferredCategory of alternatives) {
      const fallback = await loadAndScoreCandidates(
        { ...context, preferredCategory, patterns: [] },
        true,
        true,
        true
      );
      if (fallback.length > 0) return fallback[0].question;
    }
  }

  // Mixed interviews should prefer the requested side of the rotation, but
  // never fail when that side is exhausted in the question bank.
  if (context.mode === 'mixed' && typeof context.preferCoding === 'boolean') {
    return selectBestQuestion({ ...context, preferCoding: undefined });
  }

  // Keep a configured interview alive when the user has exhausted unique
  // matches. Reusing the best available question is preferable to ending the
  // interview early with a partial report.
  if (context.maxQuestions > 0) {
    const reusable = await loadAndScoreCandidates(
      { ...context, seenKeys: new Set(), preferCoding: undefined },
      true,
      true
    );
    if (reusable.length > 0) return reusable[0].question;
  }

  return null;
};

module.exports = {
  normalizeText,
  splitTags,
  classifyQuestion,
  questionIdentityKeys,
  questionTopics,
  scoreQuestion,
  selectBestQuestion,
};
