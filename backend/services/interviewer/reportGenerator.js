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
    : 130;

  const totalFillerWords = candidateTurns
    .map((t) => t.metrics.fillerWordsCount || 0)
    .reduce((a, b) => a + b, 0);

  let paceAssessment = 'Optimal speaking cadence';
  if (averageWpm > 175) paceAssessment = 'Fast pace — could slow down for clarity';
  else if (averageWpm < 100) paceAssessment = 'Deliberate / slightly slow pace';

  return { averageWpm, totalFillerWords, paceAssessment };
}

/**
 * Synthesize interview dialogue into a compact representation for the strong model.
 */
function buildSynthesisPrompt(interview, commStats) {
  const role = interview.role ? interview.role.replace(/-/g, ' ') : 'Software Engineer';
  const mode = interview.config?.mode || 'mixed';
  const questions = interview.questions || [];
  const turns = interview.turns || [];

  const questionSummaries = questions.map((q, idx) => {
    const isCoding = !!(q.isCodingProblem || q.questionText?.startsWith('[CODING_PROBLEM]'));
    const score = isCoding ? (q.codeScore ?? q.score) : q.score;
    const fb = isCoding ? (q.codeFeedback || q.feedback) : q.feedback;
    const patterns = Array.isArray(q.patterns) && q.patterns.length > 0 ? q.patterns.join(', ') : 'N/A';
    const ans = q.answerText || (q.codeAnswer ? `[Code Answer]: ${q.codeAnswer.slice(0, 500)}` : 'No written/spoken answer submitted');
    const answerLength = q.answerText ? q.answerText.length : (q.codeAnswer ? q.codeAnswer.length : 0);

    return `Question ${idx + 1}: ${q.questionText}
Type: ${isCoding ? 'Coding / DSA' : 'Behavioral / HR'}
Patterns: ${patterns}
Answer Length: ${answerLength} chars
Candidate Given Answer: ${ans}
Turn Score: ${score || 'Pending'}/10
Initial Feedback: ${fb || 'Evaluated in turns'}`;
  });

  const candidateTurns = turns.filter(t => t.speaker === 'candidate');
  const turnExcerpts = candidateTurns.slice(-10).map((t) => `[CANDIDATE]: ${t.text}`);

  const systemContent = `You are a Principal Engineering Director writing a detailed, specific post-interview assessment report.
Generate strictly valid JSON matching this schema. DO NOT use generic phrases.

SCHEMA:
{
  "overallScore": <integer 1-10>,
  "strengths": ["<specific strength with evidence from answers>", "<specific strength with evidence>", "<specific strength with evidence>"],
  "weaknesses": ["<specific weakness with evidence from answers>", "<specific weakness with evidence>", "<specific weakness with evidence>"],
  "perQuestionBreakdown": [
    {
      "questionText": "<question text>",
      "candidateAnswer": "<concise summary of what the candidate actually said>",
      "topic": "<topic or pattern>",
      "score": <integer 1-10>,
      "feedback": "<detailed, actionable feedback: quote what they said, explain what was good/missing, give concrete improvement>",
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
- Every strength/weakness MUST reference specific content from the candidate's actual answers
- Per-question feedback MUST quote or paraphrase what the candidate said and explain exactly what to improve
- Recommendations MUST be concrete actions (e.g., "Practice explaining time complexity of sliding window problems" not "Practice algorithms")
- If candidate gave short/vague answers, note that explicitly and say what was missing
- For coding: comment on code quality, edge cases, complexity analysis, not just "solved it"
- For behavioral: comment on STAR structure, specific metrics/outcomes, personal ownership`;

  const userContent = `Interview Target Role: ${role}
Mode: ${mode}
Questions Asked:
${questionSummaries.join('\n\n')}

Speech Metrics Telemetry:
Average WPM: ${commStats.averageWpm}
Total Filler Words: ${commStats.totalFillerWords}
Pace: ${commStats.paceAssessment}

Recent Candidate Turn Excerpts:
${turnExcerpts.join('\n') || 'No candidate turns recorded.'}

Produce the complete JSON assessment report now.`;

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

    const fallbackReport = {
      overallScore: interview.overallScore || 7,
      strengths: [
        'Demonstrated good problem-solving fundamentals and structured reasoning.',
        'Communicated thoughts clearly during discussion turns.',
      ],
      weaknesses: [
        'Could dive deeper into edge cases and complexity trade-offs.',
      ],
      perQuestionBreakdown: (interview.questions || []).map((q) => ({
        questionText: q.questionText,
        candidateAnswer: q.answerText || (q.codeAnswer ? `[Code Answer]: ${q.codeAnswer.slice(0, 200)}` : 'Answer submitted.'),
        topic: q.topic || 'General',
        score: q.score || 7,
        feedback: q.feedback || 'Answer completed.',
        signals: { clarity: 7, depth: 6, correctness: 7 },
      })),
      communicationSummary: {
        averageWpm: commStats.averageWpm,
        totalFillerWords: commStats.totalFillerWords,
        paceAssessment: commStats.paceAssessment,
        notes: 'Consistent pacing and structured explanations.',
      },
      patternPerformance: [],
      nextPracticeRecommendations: [
        'Practice time and space complexity analysis under time constraints.',
        'Structure behavioral answers strictly around personal actions and quantified outcomes.',
        'Explore further algorithmic patterns such as sliding window and graph traversals.',
      ],
    };

    const generated = await llm.generate({
      task: 'fast',
      messages,
      json: true,
      schema: reportSchema,
      safeDefault: fallbackReport,
      maxTokens: 2000,
    });

    // Populate report and mark interview as completed
    interview.report = {
      ...generated,
      generatedAt: new Date(),
    };
    interview.overallScore = generated.overallScore;
    interview.overallFeedback = generated.strengths.join('; ');
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
  reportSchema,
};

