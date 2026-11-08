'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { HelpCircle, Code2, Tag, MessageCircleQuestion, CornerDownRight } from 'lucide-react';
import { QuestionState } from '@/hooks/useInterviewSession';

interface QuestionPanelProps {
  question: QuestionState | null;
  questionIndex: number;
  totalQuestions: number;
  isCodingQuestion: boolean;
  patterns?: string[];
  followupsRemaining?: number;
  hintsRemaining?: number;
  activeFollowup?: string | null;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  questionIndex,
  isCodingQuestion,
  patterns = [],
  activeFollowup = null,
}) => {
  if (!question) {
    return (
      <div className="rounded-2xl border-4 border-black p-8 text-center bg-white/90 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-gray-500 font-bold text-sm">
        Waiting for next question...
      </div>
    );
  }

  const rawText = question.questionText || '';
  // Strip [CODING_PROBLEM] prefix wherever it appears
  let displayPrompt = rawText.replace(/\[CODING_PROBLEM\]/gi, '').trim();

  if (isCodingQuestion) {
    // Strip any leading AI transition sentence before the actual problem.
    // Patterns like:
    //   "Interesting points on Introduction & Background. Moving forward: Given..."
    //   "Building on what you said. Let's move on: Given..."
    //   "Understood. Moving to the next section: Given..."
    // Strategy: greedily remove everything up to and including a transition keyword phrase.
    displayPrompt = displayPrompt
      .replace(/^[\s\S]*?(?:Moving forward[:\s]+|Moving to[^:]*:\s*|Let(?:'s| us) move on[:\s]+|Next[,:]?\s+(?:up\s*)?(?:question[,:]?\s*)?)/i, '')
      .trim();

    // If still starts with a sentence that looks like an intro (doesn't start with a typical problem opener)
    // fall back to stripping everything before the first "Given" / "You are given" / "Write a" / "Design a"
    if (displayPrompt && !/^(?:Given|You are|Write a|Design a|Find|Return|Implement|Given that|A |An )/i.test(displayPrompt)) {
      const problemStart = displayPrompt.search(/(?:Given|You are given|Write a|Design a|Find|Return|Implement)/i);
      if (problemStart > 0) {
        displayPrompt = displayPrompt.slice(problemStart).trim();
      }
    }

    // Format "Example:", "Example 1:", "Constraints:", "Input:", "Output:" with markdown linebreaks and bolding
    displayPrompt = displayPrompt
      .replace(/(Example\s*\d*:?)/gi, '\n\n**$1**\n')
      .replace(/(Input:)/gi, '\n- **Input:**')
      .replace(/(Output:)/gi, '\n- **Output:**')
      .replace(/(Explanation:)/gi, '\n- **Explanation:**')
      .replace(/(Constraints:)/gi, '\n\n**Constraints:**\n');
  }

  const questionPatterns = question.patterns?.length ? question.patterns : patterns;
  const problemTitle = question.title || (isCodingQuestion ? 'Coding Challenge' : question.topic || 'Interview Question');

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={(question.questionId || questionIndex) + (activeFollowup ? '-followup' : '')}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border-4 border-black p-6 sm:p-8 bg-white/95 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4"
      >
        {/* Dynamic Follow-up Alert Banner if AI asked a specific follow-up */}
        {activeFollowup ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black text-xs font-black uppercase tracking-wider bg-yellow-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                <MessageCircleQuestion className="w-3.5 h-3.5 text-black" />
                <span>Interviewer Follow-up Question</span>
              </span>
              <span className="text-xs font-bold text-gray-600">
                (Context: {problemTitle})
              </span>
            </div>

            {/* Prominent Follow-up Prompt Box */}
            <div className="p-4 sm:p-5 rounded-xl border-3 border-black bg-yellow-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-start gap-2.5">
                <CornerDownRight className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-lg sm:text-xl font-black text-black leading-snug">
                  {activeFollowup}
                </div>
              </div>
            </div>

            {/* Collapsed/Context original problem reminder */}
            <div className="pt-2 text-xs font-bold text-gray-700 flex items-center gap-2">
              <span>Original Problem:</span>
              <span className="font-semibold text-gray-600 truncate max-w-lg">
                {displayPrompt.slice(0, 140)}...
              </span>
            </div>
          </div>
        ) : (
          /* Normal Primary Question Display */
          <>
            {/* Topic & Pattern Tags */}
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

              {question.title && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border-2 border-black text-xs font-black bg-blue-100 text-blue-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {question.title}
                </span>
              )}

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

            {/* Well-formatted problem prompt with markdown support */}
            <div className="prose max-w-none text-black">
              {isCodingQuestion ? (
                <div className="space-y-3">
                  {question.title && (
                    <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight mb-2">
                      {question.title}
                    </h3>
                  )}
                  <div className="text-base sm:text-lg font-medium leading-relaxed space-y-3 text-gray-900">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1 font-mono text-sm" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="my-0.5" {...props} />,
                        code: ({ node, inline, ...props }: any) => (
                          inline ? (
                            <code className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-pink-600" {...props} />
                          ) : (
                            <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs font-mono overflow-x-auto my-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <code {...props} />
                            </pre>
                          )
                        ),
                        strong: ({ node, ...props }) => <strong className="font-black text-black" {...props} />,
                      }}
                    >
                      {displayPrompt}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="text-xl sm:text-2xl font-black text-black leading-snug tracking-tight">
                  <ReactMarkdown>{displayPrompt}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        )}
      </motion.section>
    </AnimatePresence>
  );
};
