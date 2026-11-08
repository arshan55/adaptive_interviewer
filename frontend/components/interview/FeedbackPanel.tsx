'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles, Mic2, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { VoiceMetrics } from '@/lib/speech/useVoiceInterviewer';

interface FeedbackPanelProps {
  score?: number | null;
  feedback?: string | null;
  improvements?: string[];
  metrics?: VoiceMetrics | null;
  signals?: {
    clarity?: number;
    depth?: number;
    correctness?: number;
  };
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  score,
  feedback,
  improvements = [],
  metrics,
  signals,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!feedback && score == null) return null;

  // Extract 2-3 concise bullets from the feedback text
  const cleanFeedback = (feedback || '').trim();
  const sentences = cleanFeedback
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const mainTakeaways = sentences.slice(0, 3);
  const remainingNotes = sentences.slice(3).join(' ');

  const scoreNum = typeof score === 'number' ? Math.round(score) : 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-4 border-black p-6 space-y-4 bg-white/95 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      {/* Top Bar: Big Score Number + Actionable Header */}
      <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Animated score ring */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-xl border-3 border-black bg-yellow-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <span className="font-mono font-black text-black text-xl sm:text-2xl">
              {scoreNum}
            </span>
            <span className="text-[10px] font-bold text-gray-700 absolute -bottom-1">/10</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-black">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Response Feedback</span>
            </div>
            <h4 className="text-base sm:text-lg font-black text-black">
              {scoreNum >= 8 ? 'Exemplary Answer' : scoreNum >= 6 ? 'Solid Response' : 'Needs Development'}
            </h4>
          </div>
        </div>

        {/* Expand / Collapse Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black text-xs font-bold text-black bg-white hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          <span>{isExpanded ? 'Less' : 'Details'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 3 Clear Evaluation Metrics & Score Breakdown */}
      {signals && (
        <div className="grid grid-cols-3 gap-2 py-1">
          <div className="rounded-xl border-2 border-black bg-emerald-50 p-2.5 text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-900 block">Correctness (45%)</span>
            <span className="text-lg font-mono font-black text-emerald-800">{signals.correctness ?? 5}/10</span>
          </div>
          <div className="rounded-xl border-2 border-black bg-indigo-50 p-2.5 text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-900 block">Depth & TC/SC (35%)</span>
            <span className="text-lg font-mono font-black text-indigo-800">{signals.depth ?? 5}/10</span>
          </div>
          <div className="rounded-xl border-2 border-black bg-amber-50 p-2.5 text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-900 block">Clarity (20%)</span>
            <span className="text-lg font-mono font-black text-amber-800">{signals.clarity ?? 5}/10</span>
          </div>
        </div>
      )}

      {/* Merged Compact Speaking Stats Line (WPM • fillers • response time) */}
      {metrics && (metrics.wpm || metrics.fillerWordsCount) && (
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-black bg-slate-100 border border-black/20 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1">
            <Mic2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Speaking Stats:</span>
          </div>
          {metrics.wpm ? (
            <span>
              <strong className="text-black">{metrics.wpm}</strong> WPM
            </span>
          ) : null}
          {metrics.wpm && metrics.fillerWordsCount ? <span>•</span> : null}
          {metrics.fillerWordsCount ? (
            <span>
              <strong className="text-black">{metrics.fillerWordsCount}</strong> filler word
              {metrics.fillerWordsCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {metrics.responseMs ? (
            <>
              <span>•</span>
              <span>
                <strong className="text-black">{Math.round(metrics.responseMs / 1000)}s</strong> latency
              </span>
            </>
          ) : null}
        </div>
      )}

      {/* 2-3 Concise Bullet Points */}
      <div className="space-y-2">
        {mainTakeaways.map((bullet, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-sm font-semibold text-gray-900 leading-snug">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>

      {/* Collapsible Deep Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="pt-3 border-t-2 border-black/10 space-y-4 overflow-hidden"
          >
            {/* Extended Notes */}
            {remainingNotes && (
              <div className="space-y-1">
                <h5 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Additional Analysis
                </h5>
                <p className="text-xs text-gray-800 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-black/20">
                  {remainingNotes}
                </p>
              </div>
            )}

            {/* Improvement Recommendations */}
            {improvements.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Focus Areas
                </h5>
                <ul className="space-y-1 text-xs text-gray-800 font-medium">
                  {improvements.map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-yellow-50 p-2.5 rounded-xl border border-black/20">
                      <span className="font-bold text-black">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
