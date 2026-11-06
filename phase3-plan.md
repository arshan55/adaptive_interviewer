# Phase 3 Implementation Plan — Adaptive Interviewer Loop

## Objectives

1. **Extend `Interview` Model for Report & State Tracking**:
   - Add `report` field to `InterviewSchema`:
     ```js
     report: {
       overallScore: Number,
       strengths: [String],
       weaknesses: [String],
       perQuestionBreakdown: [{
         questionText: String,
         topic: String,
         score: Number,
         feedback: String,
         signals: { clarity: Number, depth: Number, correctness: Number }
       }],
       communicationSummary: {
         averageWpm: Number,
         totalFillerWords: Number,
         paceAssessment: String,
         notes: String
       },
       patternPerformance: [{
         pattern: String,
         score: Number,
         notes: String
       }],
       nextPracticeRecommendations: [String],
       generatedAt: Date
     }
     ```
   - Track running performance metrics on `interview` to power dynamic difficulty adjustment (raise after 2 consecutive strong scores >= 7, lower after 2 consecutive weak scores <= 4).

2. **Adaptive Turn Engine (`backend/services/interviewer/adaptiveEngine.js`)**:
   - Prompt builder with mode-specific personas:
     - **HR Mode**: STAR probing (Situation, Task, Action, Result). Identifies missing STAR components and produces targeted probing follow-ups (at most 2 sentences).
     - **DSA Mode**: Multi-stage (clarify &rarr; approach &rarr; code &rarr; test &rarr; complexity). Escalates hints gently (nudge &rarr; pattern name &rarr; partial approach). Never spoils the direct code solution.
     - **Mixed Mode**: Adapts based on whether current question is a coding question or behavioral question.
   - Enforce hard limits:
     - `MAX_FOLLOWUPS_PER_QUESTION` (env, default 2)
     - `MAX_HINTS_PER_QUESTION` (env, default 2)
     - If follow-up/hint limits are hit, automatically forces action to `'next'` (or `'wrap_up'` if at max questions).
   - Maintain rolling summary of conversation turns + last 4 turns to keep LLM context compact and cost-aware.

3. **`POST /api/interviews/:interview_id/turn` Endpoint**:
   - Request: `{ text, metrics?: { wpm, fillerWordsCount, responseMs }, code?, language? }`
   - Records candidate turn in `interview.turns`.
   - Invokes `adaptiveEngine.evaluateTurn(...)` via `llm.generate({ task: 'fast', json: true })`.
   - Executes returned action:
     - `'followup'` or `'hint'`: records AI turn, updates question metadata.
     - `'next'`: updates running scores, computes adapted difficulty, selects next question via `selectBestQuestion`, and records AI question turn.
     - `'wrap_up'`: triggers completion flow.
   - Returns `{ action, message, score, signals, interview }`.

4. **Background Report Generation (`backend/services/interviewer/reportGenerator.js`) & `POST /:interview_id/finish`**:
   - In-process async worker interface `generateInterviewReport(interviewId)`:
     - Sets status to `'completing'`.
     - Synthesizes all turns, scores, speech metrics, and patterns.
     - Calls `llm.generate({ task: 'strong', json: true })` to compile comprehensive report.
     - Saves `report` onto interview and sets status to `'completed'`.
   - `POST /api/interviews/:interview_id/finish`:
     - Triggers the async generator job immediately and returns `{ status: 'completing' }`.
   - `GET /api/interviews/:interview_id`:
     - Returns current `status` (`'active'`, `'completing'`, `'completed'`) and `report` when available.

5. **Frontend Polling & Service Integration**:
   - Add `submitTurn(interviewId, turnPayload)` and `finishInterview(interviewId)` to `frontend/services/interviewService.ts` and `.js`.
   - Support polling on the frontend when `status === 'completing'`.

6. **Unit Tests (Jest)**:
   - Adaptive difficulty step up/down logic.
   - Follow-up and hint limit enforcement.
   - Mode-specific persona prompt generation.

