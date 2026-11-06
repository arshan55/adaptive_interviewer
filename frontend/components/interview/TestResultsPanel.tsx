'use client';

import React from 'react';
import { TestRunSummary } from '@/lib/codeRunner';

interface TestResultsPanelProps {
  testSummary: TestRunSummary | null;
  consoleOutput: string;
  isOpen: boolean;
  onToggle: () => void;
  isRunning?: boolean;
}

export const TestResultsPanel: React.FC<TestResultsPanelProps> = ({
  testSummary,
  consoleOutput,
  isOpen,
  onToggle,
  isRunning = false,
}) => {
  return (
    <div className="border-t border-slate-800 bg-slate-950 text-slate-200">
      {/* Header bar with toggle */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Console & Test Results
          </span>
          {testSummary && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                testSummary.failedTests === 0
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  : 'bg-rose-900/60 text-rose-300 border border-rose-700'
              }`}
            >
              {testSummary.passedTests}/{testSummary.totalTests} Passed ({Math.round(testSummary.passRate * 100)}%)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-mono transition-colors"
        >
          <span>{isOpen ? 'Hide' : 'Show'}</span>
          <svg
            className={`w-3.5 h-3.5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable test case cards & console body */}
      {isOpen && (
        <div className="p-4 max-h-72 overflow-y-auto space-y-3 font-mono text-xs">
          {isRunning ? (
            <div className="flex items-center gap-2 text-slate-400 py-4 justify-center">
              <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Running test suite in client sandbox...</span>
            </div>
          ) : testSummary && testSummary.results.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2">
                {testSummary.results.map((res) => (
                  <div
                    key={res.testIndex}
                    className={`p-3 rounded-lg border transition-colors ${
                      res.passed
                        ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold">
                        {res.hidden ? `Hidden Test ${res.testIndex}` : `Test Case ${res.testIndex}`}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          res.passed
                            ? 'bg-emerald-900/80 text-emerald-300'
                            : 'bg-rose-900/80 text-rose-300'
                        }`}
                      >
                        {res.passed ? 'PASSED' : 'FAILED'} ({Math.round(res.executionTimeMs)}ms)
                      </span>
                    </div>

                    {!res.hidden ? (
                      <div className="space-y-1 text-slate-300 text-[11px]">
                        <div>
                          <span className="text-slate-500">Input:</span> {res.input}
                        </div>
                        <div>
                          <span className="text-slate-500">Expected:</span> {res.expected}
                        </div>
                        {res.actual !== undefined && (
                          <div>
                            <span className="text-slate-500">Output:</span> {res.actual}
                          </div>
                        )}
                        {res.error && (
                          <div className="text-rose-400">
                            <span className="font-bold">Error:</span> {res.error}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 italic text-[11px]">
                        Inputs & expected values are hidden to maintain assessment integrity.
                        {res.error && <p className="text-rose-400 not-italic mt-1">Runtime error encountered on test.</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 py-3 text-center">
              {consoleOutput || 'Click "Run Code" to execute test cases against your solution.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
