/**
 * Client-Side Test Case Code Runner (Phase 4)
 *
 * Runs test cases client-side inside a sandboxed Web Worker (JS/TS) or Pyodide (Python)
 * with per-test timeouts and deep equality verification.
 * Automatically obfuscates hidden test case inputs and expected outputs.
 */

export interface TestCase {
  input: string;
  expected: string;
  hidden?: boolean;
}

export interface TestCaseResult {
  testIndex: number;
  passed: boolean;
  hidden: boolean;
  input: string;
  expected: string;
  actual: string;
  error?: string | null;
  executionTimeMs: number;
}

export interface TestRunSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number; // 0.0 to 1.0
  results: TestCaseResult[];
  failedNotes?: string;
}

/**
 * Deep equality helper for comparing actual vs expected outputs.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) {
    if (String(a).trim() === String(b).trim()) return true;
    return false;
  }

  if (a === null || b === null || typeof a !== 'object') {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Parse JSON safely, falling back to raw string.
 */
function safeParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    const trimmed = String(str).trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
    return trimmed;
  }
}

/**
 * Direct evaluation fallback if Web Worker creation is disallowed by browser CSP.
 */
function runInThread(code: string, fnName: string, inputStr: string): any {
  const fnFactory = new Function(
    code +
      "\n; return (typeof " +
      fnName +
      " === 'function' ? " +
      fnName +
      " : (globalThis." +
      fnName +
      " || null));"
  );
  const targetFn = fnFactory();

  if (typeof targetFn !== 'function') {
    throw new Error(
      "Function '" + fnName + "' is not defined. Ensure your solution function is named '" + fnName + "'."
    );
  }

  let args = [];
  try {
    args = JSON.parse(inputStr);
    if (!Array.isArray(args)) args = [args];
  } catch {
    args = [inputStr];
  }

  return targetFn.apply(null, args);
}

/**
 * Executes test cases for JavaScript and TypeScript.
 * Uses Web Worker first for timeout isolation; gracefully falls back to in-thread runner.
 */
export async function runJavaScriptTestCases(
  code: string,
  entryFunctionName: string,
  testCases: TestCase[],
  timeoutMs = 3000
): Promise<TestRunSummary> {
  const results: TestCaseResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const isHidden = !!tc.hidden;
    const startMs = performance.now();

    let worker: Worker | null = null;
    let workerUrl: string | null = null;

    try {
      const workerScript = `
        self.onmessage = function(e) {
          const { code, fnName, inputStr } = e.data;
          try {
            const fnFactory = new Function(code + "\\n; return (typeof " + fnName + " === 'function' ? " + fnName + " : (globalThis." + fnName + " || null));");
            const targetFn = fnFactory();

            if (typeof targetFn !== 'function') {
              throw new Error("Function '" + fnName + "' is not defined. Ensure your function is named '" + fnName + "'.");
            }

            let args = [];
            try {
              args = JSON.parse(inputStr);
              if (!Array.isArray(args)) args = [args];
            } catch {
              args = [inputStr];
            }

            const result = targetFn.apply(null, args);
            self.postMessage({ ok: true, output: JSON.stringify(result) });
          } catch (err) {
            self.postMessage({ ok: false, error: err.message || String(err) });
          }
        };
      `;

      let outcome: { ok: boolean; output?: string; error?: string };

      try {
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        const activeWorker = new Worker(workerUrl);
        worker = activeWorker;

        outcome = await new Promise<{ ok: boolean; output?: string; error?: string }>((resolve) => {
          const timer = setTimeout(() => {
            activeWorker.terminate();
            resolve({ ok: false, error: `Test case timed out after ${timeoutMs}ms (infinite loop prevention)` });
          }, timeoutMs);

          activeWorker.onmessage = (e) => {
            clearTimeout(timer);
            activeWorker.terminate();
            resolve(e.data);
          };

          activeWorker.onerror = (err) => {
            clearTimeout(timer);
            activeWorker.terminate();
            resolve({ ok: false, error: err.message || 'Worker execution error' });
          };

          activeWorker.postMessage({
            code,
            fnName: entryFunctionName || 'solution',
            inputStr: tc.input,
          });
        });
      } catch (workerInitErr) {
        // Fallback to in-thread direct evaluation
        try {
          const res = runInThread(code, entryFunctionName || 'solution', tc.input);
          outcome = { ok: true, output: JSON.stringify(res) };
        } catch (threadErr: any) {
          outcome = { ok: false, error: threadErr.message || String(threadErr) };
        }
      } finally {
        if (workerUrl) URL.revokeObjectURL(workerUrl);
      }

      const elapsed = Math.round(performance.now() - startMs);

      if (!outcome.ok) {
        results.push({
          testIndex: i + 1,
          passed: false,
          hidden: isHidden,
          input: isHidden ? '[Hidden Test Case]' : tc.input,
          expected: isHidden ? '[Hidden]' : tc.expected,
          actual: '[Runtime Error]',
          error: outcome.error,
          executionTimeMs: elapsed,
        });
        continue;
      }

      const actualParsed = safeParseJson(outcome.output || '');
      const expectedParsed = safeParseJson(tc.expected);
      const passed = deepEqual(actualParsed, expectedParsed);

      results.push({
        testIndex: i + 1,
        passed,
        hidden: isHidden,
        input: isHidden ? '[Hidden Test Case]' : tc.input,
        expected: isHidden ? '[Hidden]' : tc.expected,
        actual: isHidden ? (passed ? '[Passed]' : '[Failed output]') : JSON.stringify(actualParsed),
        executionTimeMs: elapsed,
      });
    } catch (err: any) {
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      results.push({
        testIndex: i + 1,
        passed: false,
        hidden: isHidden,
        input: isHidden ? '[Hidden Test Case]' : tc.input,
        expected: isHidden ? '[Hidden]' : tc.expected,
        actual: '[Execution Error]',
        error: err.message,
        executionTimeMs: Math.round(performance.now() - startMs),
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const total = results.length;
  const passRate = total > 0 ? passedCount / total : 0;
  const failedResults = results.filter((r) => !r.passed);
  const failedNotes =
    failedResults.length > 0
      ? failedResults
          .map((f) => `Test #${f.testIndex}: ${f.error || `Expected ${f.expected}, got ${f.actual}`}`)
          .join('; ')
      : undefined;

  return {
    totalTests: total,
    passedTests: passedCount,
    failedTests: total - passedCount,
    passRate,
    results,
    failedNotes,
  };
}

/**
 * Executes test cases using Pyodide in-browser Python runtime.
 */
export async function runPythonTestCases(
  pyodide: any,
  code: string,
  entryFunctionName: string,
  testCases: TestCase[]
): Promise<TestRunSummary> {
  const results: TestCaseResult[] = [];

  try {
    pyodide.runPython(code);
  } catch (err: any) {
    return {
      totalTests: testCases.length,
      passedTests: 0,
      failedTests: testCases.length,
      passRate: 0,
      results: testCases.map((tc, idx) => ({
        testIndex: idx + 1,
        passed: false,
        hidden: !!tc.hidden,
        input: tc.hidden ? '[Hidden]' : tc.input,
        expected: tc.hidden ? '[Hidden]' : tc.expected,
        actual: '[Syntax / Import Error]',
        error: err.message || String(err),
        executionTimeMs: 0,
      })),
      failedNotes: `Python Syntax/Definition error: ${err.message}`,
    };
  }

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const isHidden = !!tc.hidden;
    const startMs = performance.now();

    try {
      const harness = `
import json
try:
    _raw_inp = '''${tc.input.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'''
    try:
        _args = json.loads(_raw_inp)
    except Exception:
        _args = [_raw_inp]
    if not isinstance(_args, list):
        _args = [_args]
    _res = ${entryFunctionName || 'solution'}(*_args)
    _res_json = json.dumps(_res)
    _py_err = None
except Exception as _e:
    _res_json = None
    _py_err = str(_e)
`;
      pyodide.runPython(harness);
      const resJson = pyodide.runPython('_res_json');
      const pyErr = pyodide.runPython('_py_err');

      const elapsed = Math.round(performance.now() - startMs);

      if (pyErr) {
        results.push({
          testIndex: i + 1,
          passed: false,
          hidden: isHidden,
          input: isHidden ? '[Hidden Test Case]' : tc.input,
          expected: isHidden ? '[Hidden]' : tc.expected,
          actual: '[Runtime Error]',
          error: String(pyErr),
          executionTimeMs: elapsed,
        });
        continue;
      }

      const actualParsed = safeParseJson(resJson || '');
      const expectedParsed = safeParseJson(tc.expected);
      const passed = deepEqual(actualParsed, expectedParsed);

      results.push({
        testIndex: i + 1,
        passed,
        hidden: isHidden,
        input: isHidden ? '[Hidden Test Case]' : tc.input,
        expected: isHidden ? '[Hidden]' : tc.expected,
        actual: isHidden ? (passed ? '[Passed]' : '[Failed output]') : JSON.stringify(actualParsed),
        executionTimeMs: elapsed,
      });
    } catch (err: any) {
      results.push({
        testIndex: i + 1,
        passed: false,
        hidden: isHidden,
        input: isHidden ? '[Hidden Test Case]' : tc.input,
        expected: isHidden ? '[Hidden]' : tc.expected,
        actual: '[Execution Error]',
        error: err.message,
        executionTimeMs: Math.round(performance.now() - startMs),
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const total = results.length;
  const passRate = total > 0 ? passedCount / total : 0;
  const failedResults = results.filter((r) => !r.passed);
  const failedNotes =
    failedResults.length > 0
      ? failedResults
          .map((f) => `Test #${f.testIndex}: ${f.error || `Expected ${f.expected}, got ${f.actual}`}`)
          .join('; ')
      : undefined;

  return {
    totalTests: total,
    passedTests: passedCount,
    failedTests: total - passedCount,
    passRate,
    results,
    failedNotes,
  };
}
