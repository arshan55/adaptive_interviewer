'use client';

import React from 'react';

export interface TurnItem {
  speaker: 'ai' | 'candidate';
  type: 'question' | 'followup' | 'hint' | 'answer' | 'system';
  text: string;
  createdAt?: string;
  metrics?: {
    wpm?: number | null;
    fillerWordsCount?: number | null;
    responseMs?: number | null;
  };
}

interface ChatTranscriptProps {
  turns: TurnItem[];
}

export const ChatTranscript: React.FC<ChatTranscriptProps> = ({ turns }) => {
  if (!turns || turns.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Conversation Dialogue ({turns.length} turns)
        </h3>
        <span className="text-xs text-slate-400">Chronological feed</span>
      </div>

      <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
        {turns.map((turn, idx) => {
          const isAi = turn.speaker === 'ai';

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-colors ${
                isAi
                  ? 'bg-blue-50/60 border-blue-100 text-slate-800'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded ${
                      isAi
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    {isAi ? 'AI Interviewer' : 'Candidate'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 capitalize">
                    {turn.type}
                  </span>
                </div>

                {turn.metrics && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                    {typeof turn.metrics.wpm === 'number' && (
                      <span>{turn.metrics.wpm} WPM</span>
                    )}
                    {typeof turn.metrics.fillerWordsCount === 'number' && (
                      <span>{turn.metrics.fillerWordsCount} fillers</span>
                    )}
                    {typeof turn.metrics.responseMs === 'number' && (
                      <span>{turn.metrics.responseMs}ms</span>
                    )}
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

