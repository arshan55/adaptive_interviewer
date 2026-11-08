'use client';

import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { TestResultsPanel } from './TestResultsPanel';
import { TestRunSummary } from '@/lib/codeRunner';
import { Play, CheckCircle2, Terminal, Lightbulb } from 'lucide-react';

interface CodeEditorPanelProps {
  code: string;
  onChange: (value: string) => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  onRunCode: () => void;
  onSubmitSolution: () => void;
  onRequestHint?: () => void;
  hintsRemaining?: number;
  isRunningCode: boolean;
  isSubmitting: boolean;
  testSummary: TestRunSummary | null;
  consoleOutput: string;
  isConsoleOpen: boolean;
  onToggleConsole: () => void;
}

const SUPPORTED_LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Java', value: 'java' },
  { label: 'C++', value: 'cpp' },
  { label: 'Go', value: 'go' },
];

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  code,
  onChange,
  selectedLanguage,
  onLanguageChange,
  onRunCode,
  onSubmitSolution,
  onRequestHint,
  hintsRemaining = 2,
  isRunningCode,
  isSubmitting,
  testSummary,
  consoleOutput,
  isConsoleOpen,
  onToggleConsole,
}) => {
  const handleEditorMount: OnMount = (editor, monaco) => {
    // Add Ctrl+Enter / Cmd+Enter run code keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunCode();
    });
  };

  const normLang = (selectedLanguage || 'javascript').toLowerCase();
  const monacoLang =
    normLang === 'python' || normLang === 'py'
      ? 'python'
      : normLang === 'cpp' || normLang === 'c++'
      ? 'cpp'
      : normLang === 'java'
      ? 'java'
      : normLang === 'go'
      ? 'go'
      : normLang === 'typescript' || normLang === 'ts'
      ? 'typescript'
      : 'javascript';

  const isBrowserExecutable =
    normLang.includes('javascript') ||
    normLang.includes('typescript') ||
    normLang.includes('python') ||
    normLang === 'js' ||
    normLang === 'ts' ||
    normLang === 'py';

  return (
    <div className="rounded-2xl border-4 border-black bg-slate-900 overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 bg-slate-950 border-b-2 border-black gap-3">
        {/* Language selector & execution capability badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="code-lang" className="text-xs font-mono font-bold text-slate-300">
              Language:
            </label>
            <select
              id="code-lang"
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={isSubmitting || isRunningCode}
              className="bg-slate-800 text-white border-2 border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:ring-1 focus:ring-blue-500 cursor-pointer font-bold"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <span
            className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
              isBrowserExecutable
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-indigo-950/80 border-indigo-600 text-indigo-300'
            }`}
          >
            {isBrowserExecutable ? 'In-Browser Test Runner' : 'Server AI Evaluated'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          {onRequestHint && (
            <button
              type="button"
              onClick={onRequestHint}
              disabled={isSubmitting || isRunningCode || hintsRemaining <= 0}
              title={
                hintsRemaining > 0
                  ? `Request AI hint (-1 pt score penalty, ${hintsRemaining} left)`
                  : 'All hints used for this question'
              }
              className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-bold font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                hintsRemaining > 0
                  ? 'bg-amber-300 hover:bg-amber-400 text-black'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-black" />
              <span>Hint ({hintsRemaining}/2)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRunCode}
            disabled={isRunningCode || isSubmitting}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white border-2 border-slate-600 rounded-xl text-xs font-bold font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isRunningCode ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                <span>Run Code (Ctrl+Enter)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onSubmitSolution}
            disabled={isSubmitting || isRunningCode || !code.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl border-2 border-black text-xs font-black font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Submit Solution</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="h-[380px] w-full">
        <Editor
          height="100%"
          language={monacoLang}
          theme="vs-dark"
          value={code}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
          }}
        />
      </div>

      {/* Collapsible Test Results Console */}
      <TestResultsPanel
        testSummary={testSummary}
        consoleOutput={consoleOutput}
        isOpen={isConsoleOpen}
        onToggle={onToggleConsole}
        isRunning={isRunningCode}
      />
    </div>
  );
};
