'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const SILENCE_DELAY_MS = 1800; // 1.8s after real speech → auto-submit
const SILENCE_DELAY_FILLER_MS = 4000; // 4s after a filler-only chunk → still thinking
// Short answers are valid interview responses. Waiting for four words made
// concise introductions appear to be ignored because they never auto-submitted.
const MIN_SUBSTANTIVE_WORDS = 2;
const FILLER_REGEX =
  /\b(um+|uh+|ah+|er+|hmm+|like|you know|so|basically|literally|actually|i mean|right)\b/gi;

/** Strip filler words and return how many real words remain */
function countSubstantiveWords(text: string): number {
  const stripped = text.replace(FILLER_REGEX, '').trim();
  return stripped.split(/\s+/).filter(Boolean).length;
}

/** True if the ENTIRE chunk is only filler words / very short noise */
function isFillerOnly(chunk: string): boolean {
  return countSubstantiveWords(chunk) === 0;
}

export interface VoiceMetrics {
  wpm: number | null;
  fillerWordsCount: number | null;
  responseMs: number | null;
}

export interface UseVoiceInterviewerOptions {
  enabled?: boolean;
  onTurnAutoSubmit?: (transcript: string, metrics: VoiceMetrics) => void;
  onTtsFinished?: () => void;
}

/**
 * Prioritizes the most natural, human-sounding voices available in the browser.
 * Ranks neural/natural online voices (Edge/Azure and Google Chrome) at the top,
 * and actively avoids robotic monotone desktop voices.
 */
function findBestHumanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 0. Check for user-selected voice preference from Settings / LocalStorage
  if (typeof window !== 'undefined') {
    const savedVoice = localStorage.getItem('preferred_interviewer_voice');
    if (savedVoice) {
      const userMatch = voices.find((v) => v.name.toLowerCase() === savedVoice.toLowerCase());
      if (userMatch) return userMatch;
    }
  }

  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  if (englishVoices.length === 0) return voices[0] || null;

  // 1. Google UK English Female (Natural Studio / Google) - Default priority as requested
  const googleUkFemale = englishVoices.find(
    (v) =>
      v.name.includes('Google') &&
      (v.name.includes('UK English Female') || (v.lang === 'en-GB' && v.name.toLowerCase().includes('female')))
  );
  if (googleUkFemale) return googleUkFemale;

  const anyGoogleUk = englishVoices.find(
    (v) => v.name.includes('Google') && (v.name.includes('UK') || v.lang === 'en-GB')
  );
  if (anyGoogleUk) return anyGoogleUk;

  // 2. Microsoft Edge / Azure Natural Neural Voices (Natural inflection)
  const edgeNatural = englishVoices.find(
    (v) =>
      v.name.includes('(Natural)') &&
      (v.name.includes('Libby') || v.name.includes('Sonia') || v.name.includes('Mia') || v.name.includes('Jenny') || v.name.includes('Aria'))
  );
  if (edgeNatural) return edgeNatural;

  const anyNatural = englishVoices.find((v) => v.name.includes('(Natural)'));
  if (anyNatural) return anyNatural;

  // 2. Google High-Quality Voices (Chrome)
  const googleUs = englishVoices.find(
    (v) => v.name.includes('Google') && (v.lang === 'en-US' || v.name.includes('US English'))
  );
  if (googleUs) return googleUs;

  const googleUk = englishVoices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'));
  if (googleUk) return googleUk;

  // 3. Apple Enhanced / Siri voices (macOS / iOS)
  const appleEnhanced = englishVoices.find(
    (v) =>
      (v.name.includes('Enhanced') || v.name.includes('Premium') || v.name.includes('Siri')) &&
      v.lang.startsWith('en')
  );
  if (appleEnhanced) return appleEnhanced;

  // 4. Well-tuned named human voices
  const preferredNames = ['Samantha', 'Karen', 'Aria', 'Jenny', 'Guy', 'Daniel', 'Victoria', 'Arthur', 'Moira'];
  for (const name of preferredNames) {
    const match = englishVoices.find((v) => v.name.includes(name));
    if (match) return match;
  }

  // 5. Any English voice that is NOT the robotic Windows 'Desktop' voices (David Desktop, Zira Desktop, Mark)
  const nonRobotic = englishVoices.find(
    (v) => !v.name.toLowerCase().includes('desktop')
  );
  if (nonRobotic) return nonRobotic;

  // Fallback to first available English voice
  return englishVoices[0];
}

export function useVoiceInterviewer({
  enabled = true,
  onTurnAutoSubmit,
  onTtsFinished,
}: UseVoiceInterviewerOptions = {}) {
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  const [isSynthesisSupported, setIsSynthesisSupported] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'speaking' | 'submitting'>('idle');

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    wpm: null,
    fillerWordsCount: null,
    responseMs: null,
  });

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const isTtsSpeakingRef = useRef<boolean>(false);
  const sentenceBufferRef = useRef<string>('');
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Flags for mic management during TTS to prevent audio loopback
  const micPausedForTtsRef = useRef<boolean>(false);
  const isVoiceActiveRef = useRef<boolean>(false);

  const speechStartTimeRef = useRef<number | null>(null);
  const wordCountRef = useRef<number>(0);
  const fillerCountRef = useRef<number>(0);
  const aiFinishedSpeakingTimeRef = useRef<number | null>(null);
  const responseLatencyRef = useRef<number | null>(null);
  const fullTurnTranscriptRef = useRef<string>('');

  const onTurnAutoSubmitRef = useRef(onTurnAutoSubmit);
  const onTtsFinishedRef = useRef(onTtsFinished);
  useEffect(() => {
    onTurnAutoSubmitRef.current = onTurnAutoSubmit;
  }, [onTurnAutoSubmit]);

  useEffect(() => {
    onTtsFinishedRef.current = onTtsFinished;
  }, [onTtsFinished]);

  // Check browser speech support and initialize natural human voices
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasRec = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasSyn = 'speechSynthesis' in window;
    setIsRecognitionSupported(hasRec);
    setIsSynthesisSupported(hasSyn);

    if (hasSyn) {
      const loadAndPickVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const englishList = voices.filter((v) => v.lang.startsWith('en'));
          setAvailableVoices(englishList.length > 0 ? englishList : voices);

          const bestVoice = findBestHumanVoice(voices);
          if (bestVoice) {
            selectedVoiceRef.current = bestVoice;
            setSelectedVoiceName(bestVoice.name);
          }
        }
      };

      loadAndPickVoices();
      window.speechSynthesis.onvoiceschanged = loadAndPickVoices;

      return () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  /** Change voice manually */
  const selectVoiceByName = useCallback((voiceName: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.name === voiceName);
    if (match) {
      selectedVoiceRef.current = match;
      setSelectedVoiceName(match.name);
    }
  }, []);

  // ── Mic control helpers ──────────────────────────────────────────────────

  /** Abort recognition without clearing the isVoiceActive flag */
  const pauseRecognition = useCallback(() => {
    if (recognitionRef.current) {
      micPausedForTtsRef.current = true;
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  /** Restart recognition after TTS finishes */
  const resumeRecognition = useCallback(() => {
    micPausedForTtsRef.current = false;
    if (!isVoiceActiveRef.current) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setVoiceStatus('listening');
      };

      rec.onspeechstart = () => {
        if (speechStartTimeRef.current === null) {
          speechStartTimeRef.current = Date.now();
          if (aiFinishedSpeakingTimeRef.current !== null) {
            responseLatencyRef.current = Math.max(0, speechStartTimeRef.current - aiFinishedSpeakingTimeRef.current);
          }
        }
      };

      rec.onresult = (event: any) => {
        if (isTtsSpeakingRef.current || micPausedForTtsRef.current || ttsQueueRef.current.length > 0) return;

        let interim = '';
        let newFinalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const transcriptChunk = item[0].transcript;
          if (item.isFinal) {
            newFinalChunk += transcriptChunk;
            const words = transcriptChunk.trim().split(/\s+/).filter(Boolean);
            wordCountRef.current += words.length;

            const fillers = transcriptChunk.match(FILLER_REGEX);
            if (fillers) fillerCountRef.current += fillers.length;
          } else {
            interim += transcriptChunk;
          }
        }

        if (newFinalChunk) {
          fullTurnTranscriptRef.current = (fullTurnTranscriptRef.current + ' ' + newFinalChunk).trim();
          setFinalTranscript(fullTurnTranscriptRef.current);
        }
        setInterimTranscript(interim);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        const substantiveWords = countSubstantiveWords(fullTurnTranscriptRef.current);
        if (substantiveWords >= MIN_SUBSTANTIVE_WORDS) {
          const delay =
            newFinalChunk && isFillerOnly(newFinalChunk)
              ? SILENCE_DELAY_FILLER_MS
              : SILENCE_DELAY_MS;
          silenceTimerRef.current = setTimeout(() => {
            commitTurnAnswer();
          }, delay);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'network' || event.error === 'audio-capture') {
          setVoiceStatus('idle');
          setTimeout(() => {
            if (isVoiceActiveRef.current && !micPausedForTtsRef.current) resumeRecognition();
          }, 250);
        }
        console.warn('[useVoiceInterviewer] SpeechRecognition error:', event.error);
      };

      rec.onend = () => {
        if (isVoiceActiveRef.current && !micPausedForTtsRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {}
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      console.warn('[useVoiceInterviewer] resumeRecognition error:', err);
    }
  }, []);

  // ── TTS helpers ──────────────────────────────────────────────────────────

  /** Commit and auto-submit candidate speech */
  const commitTurnAnswer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const textToSubmit = fullTurnTranscriptRef.current.trim();
    if (!textToSubmit) return;

    let wpm: number | null = null;
    if (speechStartTimeRef.current) {
      const elapsedMinutes = (Date.now() - speechStartTimeRef.current) / 60000;
      if (elapsedMinutes > 0.05) {
        wpm = Math.round(wordCountRef.current / elapsedMinutes);
      }
    }

    const currentMetrics: VoiceMetrics = {
      wpm,
      fillerWordsCount: fillerCountRef.current,
      responseMs: responseLatencyRef.current,
    };

    setMetrics(currentMetrics);
    setVoiceStatus('submitting');

    onTurnAutoSubmitRef.current?.(textToSubmit, currentMetrics);

    fullTurnTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    speechStartTimeRef.current = null;
    wordCountRef.current = 0;
    fillerCountRef.current = 0;
    responseLatencyRef.current = null;
  }, []);

  // Process next sentence from the TTS queue with natural human cadence
  const processNextTtsSentence = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (ttsQueueRef.current.length === 0) {
      isTtsSpeakingRef.current = false;
      aiFinishedSpeakingTimeRef.current = Date.now();
      onTtsFinishedRef.current?.();
      // Add a slight cooldown (500ms) after speech ends before turning mic back on to avoid acoustic echo/reverb loop
      setTimeout(() => {
        if (!isTtsSpeakingRef.current && ttsQueueRef.current.length === 0) {
          setVoiceStatus('listening');
          resumeRecognition();
        }
      }, 500);
      return;
    }

    const nextSentence = ttsQueueRef.current.shift();
    if (!nextSentence) {
      processNextTtsSentence();
      return;
    }

    isTtsSpeakingRef.current = true;
    pauseRecognition();
    setVoiceStatus('speaking');

    const utterance = new SpeechSynthesisUtterance(nextSentence);
    // Calm, conversational human pacing (0.97x) and standard human pitch
    utterance.rate = 0.97;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    // Assign the selected high-quality natural voice
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    } else {
      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = findBestHumanVoice(voices);
      if (naturalVoice) {
        utterance.voice = naturalVoice;
        selectedVoiceRef.current = naturalVoice;
        setSelectedVoiceName(naturalVoice.name);
      }
    }

    utterance.onend = () => {
      processNextTtsSentence();
    };

    utterance.onerror = () => {
      processNextTtsSentence();
    };

    window.speechSynthesis.speak(utterance);
  }, [pauseRecognition, resumeRecognition]);

  // Enqueue a completed sentence to speak
  const enqueueTtsSentence = useCallback(
    (sentence: string) => {
      const cleaned = sentence.trim();
      if (!cleaned) return;
      ttsQueueRef.current.push(cleaned);

      if (!isTtsSpeakingRef.current) {
        pauseRecognition();
        processNextTtsSentence();
      }
    },
    [pauseRecognition, processNextTtsSentence]
  );

  // Feed incoming tokens from LLM SSE stream to break into sentences
  const feedAiToken = useCallback(
    (delta: string) => {
      if (!delta) return;
      sentenceBufferRef.current += delta;

      const sentenceRegex = /([\s\S]*?[.!?]+(?:\s+|$))([\s\S]*)/;
      let match = sentenceBufferRef.current.match(sentenceRegex);

      while (match) {
        const sentence = match[1];
        sentenceBufferRef.current = match[2] || '';
        enqueueTtsSentence(sentence);
        match = sentenceBufferRef.current.match(sentenceRegex);
      }
    },
    [enqueueTtsSentence]
  );

  // Signal that AI stream has completed; flush remaining buffer
  const finishAiStream = useCallback(() => {
    if (sentenceBufferRef.current.trim()) {
      enqueueTtsSentence(sentenceBufferRef.current.trim());
      sentenceBufferRef.current = '';
    }
  }, [enqueueTtsSentence]);

  // Cancel any active speech synthesis (barge-in / manual interruption)
  const stopAiSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      ttsQueueRef.current = [];
      sentenceBufferRef.current = '';
      isTtsSpeakingRef.current = false;
      resumeRecognition();
      setVoiceStatus('listening');
    }
  }, [resumeRecognition]);

  // ── Recognition lifecycle ────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (!isRecognitionSupported) return;

    stopAiSpeaking();

    isVoiceActiveRef.current = true;
    micPausedForTtsRef.current = false;
    setIsVoiceActive(true);
    setVoiceStatus('listening');

    fullTurnTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    speechStartTimeRef.current = null;
    wordCountRef.current = 0;
    fillerCountRef.current = 0;
    responseLatencyRef.current = null;

    resumeRecognition();
  }, [isRecognitionSupported, resumeRecognition, stopAiSpeaking]);

  const stopListening = useCallback(() => {
    isVoiceActiveRef.current = false;
    micPausedForTtsRef.current = false;
    setIsVoiceActive(false);
    setVoiceStatus('idle');

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const toggleVoiceMode = useCallback(() => {
    if (isVoiceActive) {
      stopListening();
    } else {
      startListening();
    }
  }, [isVoiceActive, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isVoiceActiveRef.current = false;
      micPausedForTtsRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isVoiceActive,
    voiceStatus,
    isSupported: isRecognitionSupported && isSynthesisSupported,
    isSynthesisSupported,
    interimTranscript,
    finalTranscript,
    metrics,
    availableVoices,
    selectedVoiceName,
    selectVoiceByName,
    startListening,
    stopListening,
    toggleVoiceMode,
    stopAiSpeaking,
    speakText: enqueueTtsSentence,
    commitTurnAnswer,
    feedAiToken,
    finishAiStream,
  };
}
