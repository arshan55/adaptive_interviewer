'use client';

import { useState, useCallback } from 'react';
import { runJavaScriptTestCases, runPythonTestCases, TestRunSummary, TestCase } from '@/lib/codeRunner';
import { getPyodide } from '@/lib/pyodideLoader';

export interface CodingProblemDetailsState {
  questionId: string;
  title?: string;
  entryFunctionName?: string;
  functionSignature?: Record<string, string>;
  testCases?: Array<{
    input: string;
    expected: string;
    hidden?: boolean;
    description?: string;
  }>;
  hints?: string[];
  rubric?: string[];
}

export function useCodeRunner() {
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [testSummary, setTestSummary] = useState<TestRunSummary | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  const executeCode = useCallback(
    async (
      code: string,
      language: string,
      problemDetails?: CodingProblemDetailsState | null
    ): Promise<TestRunSummary | null> => {
      const lang = (language || 'javascript').toLowerCase();
      setIsRunningCode(true);
      setIsConsoleOpen(true);
      setConsoleOutput('Preparing test execution...');

      try {
        // Fallback default test cases if problemDetails has no test cases loaded
        let testCases: TestCase[] = (problemDetails?.testCases || []).map((t) => ({
          input: t.input,
          expected: t.expected,
          hidden: t.hidden,
        }));

        if (testCases.length === 0) {
          testCases = [
            { input: '[]', expected: '[]' },
            { input: '[1, 2, 3]', expected: '[1, 2, 3]' },
          ];
        }

        // Detect function name from candidate code if not specified or defaulting
        let detectedFn = problemDetails?.entryFunctionName;
        if (!detectedFn) {
          const fnMatch = code.match(/(?:function\s+([a-zA-Z0-9_$]+)|const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\()|def\s+([a-zA-Z0-9_$]+))/);
          if (fnMatch) {
            detectedFn = fnMatch[1] || fnMatch[2] || fnMatch[3];
          }
        }

        const entryFunctionName =
          detectedFn ||
          (lang.includes('python') ? 'solution' : 'solve');

        let summary: TestRunSummary;

        if (lang.includes('python') || lang === 'py') {
          // Dynamic in-browser Python execution via Pyodide
          setConsoleOutput('Loading Python WebAssembly runtime...');
          const pyodideInstance = await getPyodide((status) => {
            setConsoleOutput(`[Python Runtime] ${status}`);
          });

          if (!pyodideInstance) {
            throw new Error(
              'Python browser engine could not be loaded. Please ensure you are connected to the internet, or switch to JavaScript.'
            );
          }

          setConsoleOutput('Executing Python test suite...');
          summary = await runPythonTestCases(pyodideInstance, code, entryFunctionName, testCases);
        } else if (
          lang.includes('javascript') ||
          lang.includes('typescript') ||
          lang === 'js' ||
          lang === 'ts'
        ) {
          // Sandboxed JS/TS execution with Worker + in-thread fallback
          summary = await runJavaScriptTestCases(code, entryFunctionName, testCases);
        } else {
          // Compiled languages (Java, C++, Go, Rust, C#, PHP)
          setConsoleOutput(
            `[${language.toUpperCase()} Execution Note]\n` +
              `• Interactive test runs execute JavaScript, TypeScript, and Python directly inside your browser.\n` +
              `• Compiled solutions written in ${language} are evaluated with full test suites upon clicking "Submit Solution".\n` +
              `• You can write your ${language} solution here and click "Submit Solution" for full rubric scoring, or switch language to JavaScript/Python to test interactively.`
          );

          return {
            totalTests: testCases.length,
            passedTests: 0,
            failedTests: 0,
            passRate: 1.0,
            results: [],
            failedNotes: `Compiled language (${language}) submitted for evaluation.`,
          };
        }

        setTestSummary(summary);

        const outLines: string[] = [
          `Test Results: ${summary.passedTests}/${summary.totalTests} Passed (${Math.round(summary.passRate * 100)}%)`,
        ];

        summary.results.forEach((r) => {
          if (r.hidden) {
            outLines.push(
              `[Hidden Test ${r.testIndex}] ${r.passed ? 'PASSED' : 'FAILED'} (${Math.round(r.executionTimeMs)}ms)`
            );
          } else {
            outLines.push(
              `[Test ${r.testIndex}] ${r.passed ? 'PASSED' : 'FAILED'} (${Math.round(r.executionTimeMs)}ms)` +
                (!r.passed && r.actual !== undefined ? ` | Expected: ${r.expected}, Got: ${r.actual}` : '') +
                (r.error ? ` | Error: ${r.error}` : '')
            );
          }
        });

        if (summary.failedNotes && summary.failedTests > 0) {
          outLines.push(`\nNote: ${summary.failedNotes}`);
        }

        setConsoleOutput(outLines.join('\n'));
        return summary;
      } catch (err: any) {
        const msg = `Execution error: ${err.message || String(err)}`;
        setConsoleOutput(msg);
        return null;
      } finally {
        setIsRunningCode(false);
      }
    },
    []
  );

  const resetCodeRunner = useCallback(() => {
    setTestSummary(null);
    setConsoleOutput('');
    setIsConsoleOpen(false);
  }, []);

  return {
    isRunningCode,
    testSummary,
    consoleOutput,
    isConsoleOpen,
    setIsConsoleOpen,
    executeCode,
    resetCodeRunner,
  };
}
