/**
 * interviewService.js — Backward-compatible interview API client (JavaScript).
 *
 * Updated in Phase 1 to match full payload shape (code, transcripts, speech metrics)
 * and provide the same interface as interviewService.ts.
 */

import axios from 'axios';

const API_BASE = '/api/interviews';

const LEGACY_MEDIA_EVAL = process.env.NEXT_PUBLIC_LEGACY_MEDIA_EVAL === 'true';

export const startInterview = async (payload = {}) => {
  try {
    const response = await axios.post(API_BASE, payload);
    return response.data;
  } catch (error) {
    console.error('Error starting interview:', error);
    throw error;
  }
};

export const submitAnswer = async (interviewId, payload = {}) => {
  try {
    const body = {
      questionIndex: payload.questionIndex,
    };

    if (payload.answerText) body.answerText = payload.answerText;
    if (payload.codeAnswer) body.codeAnswer = payload.codeAnswer;
    if (payload.programmingLanguage) body.programmingLanguage = payload.programmingLanguage;
    if (typeof payload.wpm === 'number') body.wpm = payload.wpm;
    if (typeof payload.fillerWordsCount === 'number') body.fillerWordsCount = payload.fillerWordsCount;

    if (LEGACY_MEDIA_EVAL) {
      if (payload.audioAnswer) body.audioAnswer = payload.audioAnswer;
      if (payload.videoAnswer) body.videoAnswer = payload.videoAnswer;
    }

    const response = await axios.post(`${API_BASE}/${interviewId}/answer`, body);
    return response.data;
  } catch (error) {
    console.error('Error submitting answer:', error);
    throw error;
  }
};

export const getInterviewDetails = async (interviewId) => {
  try {
    const response = await axios.get(`${API_BASE}/${interviewId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching interview details:', error);
    throw error;
  }
};

export const getUserInterviews = async () => {
  try {
    const response = await axios.get(`${API_BASE}/user`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    throw error;
  }
};

export const deleteInterview = async (interviewId) => {
  try {
    const response = await axios.delete(`${API_BASE}/${interviewId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting interview:', error);
    throw error;
  }
};

export const submitTurn = async (interviewId, payload = {}) => {
  try {
    const response = await axios.post(`${API_BASE}/${interviewId}/turn`, payload);
    return response.data;
  } catch (error) {
    console.error('Error submitting turn:', error);
    throw error;
  }
};

export const submitTurnStream = async (interviewId, payload = {}, callbacks = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/${interviewId}/turn`, {
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
  if (!contentType.includes('text/event-stream') || !response.body) {
    const data = await response.json();
    if (data.message) callbacks.onToken?.(data.message);
    callbacks.onCompletion?.(data);
    return data;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalCompletion = null;

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
          if (line.startsWith('event:')) eventType = line.replace('event:', '').trim();
          else if (line.startsWith('data:')) eventData = line.replace('data:', '').trim();
        }

        if (!eventData) continue;
        let parsed;
        try { parsed = JSON.parse(eventData); } catch { continue; }

        if (eventType === 'token' && parsed.delta) {
          callbacks.onToken?.(parsed.delta);
        } else if (eventType === 'completion') {
          finalCompletion = parsed;
          callbacks.onCompletion?.(finalCompletion);
        } else if (eventType === 'error') {
          const err = new Error(parsed.msg || 'Streaming turn error');
          callbacks.onError?.(err);
          throw err;
        }
      }
    }
  } catch (err) {
    callbacks.onError?.(err);
    throw err;
  }

  if (finalCompletion) return finalCompletion;
  throw new Error('Stream concluded without a completion event');
};

export const finishInterview = async (interviewId) => {
  try {
    const response = await axios.post(`${API_BASE}/${interviewId}/finish`);
    return response.data;
  } catch (error) {
    console.error('Error finishing interview:', error);
    throw error;
  }
};

export default {
  startInterview,
  submitAnswer,
  submitTurn,
  submitTurnStream,
  finishInterview,
  getInterviewDetails,
  getUserInterviews,
  deleteInterview,
};
