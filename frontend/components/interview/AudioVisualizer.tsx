'use client';

import React from 'react';

interface AudioVisualizerProps {
  status: 'idle' | 'listening' | 'speaking' | 'submitting';
  isVoiceActive: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ status, isVoiceActive }) => {
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative flex items-center justify-center w-28 h-28">
        {/* Outer pulsing ripple ring */}
        {isVoiceActive && status === 'listening' && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-25 animate-ping" />
        )}
        {isVoiceActive && status === 'speaking' && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-25 animate-ping" />
        )}

        {/* Middle decorative ring */}
        <div
          className={`absolute inset-2 rounded-full border-2 transition-all duration-300 ${
            status === 'listening'
              ? 'border-emerald-300 bg-emerald-50/50 scale-105'
              : status === 'speaking'
              ? 'border-blue-300 bg-blue-50/50 scale-105'
              : status === 'submitting'
              ? 'border-amber-300 bg-amber-50/50 rotate-180 animate-spin'
              : 'border-slate-200 bg-slate-50'
          }`}
        />

        {/* Center icon / mic core */}
        <div
          className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
            status === 'listening'
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : status === 'speaking'
              ? 'bg-blue-600 text-white shadow-blue-200'
              : status === 'submitting'
              ? 'bg-amber-600 text-white shadow-amber-200'
              : 'bg-slate-300 text-slate-600'
          }`}
        >
          {status === 'speaking' ? (
            // Animated sound wave bars
            <div className="flex items-center gap-1 h-6">
              <span className="w-1 bg-white rounded-full animate-bounce h-4" />
              <span className="w-1 bg-white rounded-full animate-bounce h-6 delay-75" />
              <span className="w-1 bg-white rounded-full animate-bounce h-3 delay-150" />
              <span className="w-1 bg-white rounded-full animate-bounce h-5 delay-100" />
            </div>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Status Label */}
      <div className="mt-3 text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            status === 'listening'
              ? 'bg-emerald-100 text-emerald-800'
              : status === 'speaking'
              ? 'bg-blue-100 text-blue-800'
              : status === 'submitting'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'listening'
                ? 'bg-emerald-600 animate-pulse'
                : status === 'speaking'
                ? 'bg-blue-600 animate-pulse'
                : status === 'submitting'
                ? 'bg-amber-600 animate-pulse'
                : 'bg-slate-400'
            }`}
          />
          {status === 'listening' && 'Listening (Pause 1.2s to submit)'}
          {status === 'speaking' && 'AI Speaking (Interrupt by talking)'}
          {status === 'submitting' && 'Analyzing Turn...'}
          {status === 'idle' && 'Microphone Paused'}
        </span>
      </div>
    </div>
  );
};

