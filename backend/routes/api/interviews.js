console.log('Loaded interviews.js route file');

const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const Interview = require('../../models/Interview');
const User = require('../../models/User');
const {
  questionIdentityKeys,
  questionTopics,
  selectBestQuestion,
} = require('../../services/questionRetrieval');
const embeddingsService = require('../../services/embeddingsService');
const CodingProblemDetails = require('../../models/CodingProblemDetails');
const QuestionBank = require('../../models/QuestionBank');

// --- LLM provider layer (Phase 1) ---
const { z } = require('zod');
const llm = require('../../services/llm');
const { feedbackSchema, codeFeedbackSchema, overallFeedbackSchema, SAFE_FEEDBACK_DEFAULT, SAFE_CODE_FEEDBACK_DEFAULT, SAFE_OVERALL_DEFAULT } = require('../../services/llm/schemas/feedbackSchema');
const textAnswerPrompt = require('../../services/prompts/textAnswer');
const codeAnswerPrompt = require('../../services/prompts/codeAnswer');
const overallFeedbackPromptBuilder = require('../../services/prompts/overallFeedback');

// Phase 2 interview session configuration schema
const interviewConfigSchema = z.object({
  mode: z.enum(['hr', 'dsa', 'mixed']).default('mixed'),
  patterns: z.array(z.string()).default([]),
  difficulty: z.enum(['adaptive', 'easy', 'medium', 'hard']).default('adaptive'),
  durationMin: z.number().int().min(5).max(180).default(30),
  maxQuestions: z.number().int().min(0).max(20).default(5),
  voice: z.boolean().default(false),
  company: z.string().nullable().optional().default(null),
  resumeMode: z.enum(['none', 'mix', 'pure']).default('none'),
  resumeText: z.string().nullable().optional().default(null),
});

// Phase 3 adaptive interviewer engine & report generator
const { evaluateTurn, evaluateTurnStream, computeAdaptedDifficulty } = require('../../services/interviewer/adaptiveEngine');
const { generateInterviewReport } = require('../../services/interviewer/reportGenerator');

// --- Configuration ---
// Max questions per interview session. Configurable via env.
const MAX_QUESTIONS = parseInt(process.env.MAX_QUESTIONS_PER_INTERVIEW || '5', 10);

// When LEGACY_MEDIA_EVAL=true, audio/video blobs are still sent to Gemini multimodal.
// Default is false — only transcribed text + speech metrics are used.
const LEGACY_MEDIA_EVAL = process.env.LEGACY_MEDIA_EVAL === 'true';

console.log(`Interviews route — MAX_QUESTIONS=${MAX_QUESTIONS} LEGACY_MEDIA_EVAL=${LEGACY_MEDIA_EVAL}`);

// --- Helpers ---

const VIDEO_ANSWER_PLACEHOLDER = '[Video answer submitted — recording not stored]';

/** Check if a question is a coding problem (new field first, then prefix fallback for old data). */
const isCodingQuestion = (q) =>
  q.isCodingProblem === true || q.questionText.startsWith('[CODING_PROBLEM]');

/** Remove legacy video blobs from API payloads and DB-shaped objects. */
const sanitizeInterviewForResponse = (interview) => {
  const doc = interview.toObject ? interview.toObject() : { ...interview };
  if (Array.isArray(doc.questions)) {
    doc.questions = doc.questions.map((q) => {
      const question = { ...q };
      if (question.videoAnswer) {
        if (!question.answerText) {
          question.answerText = VIDEO_ANSWER_PLACEHOLDER;
        }
        delete question.videoAnswer;
      }
      return question;
    });
  }
  return doc;
};

// Generate dynamic resume-based question using LLM
const generateResumeQuestion = async (resumeText, role, pastQuestions = []) => {
  try {
    const prompt = `You are a Principal Engineering Interviewer. Analyze the following candidate's resume and generate ONE high-impact, specific technical or architectural interview question directly referencing a project, technology, or challenge mentioned in their resume for the role of ${role.replace(/-/g, ' ')}.

Candidate Resume:
${resumeText.slice(0, 3000)}

Previously Asked Questions:
${pastQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'None'}

Requirements:
- The question must be deeply contextualized to their exact experience/tools (e.g., "In your project X using technology Y, how did you handle Z?").
- Do NOT repeat previously asked questions.
- Keep the question concise, direct, and under 40 words.
Return ONLY valid JSON:
{
  "questionText": "<question text>",
  "topic": "<technology/skill area>",
  "isCodingProblem": false
}`;

    const res = await llm.generate({
      task: 'fast',
      messages: [{ role: 'user', content: prompt }],
      json: true,
      safeDefault: {
        questionText: `Looking at your experience on your resume, could you walk me through the architecture of your most impactful project and the key engineering trade-offs you made?`,
        topic: 'Resume Deep Dive',
        isCodingProblem: false,
      },
    });

    return {
      questionId: null,
      questionText: res.questionText,
      topic: res.topic || 'Resume Experience',
      isCodingProblem: Boolean(res.isCodingProblem),
      patterns: [],
    };
  } catch (err) {
    console.error('Failed to generate resume question:', err);
    return {
      questionId: null,
      questionText: `Looking at your experience on your resume, could you walk me through the architecture of your most impactful project and the key engineering trade-offs you made?`,
      topic: 'Resume Experience',
      isCodingProblem: false,
      patterns: [],
    };
  }
};

const getUserPastQuestionHistory = async (userId) => {
  try {
    const userInterviews = await Interview.find({ user: userId }).select(
      'questions.questionId questions.questionText questions.topic questions.title questions.link'
    );
    const pastQuestionTexts = [];
    const pastTopics = [];
    const seenKeys = [];
    userInterviews.forEach((interview) => {
      if (interview.questions) {
        interview.questions.forEach((q) => {
          if (q.questionText) pastQuestionTexts.push(q.questionText);
          if (q.questionId) seenKeys.push(String(q.questionId).toLowerCase().trim());
          if (q.topic) pastTopics.push(q.topic);
          seenKeys.push(...questionIdentityKeys(q));
        });
      }
    });
    return {
      questionTexts: [...new Set(pastQuestionTexts)],
      topics: [...new Set(pastTopics)],
      seenKeys: [...new Set(seenKeys)],
    };
  } catch (err) {
    console.error('Error in getUserPastQuestionHistory:', err.message);
    return { questionTexts: [], topics: [], seenKeys: [] };
  }
};

const getDevFallbackQuestionTexts = (role) => {
  const roleLabel = role.replace(/-/g, ' ');
  const common = [
    `Tell me about yourself and why you are interested in this ${roleLabel} role.`,
    `Describe a challenging project you worked on and how you handled obstacles.`,
    `How do you stay current with trends and tools in ${roleLabel}?`,
    `Tell me about a time you disagreed with a teammate. How did you resolve it?`,
    `What questions do you have for us about this role and team?`,
  ];
  const technical = [
    `Explain the difference between REST and GraphQL. When would you choose each?`,
    `[CODING_PROBLEM] Write a function to detect if a string has balanced brackets ( ), [ ], { }. Explain your approach.`,
    `How would you design a rate limiter for a public API?`,
    `Describe how you would debug a slow database query in production.`,
    `What trade-offs do you consider when choosing SQL vs NoSQL?`,
  ];
  const techRoles = new Set([
    'software-engineer', 'frontend-developer', 'backend-developer', 'data-scientist', 'devops-engineer', 'ai-engineer', 'ml-engineer',
  ]);
  return techRoles.has(role) ? technical : common;
};

const createDevFallbackInterview = async (userId, role, programmingLanguage) => {
  const questionTexts = getDevFallbackQuestionTexts(role);
  const questions = questionTexts.map((questionText, index) => ({
    questionText,
    answerText: null,
    feedback:
      index === 0
        ? 'Practice mode: AI quota is unavailable, so these are built-in questions.'
        : null,
    score: null,
    codeAnswer: null,
    programmingLanguage: null,
    codeFeedback: null,
    codeScore: null,
    audioAnswer: null,
    isCodingProblem: questionText.startsWith('[CODING_PROBLEM]'),
  }));

  const interview = new Interview({
    user: userId,
    role,
    programmingLanguage: programmingLanguage || undefined,
    questions,
    date: new Date(),
  });
  await interview.save();
  await User.findByIdAndUpdate(userId, { $push: { interviews: interview._id } }, { new: true });
  return interview;
};

/** Build RAG context block for a question (CodingProblemDetails-first, then semantic fallback). */
async function buildRetrievedBlock(question) {
  if (process.env.RAG_FEEDBACK_ENABLED !== 'true') return '';
  try {
    let cp = null;
    if (question?.questionId) {
      cp = await CodingProblemDetails.findOne({ questionId: String(question.questionId) }).lean();
    }
    if (!cp && question?.normalizedTitle) {
      const qb = await QuestionBank.findOne({ normalizedTitle: question.normalizedTitle })
        .select('questionId title')
        .lean();
      if (qb?.questionId) {
        cp = await CodingProblemDetails.findOne({ questionId: qb.questionId }).lean();
      }
    }
    if (!cp && question?._id) {
      cp = await CodingProblemDetails.findOne({ questionId: String(question._id) }).lean();
    }

    if (cp && (cp.referenceSolution || cp.rubric?.length)) {
      const refSol = cp.referenceSolution ? String(cp.referenceSolution).trim().slice(0, 1200) : 'N/A';
      const rubric = Array.isArray(cp.rubric) ? cp.rubric.slice(0, 5).join('; ') : '';
      console.log('RAG: using CodingProblemDetails for', cp.questionId || question.questionId);
      return `Reference (Coding Problem):\nTitle: ${question.title || question.normalizedTitle || question.questionId}\nReference Solution: ${refSol}\nRubric: ${rubric}\n\n---\n`;
    }

    // Semantic nearest-neighbor fallback
    const topK = parseInt(process.env.RAG_FEEDBACK_TOP_K || '3', 10);
    const emb = await embeddingsService.generateEmbedding(question.questionText);
    const neighbors = await embeddingsService.findNearest(emb, topK);
    if (!neighbors || neighbors.length === 0) return '';

    let block = 'Reference materials (similar past questions):\n';
    neighbors.forEach((n, i) => {
      block += `${i + 1}) Title: ${n.title || n.normalizedTitle || 'N/A'}\nTopic: ${n.topic || 'N/A'}\nDifficulty: ${n.difficulty || 'N/A'}\n\n`;
    });
    return block;
  } catch (err) {
    console.error('RAG retrieval error:', err.message || err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Legacy multimodal evaluation (LEGACY_MEDIA_EVAL=true only)
// ---------------------------------------------------------------------------
const { GoogleGenerativeAI } = require('@google/generative-ai');

const isQuotaOrRateLimitError = (error) =>
  error?.status === 429 ||
  error?.status === 503 ||
  /429|quota|rate.?limit|too many requests|timed out/i.test(String(error?.message || ''));

const getLegacyGeminiModel = (modelName) => {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY is not configured');
  const name = modelName || process.env.GEMINI_MODEL_FAST || 'gemini-2.0-flash-lite';
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY).getGenerativeModel({
    model: name,
    generationConfig: { maxOutputTokens: 350, temperature: 0.2 },
  });
};

const legacyGenerateWithTimeout = (modelClient, prompt, timeoutMs = 8000) =>
  Promise.race([
    modelClient.generateContent(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Model request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);

const parseFeedbackAndScore = (text) => {
  const scoreMatch = text.match(/Score:\s*(\d+)/i);
  const feedbackMatch = text.match(/Feedback:\s*([\s\S]*?)(?=\n\s*Score:|\n\s*Areas for Improvement:|$)/i);
  let score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
  if (score !== null) score = Math.min(10, Math.max(1, score));
  const rawFeedback = feedbackMatch ? feedbackMatch[1].trim() : 'No feedback provided';
  return { feedback: rawFeedback, score };
};

const buildSpokenAnswerPrompt = (questionText) =>
  `You are an expert interviewer. Listen to the candidate's spoken answer in the attached audio.

Interview question: ${questionText}

Rules:
- If they only read the question aloud (no real answer), give Score 1 or 2.
- Evaluate relevance, technical accuracy, and communication.
- Keep Feedback under 100 words.

Reply EXACTLY in this format:
Feedback: <your feedback>
Score: <integer 1-10>
Areas for Improvement: <one short line>`;

const legacyEvaluateSpokenMedia = async (question, mediaBase64, mimeType) => {
  question.answerText = VIDEO_ANSWER_PLACEHOLDER;
  question.audioAnswer = null;

  const cleanBase64 = mediaBase64.includes(';base64,')
    ? mediaBase64.split(';base64,').pop()
    : mediaBase64;

  const ragBlock = await buildRetrievedBlock(question);
  const multimodalPrompt = [
    { inlineData: { data: cleanBase64, mimeType } },
    ...(ragBlock ? [ragBlock] : []),
    buildSpokenAnswerPrompt(question.questionText),
  ];

  const model = getLegacyGeminiModel();
  const result = await legacyGenerateWithTimeout(model, multimodalPrompt, 15000);
  const text = result.response.text();
  const parsed = parseFeedbackAndScore(text);
  question.feedback = parsed.feedback;
  question.score = parsed.score;
};

// ---------------------------------------------------------------------------
// Core evaluation functions using the new LLM layer
// ---------------------------------------------------------------------------

const evaluateTextAnswer = async (question, answerText, role, speechMetrics) => {
  question.answerText = answerText;
  question.audioAnswer = null;

  const ragContext = await buildRetrievedBlock(question);
  const messages = textAnswerPrompt.buildPrompt(question, answerText, role, ragContext, speechMetrics);

  const result = await llm.generate({
    task: 'fast',
    messages,
    json: true,
    schema: feedbackSchema,
    safeDefault: SAFE_FEEDBACK_DEFAULT,
  });

  question.feedback = result.feedback;
  question.score = result.score;
  question.improvements = result.improvements || [];
};

const evaluateCodeAnswer = async (question, codeAnswer, language, role, testSummary = null) => {
  question.codeAnswer = codeAnswer;
  question.programmingLanguage = language;

  const ragContext = await buildRetrievedBlock(question);
  const messages = codeAnswerPrompt.buildPrompt(question, codeAnswer, language, role, ragContext, testSummary);

  const result = await llm.generate({
    task: 'fast',
    messages,
    json: true,
    schema: codeFeedbackSchema,
    safeDefault: SAFE_CODE_FEEDBACK_DEFAULT,
  });

  const passRate = testSummary && typeof testSummary.passRate === 'number' ? testSummary.passRate : null;
  const weightedScore = codeAnswerPrompt.calculateWeightedCodeScore(passRate, result.codeScore);

  question.feedback = result.feedback;
  question.score = weightedScore;
  question.codeFeedback = result.codeFeedback;
  question.codeScore = weightedScore;
  question.improvements = result.improvements || [];
};

const evaluateAudioAnswerLegacy = async (question, audioAnswer) => {
  let mimeType = 'audio/webm';
  const dataUrlMatch = String(audioAnswer).match(/^data:([^;]+);base64,/);
  if (dataUrlMatch) mimeType = dataUrlMatch[1];
  await legacyEvaluateSpokenMedia(question, audioAnswer, mimeType);
};

const evaluateVideoAnswerLegacy = async (question, videoAnswer) => {
  await legacyEvaluateSpokenMedia(question, videoAnswer, 'video/webm');
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// @route POST /api/interviews
// @desc  Start a new interview
// @access Private
router.post('/', auth, async (req, res) => {
  try {
    const { role, programmingLanguage } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Phase 2: Validate session config with Zod
    const configResult = interviewConfigSchema.safeParse(req.body.config || {});
    if (!configResult.success) {
      return res.status(400).json({
        error: 'Invalid interview configuration',
        details: configResult.error.flatten(),
      });
    }
    const config = configResult.data;

    const userPastHistory = await getUserPastQuestionHistory(req.user.id);

    // Initial question difficulty: adaptive starts with easy, or explicit target difficulty
    const targetDifficulty = config.difficulty === 'adaptive' ? 'easy' : config.difficulty;

    let firstQuestionObj = null;
    let effectiveMode = config.mode;

    // Check if resume question should be generated first
    const hasResume = Boolean(config.resumeText && config.resumeText.trim());
    if (hasResume && (config.resumeMode === 'pure' || config.resumeMode === 'mix')) {
      firstQuestionObj = await generateResumeQuestion(config.resumeText, role, []);
    }

    if (!firstQuestionObj) {
      firstQuestionObj = await selectBestQuestion({
        role,
        targetDifficulty,
        mode: effectiveMode,
        patterns: config.patterns,
        company: config.company,
        seenKeys: new Set([...userPastHistory.seenKeys]),
        preferredTopics: userPastHistory.topics,
        recentTopics: [],
      });
    }

    console.log(`[Interview] First question selection - role: ${role}, mode: ${effectiveMode}, found: ${firstQuestionObj ? 'yes' : 'no'}`);
    if (firstQuestionObj) {
      console.log(`[Interview] First question: ${firstQuestionObj.title}, isCodingProblem: ${firstQuestionObj.isCodingProblem}`);
    }

    // Fallback: if DSA mode yields no questions for this role, fall back to mixed mode
    if (!firstQuestionObj && effectiveMode === 'dsa') {
      console.warn(`[Interview] No DSA questions found for role "${role}", falling back to mixed mode`);
      effectiveMode = 'mixed';
      firstQuestionObj = await selectBestQuestion({
        role,
        targetDifficulty,
        mode: effectiveMode,
        patterns: config.patterns,
        company: config.company,
        seenKeys: new Set([...userPastHistory.seenKeys]),
        preferredTopics: userPastHistory.topics,
        recentTopics: [],
      });
    }

    if (!firstQuestionObj) {
      return res.status(404).json({ error: 'No questions found in the Question Bank matching the criteria.' });
    }

    // Use effective mode (may have fallen back from DSA to mixed)
    const finalConfig = { ...config, mode: effectiveMode };

    // Dynamic AI welcome intro that breaks the ice and asks the user to introduce themselves
    const roleTitle = role.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const companyMention = config.company ? ` at ${config.company}` : '';
    const welcomeIntroText = `Welcome! I'll be your interviewer today for the ${roleTitle} position${companyMention}. To kick things off, could you briefly introduce yourself and share a bit about your background and recent work?`;

    const newInterview = new Interview({
      user: req.user.id,
      role,
      programmingLanguage: programmingLanguage,
      config: finalConfig,
      status: 'active',
      startedAt: new Date(),
      turns: [
        {
          speaker: 'ai',
          type: 'question',
          text: welcomeIntroText,
          questionRef: 'intro',
          createdAt: new Date(),
        },
      ],
      questions: [
        {
          questionId: 'intro',
          title: 'Introduction',
          questionText: welcomeIntroText,
          answerText: null,
          feedback: "Welcome to your interview practice! Let's begin.",
          score: null,
          topic: 'Introduction & Background',
          isCodingProblem: false,
          normalizedTitle: 'Introduction',
          patterns: [],
        },
        {
          questionId: firstQuestionObj.questionId || null,
          title: firstQuestionObj.title || null,
          questionText: firstQuestionObj.questionText,
          answerText: null,
          feedback: null,
          score: null,
          topic: firstQuestionObj.topic,
          // Phase 1 & 2: copy metadata from QuestionBank
          isCodingProblem: !!firstQuestionObj.isCodingProblem,
          normalizedTitle: firstQuestionObj.normalizedTitle || null,
          patterns: firstQuestionObj.patterns || [],
        },
      ],
      date: new Date(),
    });

    const interview = await newInterview.save();

    await User.findByIdAndUpdate(
      req.user.id,
      { $push: { interviews: interview._id } },
      { new: true }
    );

    res.json(sanitizeInterviewForResponse(interview));
  } catch (err) {
    console.error('Error starting interview:', err.message);

    if (process.env.NODE_ENV !== 'production' && isQuotaOrRateLimitError(err)) {
      try {
        console.warn('Using built-in fallback interview (dev, quota exceeded).');
        const { role, programmingLanguage } = req.body;
        const interview = await createDevFallbackInterview(req.user.id, role, programmingLanguage);
        return res.json(sanitizeInterviewForResponse(interview));
      } catch (fallbackErr) {
        console.error('Dev fallback interview failed:', fallbackErr.message);
      }
    }

    if (isQuotaOrRateLimitError(err)) {
      return res.status(429).json({
        error: 'AI quota exceeded. Please try again later or check your API key.',
        code: 'AI_QUOTA_EXCEEDED',
      });
    }

    return res.status(500).json({ error: 'Server Error', details: err.message });
  }
});

// @route POST /api/interviews/:interview_id/turn
// @desc  Submit candidate turn and receive adaptive interviewer reply
// @access Private
router.post('/:interview_id/turn', auth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interview_id);
    if (!interview) {
      return res.status(404).json({ msg: 'Interview not found' });
    }

    if (interview.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { text, metrics, code, language, questionIndex: clientQIndex } = req.body;
    const questionIndex = typeof clientQIndex === 'number'
      ? clientQIndex
      : Math.max(0, (interview.questions || []).length - 1);

    const question = interview.questions[questionIndex];

    // Record candidate turn in session turns array
    if (!Array.isArray(interview.turns)) interview.turns = [];
    interview.turns.push({
      speaker: 'candidate',
      type: 'answer',
      text: text || code || '[Spoken answer recorded]',
      questionRef: question?.questionId || null,
      createdAt: new Date(),
      metrics: {
        wpm: typeof metrics?.wpm === 'number' ? metrics.wpm : null,
        fillerWordsCount: typeof metrics?.fillerWordsCount === 'number' ? metrics.fillerWordsCount : null,
        responseMs: typeof metrics?.responseMs === 'number' ? metrics.responseMs : null,
      },
    });

    const isStreamRequested =
      req.headers.accept === 'text/event-stream' ||
      req.body?.stream === true ||
      req.query?.stream === 'true' ||
      req.query?.stream === '1';

    let sendSseEvent = null;
    if (isStreamRequested) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      sendSseEvent = (eventName, data) => {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      };
    }

    // Evaluate turn using adaptive engine (streaming or standard)
    const turnOpts = {
      interview,
      questionIndex,
      text: text || '',
      code: code || '',
      language: language || interview.programmingLanguage || '',
      metrics: metrics || {},
    };

    let decision;
    if (isStreamRequested) {
      decision = await evaluateTurnStream({
        ...turnOpts,
        onToken: (delta) => sendSseEvent('token', { delta }),
      });
    } else {
      decision = await evaluateTurn(turnOpts);
    }

    // Save answer text, code, feedback and score on question document
    if (question) {
      if (text) {
        question.answerText = question.answerText ? `${question.answerText}\n${text}` : text;
      }
      if (code) {
        question.codeAnswer = code;
        question.programmingLanguage = language || interview.programmingLanguage || null;
      }
      if (decision.message) {
        question.feedback = decision.message;
      }
      if (decision.signals) {
        question.signals = {
          correctness: decision.signals.correctness ?? 5,
          depth: decision.signals.depth ?? 5,
          clarity: decision.signals.clarity ?? 5,
        };
      }
      if (typeof decision.score === 'number') {
        // Solution 4: Deduct 1 pt penalty if hints were used during this question
        const hintsUsed = (interview.turns || []).filter(
          (t) => t.speaker === 'ai' && t.type === 'hint' && (t.questionRef === question?.questionId || !t.questionRef)
        ).length;
        const adjustedScore = Math.max(1, decision.score - Math.min(2, hintsUsed));

        question.score = adjustedScore;
        if (question.isCodingProblem) question.codeScore = adjustedScore;
      }
    }

    const maxQuestions = interview.config?.maxQuestions || MAX_QUESTIONS;

    // Handle resulting adaptive action
    if (decision.action === 'followup' || decision.action === 'hint') {
      interview.turns.push({
        speaker: 'ai',
        type: decision.action,
        text: decision.message,
        questionRef: question?.questionId || null,
        createdAt: new Date(),
      });
    } else if (decision.action === 'next') {
      interview.turns.push({
        speaker: 'ai',
        type: 'system',
        text: decision.message,
        questionRef: question?.questionId || null,
        createdAt: new Date(),
      });

      // Update dynamic adaptive difficulty
      if (interview.config?.difficulty === 'adaptive') {
        const { newDifficulty, newStreak } = computeAdaptedDifficulty(
          interview.runningDifficulty || 'easy',
          decision.score,
          interview.performanceStreak || 0
        );
        interview.runningDifficulty = newDifficulty;
        interview.performanceStreak = newStreak;
      }

        // Check if session has reached max questions (if maxQuestions is 0, endless dynamic mode is enabled)
        const isEndlessMode = maxQuestions === 0;
        if (!isEndlessMode && interview.questions.length >= maxQuestions) {
          decision.action = 'wrap_up';
          decision.message = "Thank you so much for your time and thoughtful responses today! That completes all parts of our interview. I am now compiling your comprehensive performance assessment and feedback report.";
          interview.status = 'completing';
          generateInterviewReport(interview._id).catch((err) =>
            console.error('Background report generation failed:', err)
          );
        } else {
          // Select next adaptive question (checking if resume questions should be interleaved)
          let nextQuestionObj = null;
          const currentTargetDiff = interview.config?.difficulty === 'adaptive'
            ? (interview.runningDifficulty || 'medium')
            : (interview.config?.difficulty || 'medium');

          const currentQuestionTexts = interview.questions.map((q) => q.questionText);
          const currentTopics = interview.questions.map((q) => q.topic).filter(Boolean);
          const pastQuestionHistory = await getUserPastQuestionHistory(req.user.id);

          const hasResumeConfig = Boolean(interview.config?.resumeText && interview.config.resumeText.trim());
          const resumeMode = interview.config?.resumeMode || 'none';

          // In pure resume mode, always generate from resume; in mix mode, alternate or 50%
          if (hasResumeConfig && (resumeMode === 'pure' || (resumeMode === 'mix' && interview.questions.length % 2 === 1))) {
            nextQuestionObj = await generateResumeQuestion(
              interview.config.resumeText,
              interview.role,
              currentQuestionTexts
            );
          }

          if (!nextQuestionObj) {
            console.log(`[Interview] Selecting next question - role: ${interview.role}, mode: ${interview.config?.mode}, targetDiff: ${currentTargetDiff}`);
            nextQuestionObj = await selectBestQuestion({
              role: interview.role,
              targetDifficulty: currentTargetDiff,
              mode: interview.config?.mode,
              patterns: interview.config?.patterns,
              company: interview.config?.company,
              seenKeys: new Set([
                ...pastQuestionHistory.seenKeys,
                ...currentQuestionTexts.map((t) => t.toLowerCase().trim()),
                ...currentTopics.map((t) => t.toLowerCase().trim()),
              ]),
              preferredTopics: currentTopics.length > 0 ? currentTopics : pastQuestionHistory.topics,
              recentTopics: currentTopics,
            });
            console.log(`[Interview] Next question found: ${nextQuestionObj ? 'yes' : 'no'}`);
            if (nextQuestionObj) {
              console.log(`[Interview] Next question: ${nextQuestionObj.title}, isCodingProblem: ${nextQuestionObj.isCodingProblem}`);
            }
          }

          if (nextQuestionObj) {
            // Clean question text and avoid prepending transition phrases to coding challenges
            let cleanQuestionPrompt = (nextQuestionObj.questionText || '')
              .replace(/\[CODING_PROBLEM\]/gi, '')
              .trim();

            const isCoding = !!nextQuestionObj.isCodingProblem;

            // Notice: The AI interviewer already responds with conversational feedback/acknowledgment
            // (e.g. decision.message) when evaluating candidate turns. To avoid repetitive double-acknowledgments
            // ("Understood...", "Interesting points..."), keep the new question's prompt statement clean and direct.
            const newQuestion = {
              questionId: nextQuestionObj.questionId || null,
              title: nextQuestionObj.title || null,
              questionText: cleanQuestionPrompt,
              answerText: null,
              feedback: null,
              score: null,
              codeAnswer: null,
              programmingLanguage: null,
              codeFeedback: null,
              codeScore: null,
              audioAnswer: null,
              topic: nextQuestionObj.topic,
              isCodingProblem: isCoding,
              normalizedTitle: nextQuestionObj.normalizedTitle || null,
              patterns: nextQuestionObj.patterns || [],
            };
            interview.questions.push(newQuestion);

          interview.turns.push({
            speaker: 'ai',
            type: 'question',
            text: newQuestion.questionText,
            questionRef: newQuestion.questionId || null,
            createdAt: new Date(),
          });
        }
      }
    } else if (decision.action === 'wrap_up') {
      interview.turns.push({
        speaker: 'ai',
        type: 'system',
        text: decision.message,
        questionRef: question?.questionId || null,
        createdAt: new Date(),
      });

      interview.status = 'completing';
      generateInterviewReport(interview._id).catch((err) =>
        console.error('Background report generation failed:', err)
      );
    }

    await interview.save();

    const responsePayload = {
      action: decision.action,
      message: decision.message,
      score: decision.score,
      signals: decision.signals,
      interview: sanitizeInterviewForResponse(interview),
    };

    if (isStreamRequested && sendSseEvent) {
      sendSseEvent('completion', responsePayload);
      res.end();
    } else {
      res.json(responsePayload);
    }
  } catch (err) {
    console.error('Error in /:interview_id/turn:', err);
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ msg: 'Turn evaluation error', details: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ msg: 'Turn evaluation error', details: err.message });
    }
  }
});

// @route POST /api/interviews/:interview_id/finish
// @desc  Initiate background report generation and wrap up interview
// @access Private
router.post('/:interview_id/finish', auth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interview_id);
    if (!interview) {
      return res.status(404).json({ msg: 'Interview not found' });
    }

    if (interview.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    interview.status = 'completing';
    await interview.save();

    // Trigger async report compilation
    generateInterviewReport(interview._id).catch((err) => {
      console.error('Background report generation error:', err);
    });

    res.json({
      msg: 'Report generation initiated',
      status: 'completing',
      interviewId: interview._id,
    });
  } catch (err) {
    console.error('Error in /:interview_id/finish:', err);
    res.status(500).json({ msg: 'Finish error', details: err.message });
  }
});

// @route POST /api/interviews/:interview_id/answer
// @desc  Submit an answer for a question
// @access Private
router.post('/:interview_id/answer', auth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interview_id);
    if (!interview) {
      return res.status(404).json({ msg: 'Interview not found' });
    }

    // Ownership check
    if (interview.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const {
      questionIndex,
      answerText,
      codeAnswer,
      programmingLanguage,
      videoAnswer,
      audioAnswer,
      wpm,
      fillerWordsCount,
    } = req.body;

    if (questionIndex === undefined || questionIndex >= interview.questions.length) {
      return res.status(400).json({ msg: 'Invalid question index' });
    }

    const question = interview.questions[questionIndex];

    // Save speech metrics if provided
    if (typeof wpm === 'number') question.wpm = wpm;
    if (typeof fillerWordsCount === 'number') question.fillerWordsCount = fillerWordsCount;

    const speechMetrics = {
      wpm: typeof wpm === 'number' ? wpm : null,
      fillerWordsCount: typeof fillerWordsCount === 'number' ? fillerWordsCount : null,
    };

    const isCoding = isCodingQuestion(question);

    // --- Evaluate answer ---
    if (isCoding) {
      if (!codeAnswer || !programmingLanguage) {
        return res.status(400).json({ msg: 'Code answer and programming language are required for coding questions' });
      }
      await evaluateCodeAnswer(question, codeAnswer, programmingLanguage, interview.role, req.body.testSummary);

    } else if (LEGACY_MEDIA_EVAL && audioAnswer) {
      // Legacy path: send raw audio blob to Gemini multimodal
      if (typeof audioAnswer !== 'string' || audioAnswer.length > 6 * 1024 * 1024) {
        return res.status(400).json({ msg: 'Recording is too large. Max ~30 seconds.' });
      }
      await evaluateAudioAnswerLegacy(question, audioAnswer);

    } else if (LEGACY_MEDIA_EVAL && videoAnswer) {
      // Legacy path: send raw video blob to Gemini multimodal
      if (typeof videoAnswer !== 'string' || videoAnswer.length > 14 * 1024 * 1024) {
        return res.status(400).json({ msg: 'Video answer is too large. Max ~30 seconds.' });
      }
      await evaluateVideoAnswerLegacy(question, videoAnswer);

    } else if (answerText) {
      // Standard path (also used when frontend sends transcript instead of media blob)
      await evaluateTextAnswer(question, answerText, interview.role, speechMetrics);

    } else {
      return res.status(400).json({ msg: 'Answer text is required. Audio/video should be transcribed before submission unless LEGACY_MEDIA_EVAL is enabled.' });
    }

    // Phase 2: Record candidate turn in turns array
    if (!Array.isArray(interview.turns)) interview.turns = [];
    interview.turns.push({
      speaker: 'candidate',
      type: 'answer',
      text: answerText || codeAnswer || '[Spoken answer recorded]',
      questionRef: question.questionId || null,
      createdAt: new Date(),
      metrics: {
        wpm: typeof wpm === 'number' ? wpm : null,
        fillerWordsCount: typeof fillerWordsCount === 'number' ? fillerWordsCount : null,
        responseMs: typeof req.body.responseMs === 'number' ? req.body.responseMs : null,
      },
    });

    const sessionMaxQuestions = interview.config?.maxQuestions || MAX_QUESTIONS;

    // --- Overall feedback when session reaches configured max questions ---
    if (questionIndex === sessionMaxQuestions - 1) {
      const answeredQuestions = interview.questions.filter(
        (q) => q.answerText || q.codeAnswer
      );
      const totalScore = answeredQuestions.reduce((sum, q) => {
        const score = isCodingQuestion(q) ? (q.codeScore ?? q.score) : q.score;
        return sum + (score || 0);
      }, 0);
      interview.overallScore = answeredQuestions.length > 0
        ? Math.round(totalScore / answeredQuestions.length)
        : 0;

      // Generate overall feedback using LLM_MODEL_STRONG
      const overallMessages = overallFeedbackPromptBuilder.buildPrompt(
        interview.role,
        interview.questions.slice(0, sessionMaxQuestions)
      );
      const overallResult = await llm.generate({
        task: 'strong',
        messages: overallMessages,
        json: true,
        schema: overallFeedbackSchema,
        safeDefault: SAFE_OVERALL_DEFAULT,
      });

      interview.overallScore = overallResult.overallScore ?? interview.overallScore;
      interview.overallFeedback = overallResult.overallFeedback;
      interview.status = 'completed';
      interview.endedAt = new Date();
    }

    await interview.save();

    // --- Select next question (if not done yet) ---
    if (interview.questions.length < sessionMaxQuestions) {
      try {
        const nextIndex = interview.questions.length;
        let targetDifficulty = 'medium';
        if (nextIndex >= 3) targetDifficulty = 'hard';

        // Respect config difficulty if explicitly set (easy/medium/hard)
        if (interview.config?.difficulty && interview.config.difficulty !== 'adaptive') {
          targetDifficulty = interview.config.difficulty;
        }

        const currentQuestionTexts = interview.questions.map((q) => q.questionText);
        const currentTopics = interview.questions.map((q) => q.topic).filter(Boolean);
        const pastQuestionHistory = await getUserPastQuestionHistory(req.user.id);

        const nextQuestionObj = await selectBestQuestion({
          role: interview.role,
          targetDifficulty,
          mode: interview.config?.mode,
          patterns: interview.config?.patterns,
          company: interview.config?.company || interview.company,
          seenKeys: new Set([
            ...pastQuestionHistory.seenKeys,
            ...currentQuestionTexts.map((t) => t.toLowerCase().trim()),
            ...currentTopics.map((t) => t.toLowerCase().trim()),
          ]),
          preferredTopics: currentTopics.length > 0 ? currentTopics : pastQuestionHistory.topics,
          recentTopics: currentTopics,
        });

        if (!nextQuestionObj) {
          throw new Error('No available questions found in the Question Bank.');
        }

        // Phase 1 & 2: copy metadata
        const newQuestion = {
          questionId: nextQuestionObj.questionId || null,
          questionText: nextQuestionObj.questionText,
          answerText: null,
          feedback: null,
          score: null,
          codeAnswer: null,
          programmingLanguage: null,
          codeFeedback: null,
          codeScore: null,
          audioAnswer: null,
          topic: nextQuestionObj.topic,
          isCodingProblem: !!nextQuestionObj.isCodingProblem,
          normalizedTitle: nextQuestionObj.normalizedTitle || null,
          patterns: nextQuestionObj.patterns || [],
        };
        interview.questions.push(newQuestion);

        // Record AI question turn
        interview.turns.push({
          speaker: 'ai',
          type: 'question',
          text: newQuestion.questionText,
          questionRef: newQuestion.questionId || null,
          createdAt: new Date(),
        });

        await interview.save();
      } catch (generateErr) {
        console.error('Error selecting next question:', generateErr.message);
        interview.questions.push({
          questionId: null,
          questionText: 'Could not generate the next question.',
          answerText: null,
          feedback: 'Failed to select next question. Please try again later.',
          score: null,
          codeAnswer: null,
          programmingLanguage: null,
          codeFeedback: null,
          codeScore: null,
          audioAnswer: null,
        });
        await interview.save();
      }
    }

    // Remove legacy video blobs from MongoDB
    const unsetPaths = {};
    interview.questions.forEach((q, i) => {
      if (q.videoAnswer) {
        unsetPaths[`questions.${i}.videoAnswer`] = '';
        if (!q.answerText) q.answerText = VIDEO_ANSWER_PLACEHOLDER;
      }
    });
    if (Object.keys(unsetPaths).length > 0) {
      await Interview.updateOne({ _id: interview._id }, { $unset: unsetPaths });
    }
    await interview.save();

    res.json(sanitizeInterviewForResponse(interview));
  } catch (err) {
    console.error('Error in /:interview_id/answer:', err);
    if (err?.status === 503 || /overloaded|busy/i.test(err?.message || '')) {
      return res.status(503).json({ msg: 'AI service is currently busy. Please try again in a moment.' });
    }
    res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

// Error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('Unhandled error in /api/interviews:', err);
  res.status(500).json({ msg: 'An unexpected server error occurred', details: err.message });
});

// @route GET /api/interviews/user
// @desc  Get all interviews for the authenticated user
// @access Private
router.get('/user', auth, async (req, res) => {
  console.log('GET /api/interviews/user called');
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const interviews = await Interview.find({ user: req.user.id })
      .select('-questions')
      .sort({ date: -1 });

    res.json(interviews);
  } catch (err) {
    console.error('Error fetching user interviews:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route GET /api/interviews/coding-problem/:questionId
// @desc  Get coding problem test cases and function signature (Phase 4)
// @access Private
router.get('/coding-problem/:questionId', auth, async (req, res) => {
  try {
    let details = await CodingProblemDetails.findOne({ questionId: req.params.questionId }).lean();
    if (!details) {
      const qb = await QuestionBank.findOne({ questionId: req.params.questionId }).lean();
      if (qb?.normalizedTitle) {
        details = await CodingProblemDetails.findOne({
          $or: [{ questionId: qb.questionId }, { title: qb.title }]
        }).lean();
      }
    }

    if (!details) {
      return res.status(404).json({ msg: 'Coding problem details not found' });
    }

    res.json(details);
  } catch (err) {
    console.error('Error fetching coding details:', err);
    res.status(500).json({ error: 'Server Error', details: err.message });
  }
});

// @route GET /api/interviews/:interview_id
// @desc  Get interview details
// @access Private
router.get('/:interview_id', auth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interview_id);

    if (!interview) {
      return res.status(404).json({ msg: 'Interview not found' });
    }

    // Phase 1: ownership check (was a TODO)
    if (interview.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(sanitizeInterviewForResponse(interview));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error', details: err.message });
  }
});

// @route DELETE /api/interviews/:interview_id
// @desc  Delete an interview
// @access Private
router.delete('/:interview_id', auth, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interview_id);

    if (!interview) {
      return res.status(404).json({ msg: 'Interview not found' });
    }

    if (interview.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await User.findByIdAndUpdate(req.user.id, { $pull: { interviews: interview._id } });
    await interview.deleteOne();

    res.json({ msg: 'Interview removed' });
  } catch (err) {
    console.error('Error deleting interview:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
