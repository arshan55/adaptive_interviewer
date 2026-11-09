/**
 * Background Report Generator (Phase 3)
 *
 * Compiles a comprehensive post-interview assessment report:
 * - Overall performance & score
 * - Strengths & weaknesses
 * - Per-question breakdown
 * - Communication analysis (average WPM, filler word density, pace)
 * - Pattern-wise performance (DSA)
 * - 3 concrete next-practice recommendations
 *
 * Implements an in-process async worker interface (can be backed by BullMQ in future).
 */

const { z } = require('zod');
const Interview = require('../../models/Interview');
const llm = require('../llm');

const reportSchema = z.object({
  overallScore: z.number().int().min(1).max(10),
  summary: z.string().min(1),
  strengths: z.array(z.string()).min(2).max(6),
  weaknesses: z.array(z.string()).min(1).max(6),
  perQuestionBreakdown: z.array(
    z.object({
      questionText: z.string(),
      candidateAnswer: z.string().nullable().optional().default(null),
      topic: z.string().default('General'),
      score: z.number().int().min(1).max(10),
      feedback: z.string(),
      signals: z.object({
        clarity: z.number().min(1).max(10).default(5),
        depth: z.number().min(1).max(10).default(5),
        correctness: z.number().min(1).max(10).default(5),
      }).default({ clarity: 5, depth: 5, correctness: 5 }),
    })
  ).default([]),
  communicationSummary: z.object({
    averageWpm: z.number().default(0),
    totalFillerWords: z.number().default(0),
    paceAssessment: z.string().default('Normal pace'),
    notes: z.string().default('Good clarity and professional delivery.'),
  }).default({
    averageWpm: 0,
    totalFillerWords: 0,
    paceAssessment: 'Normal pace',
    notes: 'Good clarity.',
  }),
  patternPerformance: z.array(
    z.object({
      pattern: z.string(),
      score: z.number().int().min(1).max(10),
      notes: z.string(),
    })
  ).default([]),
  nextPracticeRecommendations: z.array(z.string()).min(1).max(5),
});

/**
 * Computes communication stats across candidate turns.
 */
function computeCommunicationStats(turns = []) {
  const candidateTurns = turns.filter((t) => t.speaker === 'candidate' && t.metrics);
  const wpmEntries = candidateTurns
    .map((t) => t.metrics.wpm)
    .filter((w) => typeof w === 'number' && w > 0);

  const averageWpm = wpmEntries.length > 0
    ? Math.round(wpmEntries.reduce((a, b) => a + b, 0) / wpmEntries.length)
    : 0;

  const totalFillerWords = candidateTurns
    .map((t) => t.metrics.fillerWordsCount || 0)
    .reduce((a, b) => a + b, 0);

  let paceAssessment = wpmEntries.length > 0 ? 'Optimal speaking cadence' : 'No speech cadence data captured';
  if (averageWpm > 175) paceAssessment = 'Fast pace — could slow down for clarity';
  else if (wpmEntries.length > 0 && averageWpm < 100) paceAssessment = 'Deliberate / slightly slow pace';

  return { averageWpm, totalFillerWords, paceAssessment };
}

const compactText = (value, limit = 1200) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
};

const getQuestionScore = (question) => {
  if (typeof question.codeScore === 'number') return question.codeScore;
  if (typeof question.score === 'number') return question.score;
  const signals = question.signals || {};
  if ([signals.correctness, signals.depth, signals.clarity].every((value) => typeof value === 'number')) {
    return Math.round((signals.correctness * 0.45) + (signals.depth * 0.35) + (signals.clarity * 0.2));
  }
  return null;
};

const getQuestionAnswer = (question) => {
  if (question.codeAnswer) return `[Submitted code]\n${compactText(question.codeAnswer, 1800)}`;
  return compactText(question.answerText, 1800) || 'No answer was recorded.';
};

/** Build a specific, evidence-based report when no LLM provider responds. */
function buildFallbackReport(interview, commStats) {
  const allQuestions = interview.questions || [];
  const answeredQuestions = allQuestions.filter((question) => question.answerText || question.codeAnswer);
  const questions = answeredQuestions.length > 0 ? answeredQuestions : allQuestions;
  const scored = questions.map((question) => ({ question, score: getQuestionScore(question) }));
  const scoredQuestions = scored.filter((entry) => entry.score != null);
  const overallScore = scoredQuestions.length > 0
    ? Math.round(scoredQuestions.reduce((sum, entry) => sum + entry.score, 0) / scoredQuestions.length)
    : (interview.overallScore || 5);
  const topicFor = (question) => question.topic || question.title || (question.isCodingProblem ? 'Coding / DSA' : 'General');
  const strongest = [...scored].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
  const weakest = [...scored].sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 3);

  const strengths = strongest.map(({ question, score }) => {
    const topic = topicFor(question);
    const feedback = question.codeFeedback || question.feedback;
    return feedback
      ? `${topic} (${score || 'N/A'}/10): ${compactText(feedback, 260)}`
      : `${topic}: a response was recorded${score == null ? '' : ` and scored ${score}/10`}; see its question breakdown for the answer and evaluation.`;
  });
  if (strengths.length < 2) {
    strengths.push(answeredQuestions.length
      ? `Completed ${answeredQuestions.length} of ${allQuestions.length} listed questions; recorded answers are included in the breakdown.`
      : 'No candidate answers were recorded, so strengths could not be assessed.');
  }
  if (strengths.length < 2) strengths.push('No scored evidence was available to identify another strength.');

  const weaknesses = weakest.map(({ question, score }) => {
    const topic = topicFor(question);
    const improvement = Array.isArray(question.improvements) ? question.improvements.find(Boolean) : null;
    const feedback = question.codeFeedback || question.feedback;
    if (improvement) return `${topic}${score == null ? '' : ` (${score}/10)`}: ${compactText(improvement, 260)}`;
    if (feedback) return `${topic}${score == null ? '' : ` (${score}/10)`}: review the specific evaluator feedback — ${compactText(feedback, 240)}`;
    return `${topic}: detailed evaluator feedback was unavailable for this response; review the saved answer in the question breakdown.`;
  });
  if (weaknesses.length === 0) weaknesses.push('There were no answered questions to identify development areas from.');

  const best = strongest[0];
  const needsWork = weakest[0];
  const role = String(interview.role || 'interview role').replace(/-/g, ' ');
  const averageText = scoredQuestions.length ? ` The average across ${scoredQuestions.length} scored questions was ${overallScore}/10.` : '';
  const bestText = best ? ` The strongest recorded area was ${topicFor(best.question)} (${best.score || 'N/A'}/10).` : '';
  const lowText = needsWork ? ` Revisit ${topicFor(needsWork.question)} (${needsWork.score || 'N/A'}/10) using its answer and feedback below.` : '';
  const summary = `This ${role} assessment is based on ${answeredQuestions.length} answered question${answeredQuestions.length === 1 ? '' : 's'} out of ${allQuestions.length} listed.${averageText}${bestText}${lowText}`;

  const perQuestionBreakdown = questions.map((question) => {
    const score = getQuestionScore(question) ?? 5;
    const feedback = question.codeFeedback || question.feedback;
    const answer = getQuestionAnswer(question);
    return {
      questionText: compactText(question.questionText || question.title, 900),
      candidateAnswer: answer,
      topic: topicFor(question),
      score,
      feedback: feedback
        ? compactText(feedback, 700)
        : answer === 'No answer was recorded.'
          ? 'No candidate response was recorded for this question, so it could not be evaluated.'
          : 'The response is saved, but detailed evaluator feedback was unavailable for this question.',
      signals: {
        clarity: question.signals?.clarity ?? 5,
        depth: question.signals?.depth ?? 5,
        correctness: question.signals?.correctness ?? 5,
      },
    };
  });

  const recommendations = [];
  for (const { question } of weakest) {
    const improvement = Array.isArray(question.improvements) ? question.improvements.find(Boolean) : null;
    if (improvement) recommendations.push(`${topicFor(question)}: ${compactText(improvement, 220)}`);
    else if (question.isCodingProblem || question.codeAnswer) {
      recommendations.push(`Rework the ${topicFor(question)} problem, then compare your approach against the saved code feedback and add tests for edge cases.`);
    } else {
      recommendations.push(`Prepare a clearer explanation for ${topicFor(question)} using the question breakdown and evaluator feedback.`);
    }
  }
  if (recommendations.length === 0) recommendations.push('Review each question breakdown and practice the areas with the lowest recorded scores.');

  const patternGroups = new Map();
  for (const question of questions) {
    for (const pattern of question.patterns || []) {
      const entry = patternGroups.get(pattern) || [];
      const score = getQuestionScore(question);
      if (score != null) entry.push(score);
      patternGroups.set(pattern, entry);
    }
  }

  return {
    overallScore,
    summary,
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 6),
    perQuestionBreakdown,
    communicationSummary: {
      averageWpm: commStats.averageWpm,
      totalFillerWords: commStats.totalFillerWords,
      paceAssessment: commStats.paceAssessment,
      notes: commStats.averageWpm > 0
        ? `Based on ${commStats.averageWpm} WPM across turns with speech telemetry and ${commStats.totalFillerWords} detected filler words. Review the transcript for answer structure and clarity.`
        : 'No speech cadence telemetry was recorded. Use the full dialogue transcript to review answer structure and clarity.',
    },
    patternPerformance: [...patternGroups.entries()].map(([pattern, scores]) => ({
      pattern,
      score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 5,
      notes: scores.length ? `Based on ${scores.length} scored response${scores.length === 1 ? '' : 's'} tagged with this pattern.` : 'No scored response was available for this pattern.',
    })),
    nextPracticeRecommendations: [...new Set(recommendations)].slice(0, 5),
  };
}

/**
 * Synthesize interview dialogue into a compact representation for the strong model.
 */
function buildSynthesisPrompt(interview, commStats) {
  const role = interview.role ? interview.role.replace(/-/g, ' ') : 'Software Engineer';
  const mode = interview.config?.mode || 'mixed';
  const questions = interview.questions || [];
  const turns = interview.turns || [];

  const answeredQuestions = questions.filter((q) => q.answerText || q.codeAnswer);
  const questionsToAssess = answeredQuestions.length > 0 ? answeredQuestions : questions;
  const questionSummaries = questionsToAssess.map((q, idx) => {
    const isCoding = !!(q.isCodingProblem || q.questionText?.startsWith('[CODING_PROBLEM]'));
    const score = isCoding ? (q.codeScore ?? q.score) : q.score;
    const fb = isCoding ? (q.codeFeedback || q.feedback) : q.feedback;
    const patterns = Array.isArray(q.patterns) && q.patterns.length > 0 ? q.patterns.join(', ') : 'N/A';
    const referencedTurns = q.questionId
      ? turns.filter((turn) => turn.speaker === 'candidate' && turn.questionRef === q.questionId).map((turn) => turn.text)
      : [];
    const ans = q.answerText || (q.codeAnswer ? `[Submitted code]\n${q.codeAnswer}` : referencedTurns.join('\n') || 'No response recorded');
    const answerLength = q.answerText ? q.answerText.length : (q.codeAnswer ? q.codeAnswer.length : 0);
    const topic = q.topic || q.title || 'General';
    const questionText = compactText(q.title ? `${q.title}: ${q.questionText || ''}` : q.questionText, 700);
    const type = isCoding
      ? 'Coding / DSA'
      : /behavioral|leadership|conflict|teamwork|motivation|culture|ownership|introduction|background/i.test(`${topic} ${q.title || ''}`)
        ? 'Behavioral'
        : 'CS / Role Fundamentals';

    return `Question ${idx + 1}: ${questionText}
Type: ${type}
Topic: ${topic}
Patterns: ${patterns}
Answer Length: ${answerLength} chars
Candidate Given Answer: ${compactText(ans, 1800)}
Turn Score: ${score ?? 'Pending'}/10
Saved Evaluation Notes: ${compactText(fb || 'No detailed evaluator feedback was saved.', 600)}
Recorded Improvement Notes: ${compactText((q.improvements || []).join('; '), 400) || 'None saved'}`;
  });

  const systemContent = `You are a Principal Engineering Director writing a detailed, specific post-interview assessment report.
Generate strictly valid JSON matching this schema. Base every judgment on the supplied answers, code, scores, or saved evaluator notes. Do not invent evidence.

SCHEMA:
{
  "overallScore": <integer 1-10>,
  "summary": "<3-5 sentences summarizing overall performance, strongest evidence, and clearest development need>",
  "strengths": ["<specific strength with answer evidence>", "<specific strength with answer evidence>"],
  "weaknesses": ["<specific gap with answer evidence>", "<specific gap with answer evidence>"],
  "perQuestionBreakdown": [
    {
      "questionText": "<question text>",
      "candidateAnswer": "<concise summary of what the candidate actually said>",
      "topic": "<topic or pattern>",
      "score": <integer 1-10>,
      "feedback": "<2-4 sentences: reference the actual answer/code, identify what worked or was missing, and give a concrete next step>",
      "signals": { "clarity": 1-10, "depth": 1-10, "correctness": 1-10 }
    }
  ],
  "communicationSummary": {
    "averageWpm": ${commStats.averageWpm},
    "totalFillerWords": ${commStats.totalFillerWords},
    "paceAssessment": "${commStats.paceAssessment}",
    "notes": "<specific observation on their communication style, confidence, articulation based on actual transcript>"
  },
  "patternPerformance": [
    { "pattern": "<pattern-name>", "score": <int 1-10>, "notes": "<specific assessment with examples from their answers>" }
  ],
  "nextPracticeRecommendations": [
    "<specific actionable recommendation tied to a weakness shown>",
    "<specific actionable recommendation tied to a weakness shown>",
    "<specific actionable recommendation tied to a weakness shown>"
  ]
}

CRITICAL RULES:
- Include a breakdown entry for every supplied answered question, in the same order.
- Reference answer details or code behavior; do not reuse the same praise or criticism across questions.
- If an answer is short or incomplete, name the missing detail. If an answer is strong, explain which part demonstrates strength.
- For coding, assess correctness, code structure, and edge cases from the submitted solution. Do not require the candidate to state time/space complexity.
- For behavioral answers, assess personal ownership, actions, and concrete outcomes.
- Keep each strength, weakness, and recommendation concise but specific. Do not output generic claims like "good problem-solving" without evidence.`;

  const userContent = `Interview Target Role: ${role}
Mode: ${mode}
Questions Asked:
${questionSummaries.join('\n\n')}

Speech Metrics Telemetry:
Average WPM: ${commStats.averageWpm}
Total Filler Words: ${commStats.totalFillerWords}
Pace: ${commStats.paceAssessment}

Produce the complete JSON assessment report now. Include only evidence represented above.`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

/**
 * In-process async report generator worker.
 *
 * @param {string} interviewId
 * @returns {Promise<object>} The generated report
 */
async function generateInterviewReport(interviewId) {
  try {
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found for report generation`);
    }

    interview.status = 'completing';
    await interview.save();

    console.log(`[ReportGenerator] Generating comprehensive report for interview ${interviewId}...`);

    const commStats = computeCommunicationStats(interview.turns);
    const messages = buildSynthesisPrompt(interview, commStats);

    const fallbackReport = buildFallbackReport(interview, commStats);
    const reportTokenLimit = Math.min(5000, 1200 + (interview.questions?.length || 0) * 300);

    const generated = await llm.generate({
      task: 'strong',
      messages,
      json: true,
      schema: reportSchema,
      safeDefault: fallbackReport,
      maxTokens: reportTokenLimit,
      timeoutMs: 45000,
    });

    // Calculate real mathematical overall score averaged from all evaluated questions & signals
    const questionScores = (interview.questions || [])
      .map((q) => {
        if (q.signals && typeof q.signals.correctness === 'number') {
          return Math.round((q.signals.correctness * 0.45) + (q.signals.depth * 0.35) + (q.signals.clarity * 0.20));
        }
        return q.score || q.codeScore;
      })
      .filter((s) => typeof s === 'number' && s > 0);

    const calculatedAvgScore = questionScores.length > 0
      ? Math.round(questionScores.reduce((a, b) => a + b, 0) / questionScores.length)
      : generated.overallScore;

    // Populate report and mark interview as completed
    interview.report = {
      ...generated,
      summary: generated.summary || fallbackReport.summary,
      overallScore: calculatedAvgScore,
      generatedAt: new Date(),
    };
    interview.overallScore = calculatedAvgScore;
    interview.overallFeedback = interview.report.summary;
    interview.status = 'completed';
    interview.endedAt = new Date();

    await interview.save();
    console.log(`[ReportGenerator] Report successfully generated and saved for interview ${interviewId}`);
    return interview.report;
  } catch (err) {
    console.error(`[ReportGenerator] Failed to generate report for ${interviewId}:`, err);
    await Interview.findByIdAndUpdate(interviewId, {
      status: 'completed',
      endedAt: new Date(),
    });
    throw err;
  }
}

module.exports = {
  generateInterviewReport,
  computeCommunicationStats,
  buildFallbackReport,
  buildSynthesisPrompt,
  reportSchema,
};

