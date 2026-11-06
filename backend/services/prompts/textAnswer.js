/**
 * Prompt builder for text-answer evaluation.
 *
 * Returns an OpenAI-style messages array.
 * The LLM is instructed to respond ONLY with a JSON object matching:
 *   { score: int 1-10, feedback: string, improvements: string[] }
 */

/**
 * @param {object} question        Interview question subdoc
 * @param {string} answerText      Candidate's answer
 * @param {string} role            Interview role (e.g. 'software-engineer')
 * @param {string} [ragContext]    Optional RAG/CodingProblemDetails context block
 * @param {object} [speechMetrics] Optional { wpm, fillerWordsCount }
 * @returns {Array} messages array
 */
function buildPrompt(question, answerText, role, ragContext = '', speechMetrics = null) {
  const roleLabel = role ? role.replace(/-/g, ' ') : 'software engineer';

  let systemContent = `You are an expert ${roleLabel} interviewer providing concise, honest feedback.
Respond ONLY with a valid JSON object — no markdown fences, no extra text — in this exact shape:
{"score": <integer 1-10>, "feedback": "<plain text, max 80 words>", "improvements": ["<item1>", "<item2>"]}`;

  let userContent = '';

  if (ragContext && ragContext.length > 0) {
    userContent += `${ragContext}\n\n`;
  }

  userContent += `Interview question: ${question.questionText}

Candidate's answer: ${answerText}`;

  if (speechMetrics && typeof speechMetrics.wpm === 'number') {
    userContent += `\n\nSpeech metrics — WPM: ${speechMetrics.wpm}`;
    if (typeof speechMetrics.fillerWordsCount === 'number') {
      userContent += `, filler words: ${speechMetrics.fillerWordsCount}`;
    }
    userContent += `. Factor in communication quality if the WPM is unusually low (<80) or high (>200), or fillers are excessive (>5).`;
  }

  userContent += `\n\nScore the answer 1-10 (10 = outstanding). Keep feedback under 80 words. List 2-3 concrete improvements.`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

module.exports = { buildPrompt };

