/**
 * Prompt builder for code-answer evaluation (Phase 4).
 *
 * In Phase 4, the LLM no longer attempts to guess code execution correctness.
 * Instead, actual test case results (pass rate, failing tests) are provided to the LLM.
 * The LLM focuses strictly on:
 *   - Algorithmic approach & efficiency (Time and Space Big-O complexity)
 *   - Code structure, cleanliness, readability, and idiomatic practices
 *   - Edge-case robustness
 *
 * Final Code Score = Weighted combination:
 *   70% objective test pass rate + 30% LLM algorithmic quality score.
 */

/**
 * Calculates weighted final code score based on test execution + LLM quality.
 *
 * @param {number|null} passRate Ratio between 0.0 and 1.0 (passedTests / totalTests)
 * @param {number} llmQualityScore LLM rating 1-10
 * @returns {number} Integer score 1-10
 */
function calculateWeightedCodeScore(passRate, llmQualityScore) {
  // If no test cases were run (e.g. language execution unavailable), rely on LLM score
  if (typeof passRate !== 'number' || isNaN(passRate)) {
    return Math.min(10, Math.max(1, Math.round(llmQualityScore)));
  }

  const normalizedPass = Math.min(1, Math.max(0, passRate));
  const objectiveScore = normalizedPass * 7;      // 70% weight (0 to 7)
  const subjectiveScore = (llmQualityScore * 0.3); // 30% weight (0.3 to 3.0)

  let finalScore = Math.round(objectiveScore + subjectiveScore);

  // Safety cap: If 0 test cases passed, candidate cannot score above 3
  if (normalizedPass === 0) {
    finalScore = Math.min(finalScore, 3);
  }

  return Math.min(10, Math.max(1, finalScore));
}

/**
 * @param {object} question         Interview question subdoc
 * @param {string} codeAnswer       Candidate's code
 * @param {string} language         Programming language
 * @param {string} role             Interview role
 * @param {string} [ragContext]     Optional RAG context block
 * @param {object} [testSummary]    Optional test execution results
 * @returns {Array} messages array
 */
function buildPrompt(question, codeAnswer, language, role, ragContext = '', testSummary = null) {
  const roleLabel = role ? role.replace(/-/g, ' ') : 'software engineer';

  const systemContent = `You are a senior ${roleLabel} staff engineer evaluating a candidate's code submission.
IMPORTANT: You do NOT need to evaluate basic correctness or simulate test outputs — objective test cases have already been executed by our runner.
Focus strictly on:
1. Algorithmic Approach & Big-O Time/Space Complexity.
2. Code Cleanliness, Readability, and Idiomatic Style.
3. Edge-case handling and potential runtime hazards.

Respond ONLY with a valid JSON object:
{
  "score": <overall review score 1-10>,
  "feedback": "<high-level evaluation, max 60 words>",
  "codeScore": <quality/complexity score 1-10>,
  "codeFeedback": "<analysis of time/space complexity and structure, max 80 words>",
  "improvements": ["<concrete optimization 1>", "<concrete optimization 2>"]
}`;

  let userContent = '';

  if (ragContext && ragContext.length > 0) {
    userContent += `${ragContext}\n\n`;
  }

  const questionText = question.questionText.replace(/^\[CODING_PROBLEM\]\s*/i, '');

  userContent += `Problem: ${questionText}

Language: ${language}

Candidate's Code:
\`\`\`${language}
${codeAnswer}
\`\`\``;

  if (testSummary && typeof testSummary.totalTests === 'number' && testSummary.totalTests > 0) {
    userContent += `\n\nObjective Test Runner Results:
- Passed: ${testSummary.passedTests} / ${testSummary.totalTests} tests (${Math.round((testSummary.passRate || 0) * 100)}%)`;
    if (testSummary.failedNotes) {
      userContent += `\n- Failure details: ${testSummary.failedNotes}`;
    }
  }

  userContent += `\n\nEvaluate the code quality, time/space complexity, and architecture.`;

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

module.exports = {
  buildPrompt,
  calculateWeightedCodeScore,
};
