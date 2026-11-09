'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';

interface InterviewRoomHeaderProps {
  currentQuestionIndex: number;
  totalQuestions: number;
  durationMin?: number;
  startedAt?: string;
  onFinish: () => void;
  onTimeExpired?: () => void;
  isFinishing?: boolean;
  // Optional props retained for interface compatibility
  role?: string;
  company?: string | null;
  mode?: 'hr' | 'dsa' | 'mixed';
  difficulty?: 'adaptive' | 'easy' | 'medium' | 'hard';
  runningDifficulty?: 'easy' | 'medium' | 'hard';
  isVoiceActive?: boolean;
  onToggleVoice?: () => void;
  isSubmitting?: boolean;
}

export const InterviewRoomHeader: React.FC<InterviewRoomHeaderProps> = ({
  currentQuestionIndex,
  totalQuestions,
  durationMin = 30,
  startedAt,
  onFinish,
  onTimeExpired,
  isFinishing = false,
}) => {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(durationMin * 60);
  const expiredRef = useRef(false);

  useEffect(() => {
    const totalSec = (durationMin || 30) * 60;
    if (!startedAt) {
      setSecondsRemaining(totalSec);
      return;
    }

    const startMs = new Date(startedAt).getTime();
    const updateTimer = () => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      const remaining = Math.max(0, totalSec - elapsedSec);
      setSecondsRemaining(remaining);
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onTimeExpired?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [durationMin, startedAt, onTimeExpired]);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isTimeLow = secondsRemaining < 300;

  const handleExit = () => {
    if (isFinishing) return;
    onFinish();
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b-4 border-black sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Exit */}
        <button
          type="button"
          onClick={handleExit}
          disabled={isFinishing}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black border-2 border-black rounded-xl px-3 py-1.5 bg-white hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          {isFinishing ? (
            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <ArrowLeft className="w-4 h-4" />
          )}
          <span>{isFinishing ? 'Exiting...' : 'Exit Room'}</span>
        </button>

        {/* Center: Progress Dots & Question Indicator */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border-2 border-black bg-yellow-200 text-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalQuestions }).map((_, idx) => (
              <span
                key={idx}
                className={`h-2 rounded-full border border-black transition-all duration-300 ${
                  idx === currentQuestionIndex
                    ? 'w-7 bg-blue-600'
                    : idx < currentQuestionIndex
                    ? 'w-3.5 bg-emerald-400'
                    : 'w-2.5 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right: Timer */}
        <div
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-mono font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors ${
            isTimeLow
              ? 'bg-rose-200 text-rose-900 animate-pulse'
              : 'bg-white text-black'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeFormatted}</span>
        </div>
      </div>
    </header>
  );
};
