/**
 * Prompt builder for overall interview feedback.
 *
 * Returns an OpenAI-style messages array.
 * The LLM responds with:
 *   { overallScore: int 1-10, overallFeedback: string }
 *
 * Uses LLM_MODEL_STRONG because this is a summary/report task.
 */

/**
 * @param {string} role                 Interview role
 * @param {Array}  questionsWithAnswers Array of question subdocs (with answers + scores)
 * @returns {Array} messages array
 */
function buildPrompt(role, questionsWithAnswers) {
  const roleLabel = role ? role.replace(/-/g, ' ') : 'software engineer';

  const systemContent = `You are a senior ${roleLabel} interview coach writing a concise post-interview report.
Respond ONLY with a valid JSON object — no markdown fences, no extra text — in this exact shape:
{"overallScore": <int 1-10>, "overallFeedback": "<plain text, max 200 words covering strengths, weaknesses, and 2-3 concrete next steps>"}`;

  // Build a compact summary of each question (keep total prompt small)
  const summaryLines = questionsWithAnswers.map((q, i) => {
    const isCoding = !!(q.codeAnswer || q.codeScore != null);
    const score = isCoding ? (q.codeScore ?? q.score) : q.score;
    const feedback = isCoding ? (q.codeFeedback || q.feedback) : q.feedback;
    const questionText = q.questionText.replace(/^\[CODING_PROBLEM\]\s*/i, '');
    // Truncate long question texts to keep the prompt compact
    const truncatedQ = questionText.length > 120 ? questionText.slice(0, 120) + '…' : questionText;
    const truncatedF = feedback ? (feedback.length > 100 ? feedback.slice(0, 100) + '…' : feedback) : 'No feedback';
    return `Q${i + 1}: ${truncatedQ}\n  Score: ${score ?? 'N/A'}/10 | ${truncatedF}`;
  });

  const userContent = `Interview role: ${roleLabel}

Question-by-question summary:
${summaryLines.join('\n\n')}

Provide an overall score (average the per-question scores, round to nearest integer) and a comprehensive but concise final report.`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

module.exports = { buildPrompt };

