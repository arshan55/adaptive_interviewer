'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Printer,
  RotateCcw,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mic,
  Code2,
  TrendingUp,
  Target,
  Award,
  FileText,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { InterviewSessionState } from '@/hooks/useInterviewSession';
import { ChatTranscript } from './ChatTranscript';

interface ReportViewProps {
  interview: InterviewSessionState;
  onInterviewUpdate?: (updated: InterviewSessionState) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ interview, onInterviewUpdate }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'report' | 'questions' | 'transcript'>('report');
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const report = interview.report;
  const isCompleting = interview.status === 'completing' && !report;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleExportMarkdown = () => {
    if (typeof window === 'undefined') return;
    const roleTitle = interview.role
      ? interview.role.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Software Engineer';

    let md = `# Interview Assessment Report: ${roleTitle}\n\n`;
    md += `**Date:** ${new Date(interview.date).toLocaleDateString()}\n`;
    md += `**Overall Score:** ${overallScore}/10\n\n`;
    md += `## Executive Summary\n${report?.summary || interview.overallFeedback || 'Completed evaluation.'}\n\n`;

    md += `## Top Strengths\n`;
    strengths.forEach((s: string) => { md += `- ${s}\n`; });
    md += `\n## Development Areas\n`;
    weaknesses.forEach((w: string) => { md += `- ${w}\n`; });

    md += `\n## Questions Breakdown\n`;
    (interview.questions || []).forEach((q, idx) => {
      md += `### Question ${idx + 1}: ${q.title || q.topic || 'Question'}\n`;
      md += `${q.questionText}\n\n`;
      if (q.score != null) md += `**Score:** ${q.score}/10\n`;
      if (q.signals) {
        md += `**Signals:** Correctness: ${q.signals.correctness || 'N/A'}/10 | Depth: ${q.signals.depth || 'N/A'}/10 | Clarity: ${q.signals.clarity || 'N/A'}/10\n`;
      }
      if (q.answerText) md += `**Answer:** ${q.answerText}\n\n`;
      if (q.codeAnswer) md += `\`\`\`${q.programmingLanguage || 'code'}\n${q.codeAnswer}\n\`\`\`\n\n`;
      if (q.feedback) md += `**Feedback:** ${q.feedback}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `interview-assessment-${interview.role || 'report'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/interviews/${interview._id}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'completed' || data.report) {
          // Navigate to the dedicated report page so the interview page
          // is not re-instantiated (which would restart it).
          router.push(`/interview/${interview._id}`);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isCompleting) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl border-4 border-black bg-yellow-200 flex items-center justify-center text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black text-black">
            Synthesizing Performance Evaluation...
          </h2>
          <p className="text-sm text-gray-800 font-medium max-w-md mx-auto">
            Evaluating STAR structural components, algorithmic test executions, and speech cadence telemetry.
          </p>
          <div className="w-full max-w-xs mx-auto bg-white border-2 border-black rounded-full h-3 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl border-2 border-black text-xs font-black hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Now</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-xl border-2 border-black text-xs font-black hover:bg-gray-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </button>
          </div>
          <p className="text-xs text-gray-600 font-medium">
            This usually takes 30-60 seconds. Check back or refresh manually.
          </p>
        </div>
      </div>
    );
  }

  const overallScore = Math.round(report?.overallScore ?? interview.overallScore ?? 7);
  const strengths = (report?.strengths || []).slice(0, 3);
  const weaknesses = (report?.weaknesses || []).slice(0, 3);
  const recommendations = (
    report?.nextPracticeRecommendations ||
    report?.recommendations ||
    []
  ).slice(0, 3);
  const communication = report?.communicationSummary;
  const perQuestionBreakdown = report?.perQuestionBreakdown || [];

  const roleTitle = interview.role
    ? interview.role.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Software Engineer';

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8 print:py-0 print:px-0">
      {/* Top Bar Actions */}
      <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-black">
              Performance Assessment
            </h1>
            <span className="px-2.5 py-0.5 rounded-full border-2 border-black text-xs font-black uppercase tracking-wider bg-emerald-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Completed
            </span>
          </div>
          <p className="text-xs text-gray-800 mt-1 font-semibold">
            Role: <strong className="text-black">{roleTitle}</strong>
            {interview.programmingLanguage && (
              <span> • Language: <strong className="text-black">{interview.programmingLanguage}</strong></span>
            )}
            {' '}• Date: <strong className="text-black">{new Date(interview.date).toLocaleDateString()}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="py-2 px-3.5 rounded-xl border-2 border-black text-xs font-bold text-black bg-white hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-all"
            title="Export formatted report as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="py-2 px-3.5 rounded-xl border-2 border-black text-xs font-bold text-black bg-white hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-all"
            title="Export markdown report"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Markdown</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/interview/role-select')}
            className="py-2 px-4 rounded-xl border-2 border-black text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Interview</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="py-2 px-3.5 rounded-xl border-2 border-black text-xs font-bold text-black bg-white hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-all"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>

      {/* Hero Score & Summary Card */}
      <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-center gap-8">
        {/* Big Bold Score Badge */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl border-4 border-black bg-yellow-200 flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
          <span className="text-4xl sm:text-5xl font-mono font-black text-black leading-none">
            {overallScore}
          </span>
          <span className="text-xs font-black text-black uppercase mt-1 tracking-wider">
            Out of 10
          </span>
        </div>

        {/* Executive Summary */}
        <div className="flex-1 space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black text-xs font-black uppercase tracking-wider bg-yellow-200 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Award className="w-3.5 h-3.5 text-blue-700" />
            <span>Hiring Bar Verdict</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-black leading-snug">
            {overallScore >= 8
              ? 'Strong Hire Recommendation'
              : overallScore >= 6
              ? 'Competitive Candidate — Minor Development Areas'
              : 'Developing Candidate — Requires Targeted Practice'}
          </h2>
          <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
            {report?.summary ||
              interview.overallFeedback ||
              communication?.notes ||
              'Candidate demonstrated clear articulation and structured problem-solving across core benchmarks.'}
          </p>
        </div>
      </div>

      {/* 3 Short Strengths & 3 Short Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths Card */}
        <div className="rounded-2xl border-4 border-black p-6 sm:p-7 space-y-4 bg-emerald-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Top Strengths</span>
          </div>
          <ul className="space-y-3">
            {strengths.map((str: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-gray-900 font-bold leading-snug">
                <span className="text-black font-black mt-0.5">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements Card */}
        <div className="rounded-2xl border-4 border-black p-6 sm:p-7 space-y-4 bg-amber-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>Focus Areas</span>
          </div>
          <ul className="space-y-3">
            {weaknesses.map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-gray-900 font-bold leading-snug">
                <span className="text-black font-black mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-3 print:hidden">
        {[
          { id: 'report', label: 'Performance Telemetry', icon: Target },
          { id: 'questions', label: `Question Breakdown (${perQuestionBreakdown.length || interview.questions.length})`, icon: FileText },
          { id: 'transcript', label: `Full Dialogue (${interview.turns?.length || 0} turns)`, icon: Mic },
        ].map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-4 rounded-xl border-2 border-black text-xs font-black flex items-center gap-2 transition-all ${
                active
                  ? 'bg-yellow-200 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                  : 'bg-white text-gray-800 hover:bg-slate-100 shadow-sm'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Performance Telemetry & Recommendations */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Communication Telemetry Card */}
          {communication && (
            <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 space-y-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-600" />
                <span>Speech Telemetry & Delivery Cadence</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl border-2 border-black bg-slate-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-3xl font-black text-black font-mono">
                    {communication.averageWpm > 0 ? communication.averageWpm : 'N/A'}
                  </div>
                  <div className="text-xs font-bold text-black">Words Per Minute</div>
                  <div className="text-[11px] text-gray-600 font-medium">
                    {communication.averageWpm > 0 ? 'Target: 120-160 WPM' : 'No speech cadence data'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-black bg-slate-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-3xl font-black text-black font-mono">
                    {communication.totalFillerWords || 0}
                  </div>
                  <div className="text-xs font-bold text-black">Filler Words</div>
                  <div className="text-[11px] text-gray-600 font-medium">Target: &lt; 5 per session</div>
                </div>

                <div className="p-4 rounded-xl border-2 border-black bg-slate-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-sm font-black text-black pt-1.5">
                    {communication.paceAssessment || 'Optimal Cadence'}
                  </div>
                  <div className="text-xs font-bold text-black mt-2">Delivery Assessment</div>
                  <div className="text-[11px] text-gray-600 font-medium">Speech composure</div>
                </div>
              </div>
            </div>
          )}

          {/* Targeted Next Practice Plan */}
          {recommendations.length > 0 && (
            <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Recommended Next Practice Actions</span>
              </h3>
              <ol className="list-decimal pl-5 space-y-2.5 text-sm sm:text-base text-gray-900 font-bold">
                {recommendations.map((rec: string, i: number) => (
                  <li key={i} className="leading-snug">{rec}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Collapsible Per-Question List */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {(perQuestionBreakdown.length > 0 ? perQuestionBreakdown : interview.questions).map(
            (q: any, idx: number) => {
              const isExpanded = expandedQuestionIdx === idx;
              const matchingQ = interview.questions[idx];
              const score = q.score ?? matchingQ?.score ?? 7;

              return (
                <div key={idx} className="bg-white/95 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setExpandedQuestionIdx(isExpanded ? null : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-start justify-between gap-4 hover:bg-yellow-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <span className="w-8 h-8 rounded-xl border-2 border-black bg-yellow-200 text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        Q{idx + 1}
                      </span>
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                          {q.topic || matchingQ?.topic || 'General Problem'}
                        </span>
                        <h4 className="text-base sm:text-lg font-black text-black leading-snug">
                          {q.questionText || matchingQ?.questionText}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-black text-sm text-black px-2.5 py-1 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {score}/10
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-black" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-black" />
                      )}
                    </div>
                  </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-6 pb-6 pt-2 border-t-2 border-black/10 space-y-4"
                          >
                            {/* Candidate Answer Section */}
                            <div className="bg-white p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2">
                              <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-blue-600" />
                                Candidate Given Answer:
                              </span>
                              <div className="text-sm text-gray-900 font-medium whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {q.candidateAnswer || matchingQ?.answerText || matchingQ?.codeAnswer || 'Spoken interview answer recorded in audio transcript.'}
                              </div>
                            </div>

                            {/* AI Detailed Feedback */}
                            {(q.feedback || matchingQ?.feedback) && (
                              <div className="bg-amber-50 p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-amber-600" />
                                  AI Feedback & Assessment:
                                </span>
                                <div className="text-sm text-gray-900 font-semibold leading-relaxed">
                                  {q.feedback || matchingQ?.feedback}
                                </div>
                              </div>
                            )}

                            {/* Coding Solution snippet if present */}
                            {matchingQ?.codeAnswer && (
                              <div className="space-y-1">
                                <span className="text-xs font-black uppercase tracking-wider text-black">
                                  Submitted Code Solution ({matchingQ.programmingLanguage || 'code'}):
                                </span>
                                <pre className="p-4 rounded-xl border-2 border-black bg-slate-900 text-white text-xs font-mono overflow-x-auto shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                  <code>{matchingQ.codeAnswer}</code>
                                </pre>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* TAB 3: Dialogue Transcript */}
      {activeTab === 'transcript' && (
        <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
            <div>
              <h3 className="text-sm font-black text-black uppercase tracking-wider">
                Full Dialogue Transcript
              </h3>
              <p className="text-xs text-gray-700 font-medium">Chronological turn-by-turn dialogue between candidate and AI</p>
            </div>
            <span className="text-xs font-mono font-black text-black px-2.5 py-1 rounded-lg border-2 border-black bg-yellow-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {interview.turns?.length || 0} Turns
            </span>
          </div>

          <ChatTranscript turns={interview.turns || []} />
        </div>
      )}
    </div>
  );
};
