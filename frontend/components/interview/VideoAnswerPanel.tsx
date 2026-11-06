'use client';

import React, { useRef, useState, useEffect } from 'react';

interface VideoAnswerPanelProps {
  isRecording: boolean;
  recordedVideoUrl: string | null;
  recordingTimer: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onResetRecording: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const VideoAnswerPanel: React.FC<VideoAnswerPanelProps> = ({
  isRecording,
  recordedVideoUrl,
  recordingTimer,
  onStartRecording,
  onStopRecording,
  onResetRecording,
  onSubmit,
  isSubmitting,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (!recordedVideoUrl && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraActive(true);
        })
        .catch(() => {
          setCameraActive(false);
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [recordedVideoUrl]);

  const mins = Math.floor(recordingTimer / 60);
  const secs = recordingTimer % 60;
  const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-center">
      <div className="relative mx-auto max-w-md aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {recordedVideoUrl ? (
          <video src={recordedVideoUrl} controls className="w-full h-full object-cover" />
        ) : cameraActive ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-400 text-xs p-4">
            Camera inactive. Please enable camera permissions to record video.
          </div>
        )}

        {isRecording && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-rose-600 text-white rounded-md text-xs font-bold font-mono flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>REC {timeFormatted}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {!recordedVideoUrl ? (
          !isRecording ? (
            <button
              type="button"
              onClick={onStartRecording}
              className="btn btn-primary text-xs px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-rose-300" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="6" />
              </svg>
              <span>Record Video</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopRecording}
              className="btn btn-secondary text-xs px-5 py-2.5 rounded-xl font-bold text-rose-600 flex items-center gap-2"
            >
              <span className="w-3 h-3 bg-rose-600 rounded-xs" />
              <span>Stop Recording</span>
            </button>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={onResetRecording}
              className="btn btn-secondary text-xs px-4 py-2 rounded-xl font-semibold"
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="btn btn-primary text-xs px-5 py-2.5 rounded-xl font-bold"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Video Answer'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
