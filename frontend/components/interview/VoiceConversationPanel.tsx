'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, ArrowUp, Volume2, Sparkles, CheckCircle2, Sliders } from 'lucide-react';
import { VoiceMetrics } from '@/lib/speech/useVoiceInterviewer';

interface VoiceConversationPanelProps {
  isVoiceActive: boolean;
  voiceStatus: 'idle' | 'listening' | 'speaking' | 'submitting';
  isSupported: boolean;
  finalTranscript: string;
  interimTranscript: string;
  streamingAiMessage: string | null;
  metrics: VoiceMetrics;
  onToggleVoice: () => void;
  onInterruptAi: () => void;
  onCommitSpeech: () => void;
  isSubmitting?: boolean;
  availableVoices?: SpeechSynthesisVoice[];
  selectedVoiceName?: string;
  onSelectVoice?: (voiceName: string) => void;
}

export const VoiceConversationPanel: React.FC<VoiceConversationPanelProps> = ({
  isVoiceActive,
  voiceStatus,
  isSupported,
  finalTranscript,
  interimTranscript,
  streamingAiMessage,
  onToggleVoice,
  onInterruptAi,
  onCommitSpeech,
  isSubmitting = false,
  availableVoices = [],
  selectedVoiceName = '',
  onSelectVoice,
}) => {
  const isAiSpeaking = voiceStatus === 'speaking';
  const isListening = voiceStatus === 'listening' && isVoiceActive;

  return (
    <div className="rounded-2xl border-4 border-black p-6 sm:p-8 space-y-6 flex flex-col items-center text-center bg-white/95 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      {/* Unsupported browser alert */}
      {!isSupported && (
        <div className="w-full bg-amber-100 border-2 border-black rounded-xl p-3 text-black text-xs font-bold text-left shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          Speech recognition is not fully supported in this browser. Please use the Type tab to enter your answer.
        </div>
      )}

      {/* Voice Selection Controls & Natural Badge */}
      {availableVoices.length > 0 && (
        <div className="w-full flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border-2 border-black bg-slate-50 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-black text-black">AI Voice:</span>
            <select
              value={selectedVoiceName}
              onChange={(e) => onSelectVoice?.(e.target.value)}
              className="bg-white border-2 border-black rounded-lg px-2 py-1 font-bold text-black text-xs cursor-pointer focus:outline-none max-w-[220px] truncate shadow-xs"
            >
              {availableVoices.map((v) => {
                const isNatural =
                  v.name.includes('(Natural)') ||
                  v.name.includes('Neural') ||
                  v.name.includes('Google') ||
                  v.name.includes('Enhanced');
                const displayName = v.name
                  .replace(/Microsoft\s*/i, '')
                  .replace(/Google\s*/i, 'Google ')
                  .replace(/English\s*\([^)]*\)/i, '')
                  .trim();

                return (
                  <option key={v.name} value={v.name}>
                    {displayName} {isNatural ? '(Natural Studio)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-black bg-emerald-100 text-emerald-950 font-black text-[11px]">
            <Sparkles className="w-3 h-3 text-emerald-700" />
            <span>Human-Grade Voice</span>
          </span>
        </div>
      )}

      {/* Big Mic Button with Pulse Ring & Neo-brutalist Border */}
      <div className="relative py-2">
        {/* Pulse animation rings while recording/listening */}
        {isListening && (
          <>
            <motion.div
              animate={{ scale: [1, 1.35, 1.55], opacity: [0.6, 0.2, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-rose-400 pointer-events-none"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1.35], opacity: [0.7, 0.3, 0] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-rose-300 pointer-events-none"
            />
          </>
        )}

        <button
          type="button"
          onClick={isAiSpeaking ? onInterruptAi : onToggleVoice}
          className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-black flex flex-col items-center justify-center transition-all select-none cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 ${
            isAiSpeaking
              ? 'bg-amber-400 text-black hover:bg-amber-500'
              : isListening
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={isListening ? 'Click to pause/stop recording' : 'Click to start voice recording'}
        >
          {isAiSpeaking ? (
            <>
              <Volume2 className="w-8 h-8 animate-pulse mb-1 text-black" />
              <span className="text-[10px] font-black uppercase tracking-wider text-black">AI Speaking</span>
            </>
          ) : isListening ? (
            <>
              <Square className="w-7 h-7 fill-current mb-1" />
              <span className="text-[10px] font-black uppercase tracking-wider">Recording</span>
            </>
          ) : (
            <>
              <Mic className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-black uppercase tracking-wider">Speak Now</span>
            </>
          )}
        </button>
      </div>

      {/* Status Cue */}
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-wider text-black">
          {isAiSpeaking
            ? 'Interviewer is speaking (click to interrupt)'
            : isListening
            ? 'Listening... Speak your answer clearly'
            : 'Click the button above to begin speaking'}
        </p>
        <p className="text-xs text-gray-700 font-medium max-w-sm mx-auto">
          {isListening
            ? 'When you pause speaking, your response will automatically submit.'
            : 'Voice responses are automatically transcribed and scored for clarity & content.'}
        </p>
      </div>

      {/* Streaming AI Followup / Interrupt Speech */}
      {streamingAiMessage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-blue-100 border-2 border-black rounded-xl p-4 text-left shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
            <Volume2 className="w-3.5 h-3.5 text-blue-700" />
            <span>Interviewer Voice Response</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-relaxed">
            {streamingAiMessage}
          </p>
        </motion.div>
      )}

      {/* Live Transcript Display Box */}
      {(finalTranscript || interimTranscript) && (
        <div className="w-full bg-yellow-50/70 rounded-xl border-2 border-black p-4 text-left space-y-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-xs font-bold text-black">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Speech Transcript
            </span>
            {isListening && (
              <span className="text-gray-600 text-[11px] font-medium">Recording in progress</span>
            )}
          </div>
          <p className="text-sm sm:text-base font-medium text-black leading-relaxed">
            <span>{finalTranscript}</span>{' '}
            <span className="text-gray-500 italic">{interimTranscript}</span>
          </p>
        </div>
      )}

      {/* Manual Submit Action */}
      {finalTranscript && isListening && (
        <button
          type="button"
          onClick={onCommitSpeech}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border-2 border-black text-xs font-black text-white bg-black hover:bg-gray-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{isSubmitting ? 'Evaluating...' : 'Submit Answer Now'}</span>
        </button>
      )}
    </div>
  );
};
