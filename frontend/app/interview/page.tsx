'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MessageSquare,
  HelpCircle,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

import { useInterviewSession } from '@/hooks/useInterviewSession';
import { useCodeRunner } from '@/hooks/useCodeRunner';
import { useVoiceInterviewer } from '@/lib/speech/useVoiceInterviewer';

import { InterviewRoomHeader } from '@/components/interview/InterviewRoomHeader';
import { QuestionPanel } from '@/components/interview/QuestionPanel';
import { CodeEditorPanel } from '@/components/interview/CodeEditorPanel';
import { VoiceConversationPanel } from '@/components/interview/VoiceConversationPanel';
import { ChatTranscript } from '@/components/interview/ChatTranscript';
import { FeedbackPanel } from '@/components/interview/FeedbackPanel';
import { ReportView } from '@/components/interview/ReportView';

export default function InterviewPage() {
  const pathname = usePathname();
  const pathSegments = pathname.split('/');
  const rawId = pathSegments[pathSegments.length - 1];
  const interviewId = rawId && rawId !== 'interview' ? rawId : null;

  const {
    interview,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentQuestion,
    isCodingQuestion,
    codingProblemDetails,
    loading,
    error,
    isGeneratingFeedback,
    isFinishing,
    streamingAiMessage,
    submitTurn,
    finishSession,
  } = useInterviewSession(interviewId);

  const {
    isRunningCode,
    testSummary,
    consoleOutput,
    isConsoleOpen,
    setIsConsoleOpen,
    executeCode,
    resetCodeRunner,
  } = useCodeRunner();

  // Answer states
  const [answerMode, setAnswerMode] = useState<'voice' | 'text'>('voice');
  const [textAnswer, setTextAnswer] = useState('');
  const [codeContent, setCodeContent] = useState('');
  const [selectedCodingLanguage, setSelectedCodingLanguage] = useState('javascript');
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Set default code snippet or language from interview config
  useEffect(() => {
    if (interview?.programmingLanguage) {
      setSelectedCodingLanguage(interview.programmingLanguage.toLowerCase());
    }
  }, [interview?.programmingLanguage]);

  // Set code signature when coding question or language changes
  useEffect(() => {
    if (isCodingQuestion && codingProblemDetails?.functionSignature) {
      const sig =
        codingProblemDetails.functionSignature[selectedCodingLanguage] ||
        codingProblemDetails.functionSignature['javascript'] ||
        '';
      setCodeContent(sig);
    } else if (!isCodingQuestion) {
      setCodeContent('');
    }
  }, [isCodingQuestion, codingProblemDetails, selectedCodingLanguage, currentQuestionIndex]);

  // Voice interviewer integration
  const voiceInterviewer = useVoiceInterviewer({
    onTurnAutoSubmit: (transcript, voiceMetrics) => {
      submitTurn({
        text: transcript,
        metrics: voiceMetrics,
        onToken: (delta) => voiceInterviewer.feedAiToken(delta),
        onDone: (comp) => {
          voiceInterviewer.finishAiStream();
          if (comp?.action === 'wrap_up') {
            voiceInterviewer.stopListening();
            if (comp?.message) {
              voiceInterviewer.speakText(comp.message);
            }
          }
        },
      });
    },
  });

  // Stop mic immediately whenever interview status moves to completing or completed
  useEffect(() => {
    if (interview?.status === 'completing' || interview?.status === 'completed' || interview?.report) {
      voiceInterviewer.stopListening();
      voiceInterviewer.stopAiSpeaking();
    }
  }, [interview?.status, interview?.report]);

  // Track whether the current question has been spoken aloud by the AI
  const lastSpokenQuestionIdxRef = React.useRef<number | null>(null);

  // Automatically speak out the question aloud when changing to a new question
  useEffect(() => {
    if (
      interview?.status === 'active' &&
      currentQuestion?.questionText &&
      lastSpokenQuestionIdxRef.current !== currentQuestionIndex &&
      voiceInterviewer.isSupported
    ) {
      lastSpokenQuestionIdxRef.current = currentQuestionIndex;
      // Slight delay so the user sees the transition before speaking begins
      const timer = setTimeout(() => {
        let textToSpeak = currentQuestion.questionText;

        if (isCodingQuestion) {
          const title = currentQuestion.title;
          if (title) {
            textToSpeak = `Here is your next coding challenge: ${title}. Please review the problem description and implement your solution in the code editor.`;
          } else {
            textToSpeak = `Please review this technical coding challenge and implement your solution in the code editor.`;
          }
        }

        voiceInterviewer.speakText(textToSpeak);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentQuestionIndex, currentQuestion?.questionText, currentQuestion?.title, isCodingQuestion, interview?.status, voiceInterviewer.isSupported]);

  // Reset runner and code when question changes
  useEffect(() => {
    resetCodeRunner();
    setTextAnswer('');
  }, [currentQuestionIndex, resetCodeRunner]);

  const existingTurns = interview?.turns || [];
  const followupsUsed = existingTurns.filter(
    (t) => t.speaker === 'ai' && t.type === 'followup' && t.questionRef === currentQuestion?.questionId
  ).length;
  const hintsUsed = existingTurns.filter(
    (t) => t.speaker === 'ai' && t.type === 'hint' && t.questionRef === currentQuestion?.questionId
  ).length;
  const hintsRemaining = Math.max(0, 2 - hintsUsed);
  const followupsRemaining = Math.max(0, 2 - followupsUsed);

  // Check if there is an active pending follow-up question asked by the AI for the current question
  const currentQuestionTurns = existingTurns.filter(
    (t) => t.questionRef === currentQuestion?.questionId
  );
  const lastTurn = currentQuestionTurns[currentQuestionTurns.length - 1];
  const hasActiveFollowup = Boolean(lastTurn && lastTurn.speaker === 'ai' && lastTurn.type === 'followup');
  const activeFollowupText = hasActiveFollowup ? lastTurn?.text : null;

  // Voice state: In coding questions, voice auto-listen is disabled by default to prevent accidental turns while typing,
  // UNLESS the AI has just asked a follow-up question (e.g. TC/SC question) that requires the candidate to speak!
  useEffect(() => {
    if (isCodingQuestion && !hasActiveFollowup) {
      if (voiceInterviewer.isVoiceActive) {
        voiceInterviewer.stopListening();
      }
    } else if (
      interview?.status === 'active' &&
      interview?.config?.voice &&
      voiceInterviewer.isSupported &&
      !voiceInterviewer.isVoiceActive
    ) {
      voiceInterviewer.startListening();
      setAnswerMode('voice');
    }
  }, [isCodingQuestion, hasActiveFollowup, interview?.status, interview?.config?.voice, voiceInterviewer.isSupported]);

  const handleRunCode = async () => {
    await executeCode(codeContent, selectedCodingLanguage, codingProblemDetails);
  };

  const handleSubmitCode = async () => {
    if (!codeContent.trim()) return;
    await submitTurn({
      text: codeContent,
      code: codeContent,
      language: selectedCodingLanguage,
      testSummary,
      onToken: (delta) => voiceInterviewer.feedAiToken(delta),
      onDone: () => voiceInterviewer.finishAiStream(),
    });
  };

  const handleRequestHint = async () => {
    if (isGeneratingFeedback) return;
    await submitTurn({
      text: "Could you give me a slight hint or guidance on the approach for this coding problem?",
      code: codeContent || undefined,
      language: selectedCodingLanguage,
      onToken: (delta) => voiceInterviewer.feedAiToken(delta),
      onDone: () => voiceInterviewer.finishAiStream(),
    });
  };

  const handleSubmitText = async () => {
    if (!textAnswer.trim()) return;
    await submitTurn({
      text: textAnswer,
      onToken: (delta) => voiceInterviewer.feedAiToken(delta),
      onDone: () => {
        voiceInterviewer.finishAiStream();
        setTextAnswer('');
      },
    });
  };

  // Loading skeleton state
  if (loading && !interview) {
    return (
      <div
        className="min-h-screen bg-[#F0F4F8] relative flex items-center justify-center p-4"
        style={{
          backgroundImage: 'url(/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-white/80 z-0" />
        <div className="relative z-10 max-w-md w-full bg-white/95 rounded-2xl border-4 border-black p-8 text-center space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-12 h-12 rounded-xl bg-yellow-200 border-2 border-black flex items-center justify-center text-black mx-auto shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-black">Preparing Interview Room...</h3>
            <p className="text-xs text-gray-700 font-medium">Retrieving calibrated questions & scoring rubrics</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div
        className="min-h-screen bg-[#F0F4F8] relative flex items-center justify-center p-4"
        style={{
          backgroundImage: 'url(/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-white/80 z-0" />
        <div className="relative z-10 max-w-md w-full bg-white/95 rounded-2xl border-4 border-black p-8 text-center space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-12 h-12 rounded-xl bg-rose-200 border-2 border-black text-rose-900 mx-auto flex items-center justify-center text-xl font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-black">Session Error</h2>
          <p className="text-xs text-gray-800 leading-relaxed font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-black font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!interview) return null;

  // Completed report view
  if (interview.status === 'completed' || interview.status === 'completing' || interview.report) {
    return (
      <div
        className="min-h-screen bg-[#F0F4F8] relative"
        style={{
          backgroundImage: 'url(/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-white/80 z-0 pointer-events-none" />
        <div className="relative z-10">
          <ReportView interview={interview} />
        </div>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex >= (interview?.questions?.length || 1) - 1;
  const isQuestionAnswered = Boolean(currentQuestion?.feedback || currentQuestion?.score != null);

  return (
    <div
      className="min-h-screen bg-[#F0F4F8] relative flex flex-col selection:bg-yellow-200 selection:text-black"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-white/80 z-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col flex-1">
        {/* 1. Slim Top Bar (Exit, Question dots, Timer) */}
        <InterviewRoomHeader
          currentQuestionIndex={currentQuestionIndex}
          totalQuestions={interview.questions.length}
          durationMin={interview.config?.durationMin}
          startedAt={interview.date}
          onFinish={finishSession}
          isFinishing={isFinishing}
        />

        {/* 2. Simplified Focused Workspace: ONE thing at a time */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
          {/* Secondary controls header: Mode toggle & More menu */}
          <div className="flex items-center justify-between text-xs">
            {(!isCodingQuestion || hasActiveFollowup) ? (
              <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <button
                  type="button"
                  onClick={() => {
                    setAnswerMode('voice');
                    if (!voiceInterviewer.isVoiceActive && voiceInterviewer.isSupported) {
                      voiceInterviewer.startListening();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all ${
                    answerMode === 'voice'
                      ? 'bg-yellow-200 text-black border border-black shadow-xs'
                      : 'text-gray-700 hover:text-black'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Voice</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnswerMode('text');
                    voiceInterviewer.stopListening();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all ${
                    answerMode === 'text'
                      ? 'bg-yellow-200 text-black border border-black shadow-xs'
                      : 'text-gray-700 hover:text-black'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Type</span>
                </button>
              </div>
            ) : (
              <div className="text-xs font-bold text-black bg-white px-3 py-1.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                Coding Challenge • Language: <strong className="uppercase text-blue-700">{selectedCodingLanguage}</strong>
              </div>
            )}

            {/* Secondary Actions (More Menu) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 rounded-xl border-2 border-black bg-white text-black hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl p-1.5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-30 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTranscriptModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-black hover:bg-yellow-100 rounded-lg flex items-center gap-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>View Dialogue History</span>
                  </button>
                  {isCodingQuestion && hintsRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        alert(`Hints remaining for this question: ${hintsRemaining}/2`);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-black hover:bg-yellow-100 rounded-lg flex items-center gap-2"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Request Hint ({hintsRemaining} left)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center Question with Dynamic Follow-up State */}
          <QuestionPanel
            question={currentQuestion}
            questionIndex={currentQuestionIndex}
            totalQuestions={interview.questions.length}
            isCodingQuestion={isCodingQuestion}
            patterns={interview.config?.patterns}
            followupsRemaining={followupsRemaining}
            hintsRemaining={hintsRemaining}
            activeFollowup={activeFollowupText}
          />

          {/* Inline Reviewing State: Never blanks the screen */}
          <AnimatePresence>
            {isGeneratingFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border-3 border-black p-4 bg-yellow-200 text-black flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-sm"
              >
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-black animate-bounce" />
                </div>
                <span>Reviewing your response against evaluation rubric...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ONE Answer Area */}
          <div className="space-y-6">
            {/* If there is an active AI follow-up (e.g. TC/SC question asked on code), prioritize Voice/Text answer input */}
            {hasActiveFollowup ? (
              answerMode === 'voice' ? (
                <VoiceConversationPanel
                  isVoiceActive={voiceInterviewer.isVoiceActive}
                  voiceStatus={voiceInterviewer.voiceStatus}
                  isSupported={voiceInterviewer.isSupported}
                  finalTranscript={voiceInterviewer.finalTranscript}
                  interimTranscript={voiceInterviewer.interimTranscript}
                  streamingAiMessage={streamingAiMessage}
                  metrics={voiceInterviewer.metrics}
                  onToggleVoice={voiceInterviewer.toggleVoiceMode}
                  onInterruptAi={voiceInterviewer.stopAiSpeaking}
                  onCommitSpeech={voiceInterviewer.commitTurnAnswer}
                  isSubmitting={isGeneratingFeedback}
                  availableVoices={voiceInterviewer.availableVoices}
                  selectedVoiceName={voiceInterviewer.selectedVoiceName}
                  onSelectVoice={voiceInterviewer.selectVoiceByName}
                />
              ) : (
                <div className="rounded-2xl border-4 border-black p-6 sm:p-8 space-y-4 bg-white/95 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <label htmlFor="followup-ans" className="text-xs font-black uppercase tracking-wider text-black block">
                    Type your answer to the interviewer's question:
                  </label>
                  <textarea
                    id="followup-ans"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="e.g. The time complexity is O(N log N) because we insert each element into a heap..."
                    className="w-full min-h-[140px] p-4 text-base font-medium rounded-xl border-2 border-black bg-white text-black placeholder-gray-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isGeneratingFeedback}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSubmitText}
                      disabled={isGeneratingFeedback || !textAnswer.trim()}
                      className="py-2.5 px-6 rounded-xl border-2 border-black font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
                  </div>
                </div>
              )
            ) : isCodingQuestion ? (
              <CodeEditorPanel
                code={codeContent}
                onChange={setCodeContent}
                selectedLanguage={selectedCodingLanguage}
                onLanguageChange={setSelectedCodingLanguage}
                onRunCode={handleRunCode}
                onSubmitSolution={handleSubmitCode}
                onRequestHint={handleRequestHint}
                hintsRemaining={hintsRemaining}
                isRunningCode={isRunningCode}
                isSubmitting={isGeneratingFeedback}
                testSummary={testSummary}
                consoleOutput={consoleOutput}
                isConsoleOpen={isConsoleOpen}
                onToggleConsole={() => setIsConsoleOpen(!isConsoleOpen)}
              />
            ) : answerMode === 'voice' ? (
              <VoiceConversationPanel
                isVoiceActive={voiceInterviewer.isVoiceActive}
                voiceStatus={voiceInterviewer.voiceStatus}
                isSupported={voiceInterviewer.isSupported}
                finalTranscript={voiceInterviewer.finalTranscript}
                interimTranscript={voiceInterviewer.interimTranscript}
                streamingAiMessage={streamingAiMessage}
                metrics={voiceInterviewer.metrics}
                onToggleVoice={voiceInterviewer.toggleVoiceMode}
                onInterruptAi={voiceInterviewer.stopAiSpeaking}
                onCommitSpeech={voiceInterviewer.commitTurnAnswer}
                isSubmitting={isGeneratingFeedback}
                availableVoices={voiceInterviewer.availableVoices}
                selectedVoiceName={voiceInterviewer.selectedVoiceName}
                onSelectVoice={voiceInterviewer.selectVoiceByName}
              />
            ) : (
              /* Clean Text Answer Area */
              <div className="rounded-2xl border-4 border-black p-6 sm:p-8 space-y-4 bg-white/95 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <label htmlFor="text-ans" className="text-xs font-black uppercase tracking-wider text-black block">
                  Type your structured answer (STAR format recommended)
                </label>
                <textarea
                  id="text-ans"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Describe Situation, Task, Action you took, and measurable Results..."
                  className="w-full min-h-[160px] p-4 text-base font-medium rounded-xl border-2 border-black bg-white text-black placeholder-gray-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isGeneratingFeedback}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitText}
                    disabled={isGeneratingFeedback || !textAnswer.trim()}
                    className="py-2.5 px-6 rounded-xl border-2 border-black font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    Submit Answer
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Bar: Clean forward progression */}
            <div className="flex items-center justify-between pt-4 border-t-2 border-black/15">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="py-2.5 px-4 rounded-xl border-2 border-black font-bold text-xs text-black bg-white hover:bg-slate-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 disabled:opacity-30 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {!isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="py-2.5 px-6 rounded-xl border-2 border-black font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    voiceInterviewer.stopListening();
                    voiceInterviewer.stopAiSpeaking();
                    await finishSession();
                  }}
                  disabled={isGeneratingFeedback}
                  className="py-2.5 px-6 rounded-xl border-2 border-black font-black text-xs text-white bg-black hover:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Complete & View Report</span>
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Dialogue Transcript Slide-over / Modal */}
        {showTranscriptModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-lg bg-white h-full border-l-4 border-black shadow-2xl p-6 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <h3 className="text-base font-black text-black">Dialogue History</h3>
                <button
                  type="button"
                  onClick={() => setShowTranscriptModal(false)}
                  className="py-1 px-3 rounded-lg border-2 border-black font-bold text-xs bg-white hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatTranscript turns={existingTurns} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
