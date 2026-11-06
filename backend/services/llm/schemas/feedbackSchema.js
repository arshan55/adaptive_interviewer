/**
 * Zod schemas for all LLM-generated JSON shapes.
 * The LLM layer validates every JSON response against these.
 */

const { z } = require('zod');

/**
 * Standard per-answer feedback schema.
 * score: integer 1–10
 * feedback: plain-text sentence(s)
 * improvements: 2–3 short action items
 */
const feedbackSchema = z.object({
  score: z.number().int().min(1).max(10),
  feedback: z.string().min(1),
  improvements: z.array(z.string()).min(1).max(5),
});

/**
 * Code answer feedback (extends feedbackSchema with code-specific fields).
 */
const codeFeedbackSchema = z.object({
  score: z.number().int().min(1).max(10),
  feedback: z.string().min(1),
  codeScore: z.number().int().min(1).max(10),
  codeFeedback: z.string().min(1),
  improvements: z.array(z.string()).min(1).max(5),
});

/**
 * Overall interview feedback schema.
 */
const overallFeedbackSchema = z.object({
  overallScore: z.number().int().min(1).max(10),
  overallFeedback: z.string().min(1),
});

/** Safe defaults returned when repair + all providers fail */
const SAFE_FEEDBACK_DEFAULT = {
  score: 5,
  feedback: 'Feedback generation is temporarily unavailable. Please try again.',
  improvements: ['Review your answer and try again.'],
};

const SAFE_CODE_FEEDBACK_DEFAULT = {
  score: 5,
  feedback: 'Feedback generation is temporarily unavailable. Please try again.',
  codeScore: 5,
  codeFeedback: 'Code feedback generation is temporarily unavailable. Please try again.',
  improvements: ['Review your code and try again.'],
};

const SAFE_OVERALL_DEFAULT = {
  overallScore: 5,
  overallFeedback: 'Overall feedback is temporarily unavailable. Please review individual question feedback.',
};

module.exports = {
  feedbackSchema,
  codeFeedbackSchema,
  overallFeedbackSchema,
  SAFE_FEEDBACK_DEFAULT,
  SAFE_CODE_FEEDBACK_DEFAULT,
  SAFE_OVERALL_DEFAULT,
};

