/**
 * Adaptive Interviewer Engine (Phase 3)
 *
 * Implements the real-time adaptive turn evaluation:
 * - STAR-probing for HR questions
 * - Multi-stage hint escalation for DSA questions
 * - Hard limit enforcement (max followups/hints per question)
 * - Dynamic difficulty adjustment (raise after 2 strong answers, lower after 2 weak ones)
 * - Concise, cost-aware LLM calls (at most 2 sentences response)
 */

const { z } = require('zod');
const llm = require('../llm');
const CodingProblemDetails = require('../../models/CodingProblemDetails');

const MAX_FOLLOWUPS = parseInt(process.env.MAX_FOLLOWUPS_PER_QUESTION || '2', 10);
const MAX_HINTS = parseInt(process.env.MAX_HINTS_PER_QUESTION || '2', 10);

const turnDecisionSchema = z.object({
  action: z.enum(['followup', 'hint', 'next', 'wrap_up']),
  message: z.string().min(1),
  score: z.number().int().min(1).max(10).nullable().optional(),
  signals: z.object({
    clarity: z.number().min(1).max(10).default(5),
    depth: z.number().min(1).max(10).default(5),
    correctness: z.number().min(1).max(10).default(5),
  }).default({ clarity: 5, depth: 5, correctness: 5 }),
});

/**
 * Computes updated difficulty and streak based on answer performance.
 * Rule:
 *   - Raise difficulty after 2 consecutive strong answers (score >= 7)
 *   - Lower difficulty after 2 consecutive weak answers (score <= 4)
 *   - Mid-range answers (5-6) reset streak
 *
 * @param {'easy'|'medium'|'hard'} currentDifficulty
 * @param {number} score 1-10
 * @param {number} currentStreak
 * @returns {{ newDifficulty: 'easy'|'medium'|'hard', newStreak: number }}
 */
function computeAdaptedDifficulty(currentDifficulty, score, currentStreak = 0) {
  const levels = ['easy', 'medium', 'hard'];
  let curIdx = levels.indexOf(currentDifficulty);
  if (curIdx === -1) curIdx = 0;

  let newStreak = currentStreak;

  if (typeof score !== 'number') {
    return { newDifficulty: currentDifficulty, newStreak };
  }

  if (score >= 7) {
    newStreak = newStreak > 0 ? newStreak + 1 : 1;
    if (newStreak >= 2) {
      curIdx = Math.min(levels.length - 1, curIdx + 1);
      newStreak = 0; // reset streak after level up
    }
  } else if (score <= 4) {
    newStreak = newStreak < 0 ? newStreak - 1 : -1;
    if (newStreak <= -2) {
      curIdx = Math.max(0, curIdx - 1);
      newStreak = 0; // reset streak after level down
    }
  } else {
    newStreak = 0; // neutral score resets streak
  }

  return {
    newDifficulty: levels[curIdx],
    newStreak,
  };
}

/**
 * Build system prompt based on mode and current question type.
 */
function buildSystemPrompt(mode, isCoding, limits) {
  let personaInstructions = '';

  if (isCoding) {
    personaInstructions = `You are a Principal Engineering bar raiser conducting a live technical DSA coding interview.
Stages: Clarify -> Approach & Complexity -> Code Implementation -> Test cases.
Rules for your reply:
1. NEVER reveal the code solution or direct answer.
2. If the candidate asks for a hint or is stuck, give a gentle nudge. There is a hard limit of 2 hints per question:
   - Hint 1: Nudge towards the overarching pattern or invariant (e.g. "Think about how sorting or two pointers could reduce the search space").
   - Hint 2: Specific data structure or algorithmic step (e.g. "Consider maintaining a monotonic stack or min-heap of size k").
3. COMPLEXITY CHECK: If the candidate has submitted working code or explained their approach, but hasn't explicitly analyzed complexity, your follow-up ('followup') SHOULD frequently ask:
   "What is the Time Complexity and Space Complexity of your solution, and could we optimize either?"
4. If their explanation, code, and complexity analysis are verified, transition cleanly to the next question ('next').
5. Your message MUST be at most 2 concise sentences spoken directly to the candidate.`;
  } else {
    personaInstructions = `You are an executive HR and behavioral interview coach evaluating in the STAR format (Situation, Task, Action, Result).
Rules for your reply:
1. Listen closely to whether the candidate covered: Situation, Task, Action, and specific measurable Result.
2. If any STAR component is missing (e.g. they described what the team did instead of their personal Action, or gave no Result), ask ONE targeted probing follow-up for that component ('followup').
3. If they have covered the STAR components thoroughly, acknowledge their answer and transition ('next').
4. Your message MUST be at most 2 concise sentences.`;
  }

  const limitsInstructions = `
Hard Constraints for this question:
- Follow-ups remaining for this question: ${limits.followupsRemaining} (Max ${MAX_FOLLOWUPS})
- Hints remaining for this question: ${limits.hintsRemaining} (Max ${MAX_HINTS})
- Is final question in interview: ${limits.isFinalQuestion ? 'YES' : 'NO'}

If follow-ups remaining is 0, DO NOT choose 'followup'.
If hints remaining is 0, DO NOT choose 'hint'.
If followups or hints are exhausted and candidate finished their attempt, choose ${limits.isFinalQuestion ? "'wrap_up'" : "'next'"}.

Respond ONLY with a JSON object matching this schema:
{
  "action": "followup" | "hint" | "next" | "wrap_up",
  "message": "<max 2 sentences spoken by interviewer>",
  "score": <integer 1-10 or null if turn is ongoing>,
  "signals": { "clarity": 1-10, "depth": 1-10, "correctness": 1-10 }
}`;

  return `${personaInstructions}\n${limitsInstructions}`;
}

/**
 * Prepare prompt context and limits for turn evaluation.
 */
async function prepareTurnContext({ interview, questionIndex, text, code, language, metrics }) {
  const questions = interview.questions || [];
  const currentQ = questions[questionIndex] || questions[questions.length - 1];
  const qId = currentQ?.questionId || null;

  const turns = Array.isArray(interview.turns) ? interview.turns : [];

  // Count existing followups and hints for current question
  const existingFollowups = turns.filter(
    (t) => t.speaker === 'ai' && t.type === 'followup' && (t.questionRef === qId || !t.questionRef)
  ).length;

  const existingHints = turns.filter(
    (t) => t.speaker === 'ai' && t.type === 'hint' && (t.questionRef === qId || !t.questionRef)
  ).length;

  const maxQuestions = interview.config?.maxQuestions || 5;
  const isFinalQuestion = questionIndex >= maxQuestions - 1;

  const limits = {
    followupsRemaining: Math.max(0, MAX_FOLLOWUPS - existingFollowups),
    hintsRemaining: Math.max(0, MAX_HINTS - existingHints),
    isFinalQuestion,
  };

  const isCoding = !!(currentQ?.isCodingProblem || currentQ?.questionText?.startsWith('[CODING_PROBLEM]'));
  const mode = interview.config?.mode || 'mixed';

  // Retrieve rubric if available
  let rubricText = '';
  if (currentQ?.rubricNotes && currentQ.rubricNotes.length > 0) {
    rubricText = `Rubric notes:\n${currentQ.rubricNotes.join('\n')}`;
  } else if (isCoding && qId) {
    try {
      const cp = await CodingProblemDetails.findOne({ questionId: qId }).lean();
      if (cp?.rubric?.length) {
        rubricText = `Rubric notes:\n${cp.rubric.join('; ')}`;
      }
    } catch (err) {
      // Non-fatal
    }
  }

  // Build compact history: rolling summary + last 4 turns
  const recentTurns = turns.slice(-4).map((t) => `${t.speaker.toUpperCase()}: ${t.text}`);
  const historyBlock = recentTurns.length > 0
    ? `Recent dialogue history:\n${recentTurns.join('\n')}\n`
    : '';

  const systemPrompt = buildSystemPrompt(mode, isCoding, limits);

  let candidateTurnContent = `Current Question: ${currentQ?.questionText || 'General interview question'}`;
  if (rubricText) candidateTurnContent += `\n\n${rubricText}`;
  if (historyBlock) candidateTurnContent += `\n\n${historyBlock}`;

  candidateTurnContent += `\n\nCandidate's newest response:
${text || ''}`;

  if (code) {
    candidateTurnContent += `\n\nCandidate's submitted code (${language || 'code'}):
\`\`\`${language || ''}
${code}
\`\`\``;
  }

  if (metrics && typeof metrics.wpm === 'number') {
    candidateTurnContent += `\n\nSpeaking telemetry: ${metrics.wpm} WPM, ${metrics.fillerWordsCount || 0} filler words.`;
  }

  candidateTurnContent += `\n\nEvaluate the response, decide the appropriate next action (followup, hint, next, or wrap_up), score (1-10), and provide a reply of at most 2 sentences.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: candidateTurnContent },
  ];

  const defaultAction = isFinalQuestion ? 'wrap_up' : 'next';
  const safeDefault = {
    action: defaultAction,
    message: isFinalQuestion
      ? "Thank you for sharing. We have reached the end of the questions for this interview session."
      : "Thank you for that response. Let's move on to the next question.",
    score: 6,
    signals: { clarity: 6, depth: 6, correctness: 6 },
  };

  return {
    messages,
    limits,
    isFinalQuestion,
    defaultAction,
    safeDefault,
  };
}

/**
 * Enforce turn limits and override invalid actions.
 */
function enforceTurnLimits(decision, limits, isFinalQuestion, defaultAction) {
  const result = { ...decision };
  if (result.action === 'followup' && limits.followupsRemaining <= 0) {
    result.action = defaultAction;
    result.message = isFinalQuestion
      ? "That concludes our discussion on this topic. Let's wrap up our session."
      : "Good. Let's move on to the next question.";
  } else if (result.action === 'hint' && limits.hintsRemaining <= 0) {
    result.action = defaultAction;
    result.message = isFinalQuestion
      ? "We have covered what we can here. Let's wrap up the session."
      : "Understood. Let's move on to the next question.";
  }
  return result;
}

/**
 * Extract streaming delta belonging to the JSON "message" property.
 */
function extractMessageDelta(fullText, alreadyExtractedLen) {
  const match = fullText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return { newDelta: '', newExtractedLen: alreadyExtractedLen };
  let currentVal = '';
  try {
    currentVal = JSON.parse(`"${match[1]}"`);
  } catch {
    currentVal = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }
  if (currentVal.length > alreadyExtractedLen) {
    const newDelta = currentVal.slice(alreadyExtractedLen);
    return { newDelta, newExtractedLen: currentVal.length };
  }
  return { newDelta: '', newExtractedLen: alreadyExtractedLen };
}

/**
 * Evaluate an adaptive candidate turn.
 *
 * @param {object} opts
 * @param {object} opts.interview
 * @param {number} opts.questionIndex
 * @param {string} opts.text
 * @param {string} [opts.code]
 * @param {string} [opts.language]
 * @param {object} [opts.metrics]
 * @returns {Promise<object>} Parsed decision
 */
async function evaluateTurn(opts = {}) {
  const { messages, limits, isFinalQuestion, defaultAction, safeDefault } = await prepareTurnContext(opts);

  const decision = await llm.generate({
    task: 'fast',
    messages,
    json: true,
    schema: turnDecisionSchema,
    safeDefault,
    maxTokens: 250,
  });

  return enforceTurnLimits(decision, limits, isFinalQuestion, defaultAction);
}

/**
 * Evaluate an adaptive candidate turn with token-by-token streaming.
 *
 * @param {object} opts
 * @param {function} opts.onToken Callback for message token deltas
 * @returns {Promise<object>} Final parsed decision
 */
async function evaluateTurnStream(opts = {}) {
  const { onToken, ...rest } = opts;
  const { messages, limits, isFinalQuestion, defaultAction, safeDefault } = await prepareTurnContext(rest);

  let fullText = '';
  let extractedLen = 0;

  try {
    for await (const chunk of llm.stream({ task: 'fast', messages, json: true, maxTokens: 250 })) {
      fullText += chunk;
      if (typeof onToken === 'function') {
        const { newDelta, newExtractedLen } = extractMessageDelta(fullText, extractedLen);
        if (newDelta) {
          extractedLen = newExtractedLen;
          onToken(newDelta);
        }
      }
    }
  } catch (err) {
    console.warn('[adaptiveEngine] Streaming error; will evaluate fallback:', err.message);
  }

  let decision = null;
  if (fullText) {
    try {
      decision = turnDecisionSchema.parse(JSON.parse(fullText));
    } catch {
      try {
        const repaired = await llm.generate({
          task: 'fast',
          messages: [{ role: 'user', content: `The following is broken JSON. Return ONLY valid JSON:\n${fullText}` }],
          json: true,
          schema: turnDecisionSchema,
          safeDefault,
        });
        decision = repaired;
      } catch {
        decision = safeDefault;
      }
    }
  } else {
    decision = await llm.generate({
      task: 'fast',
      messages,
      json: true,
      schema: turnDecisionSchema,
      safeDefault,
      maxTokens: 250,
    });
  }

  if (extractedLen === 0 && typeof onToken === 'function' && decision?.message) {
    onToken(decision.message);
  }

  return enforceTurnLimits(decision, limits, isFinalQuestion, defaultAction);
}

module.exports = {
  evaluateTurn,
  evaluateTurnStream,
  computeAdaptedDifficulty,
  MAX_FOLLOWUPS,
  MAX_HINTS,
};

