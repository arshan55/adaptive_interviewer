# Phase 1 Implementation Plan — Foundations, Fixes, Provider Layer

> Status: **AWAITING APPROVAL** — no code has been changed yet.

---

## What I found in the codebase (verified, not assumed)

| Item | Reality |
|------|---------|
| `backend/server.js` | `express.json({ limit: '50mb' })`, CORS origins hardcoded as 4 strings, no helmet, no rate-limit |
| `interviews.js` overall-feedback bug | After every answer, `questions.length - 1` equals `questionIndex` because questions are appended one-at-a-time before the check runs; overall feedback fires on every submit |
| `GET /:interview_id` ownership | Explicit `// TODO` comment — no ownership check |
| Gemini wiring | `retryGenerateContent` → hardcoded fallback list `[GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']` |
| `.env.example` model filter bug | Example says `GOOGLE_AI_MODEL=gemini-2.5-flash`, but runtime code strips any model with `'2.5'` in the name, silently falling back |
| Audio/video to LLM | `audioAnswer` / `videoAnswer` base64 blobs sent to Gemini multimodal |
| `frontend/services/interviewService.js` | 45-line stub; confirmed unused by `page.tsx` (page builds its own axios calls) |
| `isCodingProblem` on QuestionBank | Exists on schema, but **not copied** onto the embedded interview question subdoc |
| Embedding model | `text-embedding-004`, hardcoded in `embeddingsService.js`; env var `GOOGLE_EMBEDDING_MODEL` exists but isn't validated against stored `embeddingModel` field |
| Backend package.json | No `openai`, `helmet`, or `express-rate-limit` packages installed |
| `backend/backend/` dir | Stray nested directory — not part of active code |

---

## Scope for Phase 1

### 1. Fix: overall-feedback bug
**Problem:** After `questions.push(nextQ)`, `interview.questions.length` is already `N+1`, so the last-question check `questionIndex === interview.questions.length - 1` is always true.

**Fix:**  
- Add a `MAX_QUESTIONS` constant (default 5), sourced from `process.env.MAX_QUESTIONS_PER_INTERVIEW`.
- Change the condition to: fire overall feedback **only** when `questionIndex === MAX_QUESTIONS - 1` (zero-indexed), i.e. the last question index the candidate actually answered.
- The next-question fetch already has an `if (questions.length < MAX_QUESTIONS)` guard — keep that consistent.
- Document `MAX_QUESTIONS_PER_INTERVIEW` in `.env.example`.

### 2. Security hardening

| Fix | Approach |
|-----|---------|
| Ownership on `GET /:interview_id` | After `findById`, check `interview.user.toString() !== req.user.id`; return 403 |
| Helmet | `npm install helmet` in backend; `app.use(helmet())` early in `server.js` |
| Rate limiting | `npm install express-rate-limit`; general limiter (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`) + stricter AI limiter (`AI_RATE_LIMIT_MAX`) applied to `/api/interviews` router |
| JSON body limit | Reduce to `2mb`; audio/video will come via transcript text from Phase 1 onward (old path behind `LEGACY_MEDIA_EVAL`) |
| CORS origins | Read `CORS_ORIGINS` env var (comma-separated); fall back to current hardcoded list if not set |

### 3. LLM provider layer — `backend/services/llm/`

```
backend/services/llm/
  index.js              — exports generate() and stream()
  providers/
    groq.js             — uses openai npm package with baseURL
    gemini.js           — wraps existing @google/generative-ai
  schemas/
    feedbackSchema.js   — Zod schema: { score, feedback, improvements[] }
```

**`generate({ task, messages, json, schema, maxTokens, temperature })`**  
- Reads `LLM_PROVIDER_ORDER` (default `"groq,gemini"`)
- Reads `LLM_MODEL_FAST` (for conversation turns) and `LLM_MODEL_STRONG` (for reports/code review)
- Per-call timeout via `Promise.race` (default `LLM_TIMEOUT_MS=10000`)
- On 429/5xx/timeout: exponential backoff, then try next provider
- JSON mode: request JSON from provider; validate with Zod; on invalid JSON do ONE repair retry (re-send with "fix this JSON:" prefix); on failure return a safe default `{ score: 5, feedback: "...", improvements: [] }`
- Log which provider answered (`console.log("[LLM] provider=groq task=textAnswer ms=...")`)

**`stream({ ... })`**  
- Async generator yielding text chunks (Phase 5 uses this; stub it for now returning a single chunk from `generate()`)

**`groq.js`**  
- `npm install openai` (OpenAI-compatible, same package used with `baseURL: 'https://api.groq.com/openai/v1'`)
- Requires `GROQ_API_KEY`
- JSON mode: `response_format: { type: 'json_object' }`

**`gemini.js`**  
- Wraps existing `@google/generative-ai` calls; extracts the retry/timeout logic from `interviews.js`
- JSON mode: `responseMimeType: 'application/json'`

### 4. Prompts refactor — `backend/services/prompts/`

```
backend/services/prompts/
  textAnswer.js       — { buildPrompt(question, answer, role, ragContext) }
  codeAnswer.js       — { buildPrompt(question, code, language, role) }
  overallFeedback.js  — { buildPrompt(role, questionsWithAnswers) }
```

Each exports a `buildPrompt()` function returning a `messages` array.  
All prompts instruct the LLM to respond in JSON: `{ score, feedback, improvements }`.  
Scores are 1–10 integers. Improvements is an array of 2–3 strings. No regex parsing.

### 5. Voice: stop sending audio/video blobs

**Frontend change:**  
- If `NEXT_PUBLIC_LEGACY_MEDIA_EVAL !== 'true'`, the answer submission omits `audioAnswer`/`videoAnswer` and sends only `answerText + wpm + fillerWordsCount` (the page already computes these via Web Speech API).  
- The existing recording UI stays; just don't include the base64 in the POST body.

**Backend change:**  
- In `POST /:interview_id/answer`, the audio/video branch is wrapped: `if (process.env.LEGACY_MEDIA_EVAL === 'true') { ... }` else falls through to text path.  
- Document `LEGACY_MEDIA_EVAL=false` in `.env.example`.

### 6. Embeddings: provider-aware guard

- Add `embeddingModel: String` to `QuestionBank` schema (additive).
- In `embeddingsService.js`: when searching, skip docs where `q.embeddingModel !== activeModel` and log a warning (don't crash).
- Update `scripts/backfillEmbeddings.js`: accepts `--dry-run` flag; logs which docs will be re-embedded.
- Document `EMBEDDINGS_PROVIDER` and `GOOGLE_EMBEDDING_MODEL` in `.env.example`.

### 7. Copy `isCodingProblem` onto interview questions

- In `POST /api/interviews` (first question) and in the `answer` route when fetching the next question: copy `isCodingProblem` and `normalizedTitle` from the `QuestionBank` doc onto the embedded question subdoc.
- Add `isCodingProblem: Boolean` and `normalizedTitle: String` to `QuestionSchema` in `Interview.js`.
- Fallback: if `isCodingProblem` is absent on old data, detect `"[CODING_PROBLEM]"` prefix as before.

### 8. Delete/fix `frontend/services/interviewService.js`

- Confirmed unused by `page.tsx`.
- Replace with a proper typed service (TypeScript) that matches what `page.tsx` actually sends: `startInterview`, `submitAnswer` (with all fields), `getInterviewDetails`.
- **Do not remove the old file until the new one is validated** (rename to `interviewService.ts`, export same function names).

### 9. Unit tests (Jest)

**New files:**
```
backend/__tests__/
  llm.test.js    — provider fallback, JSON repair, timeout
```

Tests (all with mocked `fetch`/`openai`/`@google/generative-ai`):
1. When Groq is first in order and succeeds, Gemini is never called.
2. When Groq returns 429, Gemini is called as fallback.
3. When both providers fail, `generate()` returns the safe default.
4. When response is invalid JSON, one repair is attempted; on second failure, safe default returned.
5. When LLM call exceeds `LLM_TIMEOUT_MS`, it's treated as a failure and fallback is tried.

---

## New env vars (all documented in `backend/.env.example`)

| Var | Default | Purpose |
|-----|---------|---------|-|
| `LLM_PROVIDER_ORDER` | `groq,gemini` | Comma-separated provider chain |
| `LLM_MODEL_FAST` | `llama-3.1-8b-instant` | Groq model for fast turns |
| `LLM_MODEL_STRONG` | `llama-3.3-70b-versatile` | Groq model for reports |
| `GEMINI_MODEL_FAST` | `gemini-2.0-flash-lite` | Gemini fast model |
| `GEMINI_MODEL_STRONG` | `gemini-2.0-flash` | Gemini strong model |
| `GROQ_API_KEY` | _(required if groq in order)_ | Groq API key |
| `LLM_TIMEOUT_MS` | `10000` | Per-call timeout in ms |
| `RATE_LIMIT_WINDOW_MS` | `60000` | General rate-limit window |
| `RATE_LIMIT_MAX` | `100` | General rate-limit max |
| `AI_RATE_LIMIT_MAX` | `20` | AI route rate-limit max |
| `CORS_ORIGINS` | _(falls back to hardcoded list)_ | Comma-separated CORS origins |
| `LEGACY_MEDIA_EVAL` | `false` | Send audio/video blobs to LLM |
| `MAX_QUESTIONS_PER_INTERVIEW` | `5` | Questions per session |
| `EMBEDDINGS_PROVIDER` | `gemini` | Embedding provider |

---

## Files changed in Phase 1

**Backend (new):**
- `backend/services/llm/index.js`
- `backend/services/llm/providers/groq.js`
- `backend/services/llm/providers/gemini.js`
- `backend/services/prompts/textAnswer.js`
- `backend/services/prompts/codeAnswer.js`
- `backend/services/prompts/overallFeedback.js`
- `backend/__tests__/llm.test.js`

**Backend (modified):**
- `backend/server.js` — helmet, rate-limit, JSON limit, CORS from env
- `backend/routes/api/interviews.js` — overall-feedback fix, ownership check, replace inline Gemini with llm layer, voice flag
- `backend/models/Interview.js` — add `isCodingProblem`, `normalizedTitle` to QuestionSchema
- `backend/models/QuestionBank.js` — add `embeddingModel` field
- `backend/services/embeddingsService.js` — model-mismatch guard
- `backend/scripts/backfillEmbeddings.js` — `--dry-run` flag
- `backend/.env.example` — all new vars documented
- `backend/package.json` — add `openai`, `helmet`, `express-rate-limit`, `zod`, `jest`

**Frontend (modified):**
- `frontend/services/interviewService.ts` — rewrite as typed service
- `frontend/app/interview/page.tsx` — omit audio/video from POST unless `LEGACY_MEDIA_EVAL=true`

---

## Risks & Assumptions

> [!WARNING]
> The `GEMINI_MODEL` filter (`!rawConfiguredModel.includes('2.5')`) will be **removed** as part of the provider layer refactor. The new layer reads model names from `GEMINI_MODEL_FAST` / `GEMINI_MODEL_STRONG` with no such filter. This is a breaking change to the env var scheme (old `GOOGLE_AI_MODEL` is deprecated).

> [!NOTE]
> `openai` npm package (Groq client) will be installed in backend. This is a new dependency — I'll flag it explicitly.

> [!NOTE]
> The stray `backend/backend/` directory is not touched (no delete without permission).

> [!NOTE]
> Prisma/PostgreSQL in `frontend/prisma/` is not touched — this phase only modifies the Express/MongoDB backend and the interview page's answer submission.

> [!IMPORTANT]
> Groq's free tier supports JSON mode on most `llama-3.x` models. If `GROQ_API_KEY` is not set, the provider is skipped and Gemini is used. No crash.

---

## How to test manually after Phase 1

1. Set `LLM_PROVIDER_ORDER=groq,gemini` and `GROQ_API_KEY=<your key>` → submit an answer → logs should say `[LLM] provider=groq`.
2. Set `LLM_PROVIDER_ORDER=gemini` → logs should say `[LLM] provider=gemini`.
3. Submit 5 answers for one interview → overall feedback should fire **only after the 5th answer**, not on every answer.
4. Try `GET /api/interviews/<someone-else-id>` → should 403.
5. Run `npm test` in backend → all 5 Jest tests pass.
6. Run `npm run build` in frontend → no TypeScript errors.

