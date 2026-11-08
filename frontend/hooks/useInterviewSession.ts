'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getInterviewDetails,
  startInterview,
  submitTurnStream,
  finishInterview,
  TurnResponse,
} from '@/services/interviewService';
import { VoiceMetrics } from '@/lib/speech/useVoiceInterviewer';
import { TestRunSummary } from '@/lib/codeRunner';

export interface QuestionState {
  _id?: string;
  questionId?: string | null;
  title?: string | null;
  questionText: string;
  answerText: string | null;
  feedback: string | null;
  score: number | null;
  codeAnswer?: string | null;
  programmingLanguage?: string | null;
  codeFeedback?: string | null;
  codeScore?: number | null;
  wpm?: number | null;
  fillerWordsCount?: number | null;
  isCodingProblem?: boolean;
  patterns?: string[];
  rubricNotes?: string[];
  topic?: string;
  signals?: {
    correctness?: number | null;
    depth?: number | null;
    clarity?: number | null;
  };
}

export interface InterviewSessionState {
  _id: string;
  role: string;
  programmingLanguage?: string;
  questions: QuestionState[];
  date: string;
  overallFeedback?: string;
  overallScore?: number;
  status?: 'active' | 'completing' | 'completed';
  runningDifficulty?: 'easy' | 'medium' | 'hard';
  config?: {
    mode?: 'hr' | 'dsa' | 'mixed';
    voice?: boolean;
    patterns?: string[];
    difficulty?: 'adaptive' | 'easy' | 'medium' | 'hard';
    durationMin?: number;
    maxQuestions?: number;
    company?: string | null;
  };
  turns?: Array<{
    speaker: 'ai' | 'candidate';
    type: 'question' | 'followup' | 'hint' | 'answer' | 'system';
    text: string;
    questionRef?: string | null;
    createdAt?: string;
    metrics?: {
      wpm?: number | null;
      fillerWordsCount?: number | null;
      responseMs?: number | null;
    };
  }>;
  report?: any;
}

export function useInterviewSession(interviewId: string | null) {
  const router = useRouter();
  const [interview, setInterview] = useState<InterviewSessionState | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [streamingAiMessage, setStreamingAiMessage] = useState<string | null>(null);
  const [codingProblemDetails, setCodingProblemDetails] = useState<any | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial interview data or start a new session from selectedRole
  const loadInterview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (interviewId && interviewId !== 'interview') {
        const data = await getInterviewDetails(interviewId);
        setInterview(data as unknown as InterviewSessionState);
        const unansweredIdx = data.questions?.findIndex((q: any) => q.answerText == null && q.codeAnswer == null);
        if (unansweredIdx !== -1 && typeof unansweredIdx === 'number') {
          setCurrentQuestionIndex(unansweredIdx);
        }
      } else if (typeof window !== 'undefined') {
        // Try to resume an existing active session saved in localStorage
        const existingSessionId = localStorage.getItem('activeInterviewId');
        if (existingSessionId) {
          let resumed = false;
          try {
            const data = await getInterviewDetails(existingSessionId);
            if (data && (data.status === 'active' || data.status === 'completing' || data.status === 'completed')) {
              setInterview(data as unknown as InterviewSessionState);
              const unansweredIdx = data.questions?.findIndex((q: any) => q.answerText == null && q.codeAnswer == null);
              if (unansweredIdx !== -1 && typeof unansweredIdx === 'number') {
                setCurrentQuestionIndex(unansweredIdx);
              }
              resumed = true;
            }
          } catch {
            // Stale or deleted session — clear it and fall through
            localStorage.removeItem('activeInterviewId');
          }
          if (resumed) return;
        }

        // No valid existing session — start fresh or redirect to role selection
        const roleData = localStorage.getItem('selectedRole');
        if (roleData) {
          const parsed = JSON.parse(roleData);
          const data = await startInterview(parsed);
          setInterview(data as unknown as InterviewSessionState);
          if (data?._id) {
            localStorage.setItem('activeInterviewId', data._id);
          }
          setCurrentQuestionIndex(0);
        } else {
          // Nothing to resume and no role selected — go back to role selection
          setLoading(false);
          router.push('/interview/role-select');
          return;
        }
      }
    } catch (err: any) {
      console.error('Failed to load interview session:', err);
      setError(err?.response?.data?.msg || err.message || 'Failed to load interview session');
    } finally {
      setLoading(false);
    }
  }, [interviewId, router]);

  useEffect(() => {
    loadInterview();
  }, [loadInterview]);

  // Current question helpers
  const currentQuestion: QuestionState | null =
    interview?.questions?.[currentQuestionIndex] || null;

  const isCodingQuestion = Boolean(
    currentQuestion?.isCodingProblem ||
      currentQuestion?.questionText?.startsWith('[CODING_PROBLEM]')
  );

  // Fetch coding problem details when active question changes
  useEffect(() => {
    if (!isCodingQuestion || !currentQuestion?.questionId) {
      setCodingProblemDetails(null);
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`/api/interviews/coding-problem/${currentQuestion.questionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCodingProblemDetails(data);
      })
      .catch(() => {});
  }, [isCodingQuestion, currentQuestion?.questionId]);

  // Poll for completed report when status is 'completing'
  useEffect(() => {
    const activeId = interviewId || interview?._id;
    if (interview?.status === 'completing' && activeId) {
      pollingRef.current = setInterval(async () => {
        try {
          const updated: any = await getInterviewDetails(activeId);
          if (updated.status === 'completed' || updated.report) {
            setInterview(updated as unknown as InterviewSessionState);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {
          // ignore transient polling errors
        }
      }, 1500);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [interview?.status, interview?._id, interviewId]);

  // Submit streaming adaptive turn
  const submitTurn = useCallback(
    async (opts: {
      text: string;
      code?: string;
      language?: string;
      metrics?: VoiceMetrics;
      testSummary?: TestRunSummary | null;
      onToken?: (delta: string) => void;
      onDone?: (completion: TurnResponse) => void;
    }) => {
      if (!interview || isGeneratingFeedback) return;

      try {
        setIsGeneratingFeedback(true);
        setError(null);
        setStreamingAiMessage('');

        await submitTurnStream(
          interview._id,
          {
            text: opts.text,
            questionIndex: currentQuestionIndex,
            code: opts.code,
            language: opts.language,
            metrics: opts.metrics
              ? {
                  wpm: opts.metrics.wpm,
                  fillerWordsCount: opts.metrics.fillerWordsCount,
                  responseMs: opts.metrics.responseMs,
                }
              : undefined,
          },
          {
            onToken: (delta) => {
              setStreamingAiMessage((prev) => (prev || '') + delta);
              opts.onToken?.(delta);
            },
            onCompletion: (completionData) => {
              setStreamingAiMessage(null);
              setInterview(completionData.interview as unknown as InterviewSessionState);
              opts.onDone?.(completionData);

              // Auto-advance to next question if action was 'next'
              if (completionData.action === 'next') {
                if (completionData.interview.questions.length > interview.questions.length) {
                  setCurrentQuestionIndex(completionData.interview.questions.length - 1);
                } else if (currentQuestionIndex < completionData.interview.questions.length - 1) {
                  setCurrentQuestionIndex((prev) => prev + 1);
                }
              } else if (completionData.action === 'wrap_up') {
                // Clear session keys so a page refresh does NOT restart the interview after wrap-up
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('selectedRole');
                  localStorage.removeItem('activeInterviewId');
                }
                finishInterview(interview._id).catch(() => {});
              }
            },
            onError: (err) => {
              setError(err.message || 'Error communicating with AI interviewer');
              setStreamingAiMessage(null);
            },
          }
        );
      } catch (err: any) {
        setError(err.message || 'Turn submission failed');
        setStreamingAiMessage(null);
      } finally {
        setIsGeneratingFeedback(false);
      }
    },
    [interview, currentQuestionIndex, isGeneratingFeedback]
  );

  // Finish interview manually
  const finishSession = useCallback(async () => {
    if (!interview) return;
    try {
      setIsFinishing(true);
      setError(null);
      await finishInterview(interview._id);
      const updated = await getInterviewDetails(interview._id);
      setInterview(updated as unknown as InterviewSessionState);
      // Clear session keys so a page refresh does NOT restart the interview
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedRole');
        localStorage.removeItem('activeInterviewId');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete interview');
    } finally {
      setIsFinishing(false);
    }
  }, [interview]);

  return {
    interview,
    setInterview,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentQuestion,
    isCodingQuestion,
    codingProblemDetails,
    loading,
    error,
    setError,
    isGeneratingFeedback,
    isFinishing,
    streamingAiMessage,
    submitTurn,
    finishSession,
    refreshInterview: loadInterview,
  };
}
