'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AlertCircle, ArrowRight, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { ReportView } from '@/components/interview/ReportView';
import { InterviewSessionState } from '@/hooks/useInterviewSession';

export default function InterviewDetailsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [interview, setInterview] = useState<InterviewSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchInterview = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(`/api/interviews/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.msg || 'Failed to fetch interview evaluation report');
        }

        const data = await response.json();
        if (!cancelled) {
          setInterview(data as InterviewSessionState);
          
          // Start polling if interview is completing
          if (data.status === 'completing' && !data.report) {
            setPolling(true);
            pollInterval = setInterval(async () => {
              try {
                const pollRes = await fetch(`/api/interviews/${id}`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                    'Content-Type': 'application/json',
                  },
                  cache: 'no-store',
                });
                if (pollRes.ok) {
                  const pollData = await pollRes.json();
                  if (!cancelled) {
                    setInterview(pollData as InterviewSessionState);
                    if (pollData.status === 'completed' || pollData.report) {
                      setPolling(false);
                      if (pollInterval) clearInterval(pollInterval);
                    }
                  }
                }
              } catch {
                // ignore polling errors
              }
            }, 2000);
          }
        }
      } catch (err: any) {
        console.error('Error fetching interview evaluation report:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load report');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchInterview();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [id, router]);

  if (loading) {
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
          <div className="w-12 h-12 rounded-xl border-2 border-black bg-yellow-200 flex items-center justify-center text-black mx-auto shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-base font-black text-black">Loading Assessment Report...</p>
        </div>
      </div>
    );
  }

  if (error || !interview) {
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
        <div className="relative z-10 max-w-md w-full bg-white/95 p-8 rounded-2xl border-4 border-black text-center space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-12 h-12 rounded-xl bg-rose-200 border-2 border-black text-rose-900 mx-auto flex items-center justify-center text-xl font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-black">Report Unavailable</h2>
          <p className="text-xs text-gray-800 leading-relaxed font-semibold">
            {error || 'The requested interview report could not be found.'}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-black text-white rounded-xl border-2 border-black text-xs font-black hover:bg-gray-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl border-2 border-black text-xs font-black hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active / in-progress interview reminder banner
  const isActive = interview.status === 'active';
  const isCompleting = interview.status === 'completing' && !interview.report;

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
        {isActive && (
          <div className="bg-amber-200 border-b-4 border-black text-black px-4 py-3 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-black shrink-0" />
              <span>This interview session is currently active/in-progress. Showing intermediate evaluation report.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(
                    'selectedRole',
                    JSON.stringify({
                      role: interview.role,
                      programmingLanguage: interview.programmingLanguage,
                      config: interview.config,
                    })
                  );
                }
                router.push('/interview');
              }}
              className="px-3.5 py-1.5 bg-black text-white rounded-xl border-2 border-black text-xs font-black hover:bg-gray-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-all"
            >
              <span>Resume Interview Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isCompleting && (
          <div className="bg-blue-100 border-b-4 border-black text-black px-4 py-4 shadow-sm">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <p className="font-black text-sm">Generating Your Performance Report...</p>
                  <p className="text-xs text-gray-700">AI is analyzing your responses, code, and communication metrics</p>
                </div>
              </div>
              <div className="w-full bg-white border-2 border-black rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full animate-pulse" 
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-xs text-gray-700 mt-2 text-center">
                This usually takes 30-60 seconds. You can <button 
                  onClick={() => router.push('/')} 
                  className="text-blue-600 underline hover:text-blue-800 font-bold"
                >go to Dashboard</button> and check back later.
              </p>
            </div>
          </div>
        )}

        {/* Modern, comprehensive Evaluation & Performance Report */}
        <ReportView interview={interview} />
      </div>
    </div>
  );
}
