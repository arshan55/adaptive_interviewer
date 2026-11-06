# Phase 2 Implementation Plan — Session Config, Modes & Pattern-Wise DSA

## Objectives
1. **Extend `Interview` Model (Additive)**:
   - `config`: `{ mode: 'hr' | 'dsa' | 'mixed', patterns: [String], difficulty: 'adaptive' | 'easy' | 'medium' | 'hard', durationMin: Number, maxQuestions: Number, voice: Boolean, company: String | null }`
   - `status`: `'active' | 'completing' | 'completed'`
   - `startedAt`, `endedAt`: Dates
   - `turns`: Array of `{ speaker: 'ai'|'candidate', type: 'question'|'followup'|'hint'|'answer'|'system', text, questionRef, createdAt, metrics: { wpm, fillerWordsCount, responseMs } }`
   - Retain full existing `questions` array for backward compatibility.

2. **Canonical DSA Patterns List**:
   - Create `backend/config/patterns.js` exporting the 21 canonical DSA patterns and helpful helper utilities/mappings:
     `['two-pointers', 'sliding-window', 'fast-slow-pointers', 'binary-search', 'prefix-sum', 'hashing', 'stack/monotonic-stack', 'linked-list', 'tree-dfs', 'tree-bfs', 'graph-bfs/dfs', 'topological-sort', 'union-find', 'heap/top-k', 'intervals', 'backtracking', 'dp-1d', 'dp-2d', 'greedy', 'trie', 'bit-manipulation']`.

3. **QuestionBank Schema & Tagging Script**:
   - Add `patterns: { type: [String], index: true, default: [] }` to `backend/models/QuestionBank.js`.
   - Create `backend/scripts/tagPatterns.js`:
     - Fast deterministic keyword / topic / tag mapping table.
     - Fallback to LLM (`llm.generate`) with batching, rate-limiting, and `--dry-run` flag.
     - Prints summary coverage report.

4. **HR Question Seeding (`backend/scripts/seedHrQuestions.js`)**:
   - Check existing question bank; seed ~60 comprehensive behavioral / HR questions across themes: conflict, leadership, failure, ownership, teamwork, motivation, strengths/weaknesses, and culture fit.
   - Attach detailed STAR rubric notes (`rubricNotes`) per question.

5. **Enhance `selectBestQuestion` in `backend/services/questionRetrieval.js`**:
   - Add support for `mode` (`hr`, `dsa`, `mixed`) and `patterns` filtering:
     - `hr`: filter for behavioral questions (`isCodingProblem: false`, behavioral topics).
     - `dsa`: filter for coding questions (`isCodingProblem: true`) and matching `patterns`.
     - `mixed`: alternate or balance questions.
   - Maintain 100% backward compatibility when no mode/pattern filters are passed.

6. **Update `POST /api/interviews`**:
   - Accept optional `config` object in the body, validate with Zod schema (`configSchema`).
   - Default values preserve legacy behavior (e.g. 5 questions, standard role selection).
   - Initialize `turns` with initial question turn.

7. **Frontend Setup Screen (`frontend/components/interview/SetupModal.tsx` or update role selection flow)**:
   - Allow candidates to configure:
     - Mode: HR / DSA / Mixed
     - Pattern picker (multi-select chip selector for DSA/Mixed)
     - Difficulty: Adaptive (default) / Easy / Medium / Hard
     - Duration & Voice toggle
     - Optional company filter
   - Seamlessly connects with `POST /api/interviews`.

