/**
 * interviewService.ts — Typed interview API client.
 *
 * Replaces the stale interviewService.js stub (Phase 1).
 * All calls go through Next.js BFF proxy routes under /api/interviews/*.
 *
 * NEXT_PUBLIC_LEGACY_MEDIA_EVAL=true  → audio/video blobs included in submitAnswer
 * NEXT_PUBLIC_LEGACY_MEDIA_EVAL=false → only transcript text + speech metrics sent (default)
 */

import axios from 'axios';

const API_BASE = '/api/interviews';

// Auto-attach JWT token from localStorage to every request
axios.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Reflects the backend Interview + Question subdoc shape
export interface QuestionResult {
  _id?: string;
  questionId?: string | null;
  questionText: string;
  answerText?: string | null;
  feedback?: string | null;
  score?: number | null;
  codeAnswer?: string | null;
  programmingLanguage?: string | null;
  codeFeedback?: string | null;
  codeScore?: number | null;
  wpm?: number | null;
  fillerWordsCount?: number | null;
  topic?: string | null;
  isCodingProblem?: boolean;
  normalizedTitle?: string | null;
  improvements?: string[];
}

export interface InterviewResult {
  _id: string;
  user: string;
  role: string;
  programmingLanguage?: string | null;
  questions: QuestionResult[];
  date: string;
  overallFeedback?: string | null;
  overallScore?: number | null;
}

export interface StartInterviewPayload {
  role: string;
  programmingLanguage?: string;
  config?: {
    mode?: 'hr' | 'dsa' | 'mixed';
    patterns?: string[];
    difficulty?: 'adaptive' | 'easy' | 'medium' | 'hard';
    durationMin?: number;
    maxQuestions?: number;
    voice?: boolean;
    company?: string | null;
  };
}

export interface SubmitAnswerPayload {
  questionIndex: number;
  // Text answer (always sent when available)
  answerText?: string;
  // Speech metrics (always sent when available)
  wpm?: number;
  fillerWordsCount?: number;
  // Code answer
  codeAnswer?: string;
  programmingLanguage?: string;
  // Legacy media paths — only included when NEXT_PUBLIC_LEGACY_MEDIA_EVAL=true
  audioAnswer?: string;
  videoAnswer?: string;
}

const LEGACY_MEDIA_EVAL = process.env.NEXT_PUBLIC_LEGACY_MEDIA_EVAL === 'true';

/**
 * Start a new interview session.
 */
export async function startInterview(payload: StartInterviewPayload): Promise<InterviewResult> {
  const response = await axios.post<InterviewResult>(API_BASE, payload);
  return response.data;
}

/**
 * Submit an answer for the current question.
 * Audio/video blobs are stripped unless NEXT_PUBLIC_LEGACY_MEDIA_EVAL=true.
 */
export async function submitAnswer(
  interviewId: string,
  payload: SubmitAnswerPayload
): Promise<InterviewResult> {
  const body: SubmitAnswerPayload = {
    questionIndex: payload.questionIndex,
  };

  if (payload.answerText) body.answerText = payload.answerText;
  if (payload.codeAnswer) body.codeAnswer = payload.codeAnswer;
  if (payload.programmingLanguage) body.programmingLanguage = payload.programmingLanguage;
  if (typeof payload.wpm === 'number') body.wpm = payload.wpm;
  if (typeof payload.fillerWordsCount === 'number') body.fillerWordsCount = payload.fillerWordsCount;

  // Legacy media: only include if flag is on (default: off)
  if (LEGACY_MEDIA_EVAL) {
    if (payload.audioAnswer) body.audioAnswer = payload.audioAnswer;
    if (payload.videoAnswer) body.videoAnswer = payload.videoAnswer;
  }

  const response = await axios.post<InterviewResult>(`${API_BASE}/${interviewId}/answer`, body);
  return response.data;
}

/**
 * Fetch the full details of a single interview.
 */
export async function getInterviewDetails(interviewId: string): Promise<InterviewResult> {
  const response = await axios.get<InterviewResult>(`${API_BASE}/${interviewId}`);
  return response.data;
}

/**
 * Fetch all interviews for the authenticated user (without question details).
 */
export async function getUserInterviews(): Promise<Omit<InterviewResult, 'questions'>[]> {
  const response = await axios.get<Omit<InterviewResult, 'questions'>[]>(`${API_BASE}/user`);
  return response.data;
}

/**
 * Delete an interview.
 */
export async function deleteInterview(interviewId: string): Promise<{ msg: string }> {
  const response = await axios.delete<{ msg: string }>(`${API_BASE}/${interviewId}`);
  return response.data;
}

export interface SubmitTurnPayload {
  text: string;
  questionIndex?: number;
  code?: string;
  language?: string;
  metrics?: {
    wpm?: number | null;
    fillerWordsCount?: number | null;
    responseMs?: number | null;
  };
}

export interface TurnResponse {
  action: 'followup' | 'hint' | 'next' | 'wrap_up';
  message: string;
  score?: number | null;
  signals: {
    clarity: number;
    depth: number;
    correctness: number;
  };
  interview: InterviewResult;
}

export interface FinishResponse {
  msg: string;
  status: 'completing' | 'completed';
  interviewId: string;
}

/**
 * Submit candidate turn and get adaptive feedback/follow-up/hint.
 */
export async function submitTurn(
  interviewId: string,
  payload: SubmitTurnPayload
): Promise<TurnResponse> {
  const response = await axios.post<TurnResponse>(`${API_BASE}/${interviewId}/turn`, payload);
  return response.data;
}

/**
 * Submit candidate turn with real-time SSE token streaming.
 */
export async function submitTurnStream(
  interviewId: string,
  payload: SubmitTurnPayload,
  callbacks: {
    onToken?: (delta: string) => void;
    onCompletion?: (data: TurnResponse) => void;
    onError?: (err: Error) => void;
  } = {}
): Promise<TurnResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/interviews/${interviewId}/turn`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = 'Turn submission failed';
    try {
      const parsed = JSON.parse(errorText);
      msg = parsed.detail || parsed.error || parsed.msg || msg;
    } catch {
      msg = errorText || msg;
    }
    const err = new Error(msg);
    callbacks.onError?.(err);
    throw err;
  }

  const contentType = response.headers.get('content-type') || '';

  // Non-streaming fallback
  if (!contentType.includes('text/event-stream') || !response.body) {
    const data: TurnResponse = await response.json();
    if (data.message) callbacks.onToken?.(data.message);
    callbacks.onCompletion?.(data);
    return data;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalCompletion: TurnResponse | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        let eventType = 'message';
        let eventData = '';

        for (const line of trimmed.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            eventData = line.replace('data:', '').trim();
          }
        }

        if (!eventData) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(eventData);
        } catch {
          continue;
        }

        if (eventType === 'token' && parsed.delta) {
          callbacks.onToken?.(parsed.delta);
        } else if (eventType === 'completion') {
          finalCompletion = parsed as TurnResponse;
          callbacks.onCompletion?.(finalCompletion);
        } else if (eventType === 'error') {
          const err = new Error(parsed.msg || 'Streaming turn error');
          callbacks.onError?.(err);
          throw err;
        }
      }
    }
  } catch (err: any) {
    callbacks.onError?.(err);
    throw err;
  }

  if (finalCompletion) {
    return finalCompletion;
  }

  throw new Error('Stream concluded without a completion event');
}

/**
 * Request background report generation when wrapping up an interview.
 */
export async function finishInterview(interviewId: string): Promise<FinishResponse> {
  const response = await axios.post<FinishResponse>(`${API_BASE}/${interviewId}/finish`);
  return response.data;
}

// Default export for backward compatibility with any code using the old shape
const interviewService = {
  startInterview,
  submitAnswer,
  submitTurn,
  submitTurnStream,
  finishInterview,
  getInterviewDetails,
  getUserInterviews,
  deleteInterview,
};

export default interviewService;

