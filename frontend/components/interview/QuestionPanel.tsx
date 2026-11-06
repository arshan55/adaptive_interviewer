'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { HelpCircle, Code2, Tag } from 'lucide-react';
import { QuestionState } from '@/hooks/useInterviewSession';

interface QuestionPanelProps {
  question: QuestionState | null;
  questionIndex: number;
  totalQuestions: number;
  isCodingQuestion: boolean;
  patterns?: string[];
  followupsRemaining?: number;
  hintsRemaining?: number;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  questionIndex,
  isCodingQuestion,
  patterns = [],
}) => {
  if (!question) {
    return (
      <div className="rounded-2xl border-4 border-black p-8 text-center bg-white/90 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-gray-500 font-bold text-sm">
        Waiting for next question...
      </div>
    );
  }

  const rawText = question.questionText || '';
  const displayPrompt = isCodingQuestion
    ? rawText.replace(/^\[CODING_PROBLEM\]\s*/i, '').trim()
    : rawText;

  const questionPatterns = question.patterns?.length ? question.patterns : patterns;

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={question.questionId || questionIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border-4 border-black p-6 sm:p-8 bg-white/95 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4"
      >
        {/* Topic Tag */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black text-xs font-black uppercase tracking-wider bg-yellow-200 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {isCodingQuestion ? (
              <>
                <Code2 className="w-3.5 h-3.5" />
                <span>Coding Challenge</span>
              </>
            ) : (
              <>
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{question.topic || 'Behavioral Question'}</span>
              </>
            )}
          </span>

          {questionPatterns.slice(0, 3).map((pat) => (
            <span
              key={pat}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border-2 border-black text-xs font-bold bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Tag className="w-3 h-3 text-gray-600" />
              <span>{pat}</span>
            </span>
          ))}
        </div>

        {/* Large, Generous Question Prompt */}
        <div className="text-xl sm:text-2xl font-black text-black leading-snug tracking-tight prose max-w-none">
          <ReactMarkdown>{displayPrompt}</ReactMarkdown>
        </div>
      </motion.section>
    </AnimatePresence>
  );
};
