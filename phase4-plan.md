# Phase 4 Implementation Plan — Real Code Execution with Test Cases

## Objectives

1. **Extend `CodingProblemDetails` Model**:
   - In `backend/models/CodingProblemDetails.js`:
     - Add `testCases: [{ input: String, expected: String, hidden: Boolean }]` (while maintaining compatibility with existing `publicTestCases` / `hiddenTestCases`).
     - Add `functionSignature: { type: Map, of: String }` mapping language key (e.g. `'javascript'`, `'python'`, `'cpp'`) to entry function signature.

2. **Seed Robust Test Cases**:
   - In `backend/scripts/seedCodingProblemDetails.js`:
     - Provide at least 3 visible and 3 hidden test cases for all seeded problems:
       - Valid Parentheses
       - Reverse a Linked List
       - Maximum Depth of Binary Tree
       - Longest Substring Without Repeating Characters
       - Binary Search
       - Number of Islands
       - Coin Change
       - Two Sum
       - LRU Cache
       - Merge k Sorted Lists
       - Custom Array.prototype.filter
     - Include standardized `functionSignature` for JavaScript and Python.

3. **Frontend Test Runner (`frontend/lib/codeRunner.ts`)**:
   - Execute test cases client-side in a sandboxed Web Worker (JavaScript) or Pyodide (Python):
     - Single test case execution with configurable timeout (e.g., 3000ms to catch infinite loops).
     - Deep equality check between actual output and expected output (handling JSON structures, primitives, arrays, booleans).
     - Returns `{ testResults: [{ testIndex, passed, input, expected, actual, hidden, error, executionTimeMs }], totalTests, passedTests, passRate }`.
     - Automatically obfuscates input and expected for hidden test cases.

4. **Optional Server-Side Execution Service (`backend/services/codeRunner.js`)**:
   - Piston-compatible HTTP client for compiled/backend languages (C++, Java, Go, Rust).
   - Only enabled if `CODE_RUNNER_URL` is configured in `.env`.
   - Strictly external HTTP calls with timeouts, output truncation (max 64KB), and safety checks — **never executes user code in the Express process**.

5. **Decouple LLM from Correctness & Weighted Scoring Formula**:
   - Update `backend/services/prompts/codeAnswer.js` to accept test execution summary `{ totalTests, passedTests, passRate, failedTestNotes }`.
   - The LLM focuses strictly on:
     - Algorithm approach & time/space complexity
     - Code cleanliness, readability & idioms
     - Edge case analysis
   - Final Code Score Formula (documented in code):
     ```
     finalScore = Math.round((passRate * 0.70 * 10) + (llmQualityScore * 0.30));
     ```
     - 70% weighted to objective test pass rate
     - 30% weighted to algorithmic quality, complexity & style from LLM
     - If `passRate === 0`, final score capped at 3/10 (cannot score high if code fails completely).

