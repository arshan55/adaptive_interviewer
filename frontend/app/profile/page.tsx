'use client';

import React, { useEffect, useState } from 'react';
import { User, Mail, Award, Sparkles, CheckCircle2, FileText, Upload, Trash2 } from 'lucide-react';

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalInterviews, setTotalInterviews] = useState<number | null>(null);

  // Resume state
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState<string | null>(null);
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [resumeSaveMsg, setResumeSaveMsg] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          setUserProfile(null);
          setLoading(false);
          return;
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/auth`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          setUserProfile(null);
        } else {
          const data = await res.json();
          setUserProfile(data);
        }
      } catch (err) {
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchTotalInterviews = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/interviews/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setTotalInterviews(Array.isArray(data) ? data.length : (data.total || 0));
        }
      } catch {}
    };
    fetchTotalInterviews();
  }, []);

  // Fetch saved resume on load
  useEffect(() => {
    const fetchResume = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/resume`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.resumeText) {
            setResumeText(data.resumeText);
            setResumeFileName(data.resumeFileName || 'Uploaded Resume');
            setResumeUpdatedAt(data.resumeUpdatedAt || null);
          }
        }
      } catch {}
    };
    fetchResume();
  }, []);

  const handleResumeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFileName(file.name);
    setIsSavingResume(true);
    setResumeSaveMsg('');

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const lowerName = file.name.toLowerCase();

    // If PDF or Word (.docx), upload to backend document parser endpoint
    if (lowerName.endsWith('.pdf') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      try {
        const formData = new FormData();
        formData.append('resumeFile', file);

        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/resume/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.resumeText) {
          setResumeText(data.resumeText);
          setResumeUpdatedAt(data.resumeUpdatedAt || new Date().toISOString());
          setResumeSaveMsg('Resume document parsed & saved successfully!');
          setTimeout(() => setResumeSaveMsg(''), 3000);
        } else {
          setResumeSaveMsg(data.msg || 'Could not parse document. Please paste the text directly.');
        }
      } catch {
        setResumeSaveMsg('Failed to upload and parse document.');
      } finally {
        setIsSavingResume(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setResumeText(content);
      setIsSavingResume(false);
    };
    reader.readAsText(file);
  };

  const handleSaveResume = async () => {
    if (!resumeText.trim()) return;
    setIsSavingResume(true);
    setResumeSaveMsg('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeText, fileName: resumeFileName || 'Pasted Resume' }),
      });
      if (res.ok) {
        const data = await res.json();
        setResumeUpdatedAt(data.resumeUpdatedAt);
        setResumeSaveMsg('Resume saved successfully!');
        setTimeout(() => setResumeSaveMsg(''), 3000);
      }
    } catch {
      setResumeSaveMsg('Failed to save resume. Try again.');
    } finally {
      setIsSavingResume(false);
    }
  };

  const handleClearResume = async () => {
    setResumeText('');
    setResumeFileName(null);
    setResumeUpdatedAt(null);
    // Clear in backend
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeText: ' ', fileName: null }),
      });
    } catch {}
  };

  const avatars = [
    '/man (1).png',
    '/man.png',
    '/woman (1).png',
    '/woman.png',
  ];
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setSelectedAvatar(userProfile.avatar || localStorage.getItem('selectedAvatar') || avatars[0]);
    }
  }, [userProfile]);

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
    localStorage.setItem('selectedAvatar', avatar);
    setShowAvatarModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] relative flex flex-col justify-center items-center" style={{ backgroundImage: 'url(/background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-white/75 z-0" />
        <div className="relative z-10 bg-white rounded-2xl border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-lg font-black text-black">Loading candidate profile...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] relative flex flex-col justify-center items-center p-4" style={{ backgroundImage: 'url(/background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-white/75 z-0" />
        <div className="relative z-10 bg-white rounded-2xl border-4 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center space-y-3">
          <p className="text-rose-600 font-black text-xl">User profile not found. Please log in again.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F0F4F8] relative py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 w-full h-full bg-white/75 z-0 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <div className="bg-white/95 rounded-2xl border-4 border-black p-8 sm:p-12 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Avatar side */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <img
                src={selectedAvatar || userProfile.avatar || userProfile.profilePicture || '/logoo.png'}
                alt="Profile"
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowAvatarModal(true)}
              />
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="absolute bottom-0 right-0 bg-yellow-300 text-black border-2 border-black rounded-full p-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs font-black hover:bg-yellow-400"
                title="Change avatar"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="mt-3 text-xs font-black text-blue-700 hover:underline"
            >
              Change Avatar
            </button>
          </div>

          {/* Details side */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full border-2 border-black bg-yellow-200 text-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-2">
                Candidate Profile
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black tracking-tight">
                Welcome back, {userProfile.name || userProfile.email?.split('@')[0]}
              </h1>
            </div>

            <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
              Track your interview performance metrics, calibrate target technical tracks, and review simulated interview sessions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border-2 border-black bg-slate-50 flex items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Mail className="w-5 h-5 text-gray-700 shrink-0" />
                <div className="text-left overflow-hidden">
                  <div className="text-[11px] font-bold text-gray-600 uppercase">Email Address</div>
                  <div className="text-xs sm:text-sm font-bold text-black truncate">{userProfile.email}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border-2 border-black bg-emerald-100 flex items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Award className="w-5 h-5 text-emerald-800 shrink-0" />
                <div className="text-left">
                  <div className="text-[11px] font-black text-emerald-900 uppercase">Sessions Practiced</div>
                  <div className="text-base font-black text-black">
                    {typeof totalInterviews === 'number' ? totalInterviews : 0} Interviews
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Avatar selector modal */}
        {showAvatarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative max-w-sm w-full mx-4 space-y-4">
              <button
                className="absolute top-3 right-3 text-black font-black text-2xl hover:text-gray-600"
                onClick={() => setShowAvatarModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h3 className="text-lg font-black text-black text-center">Choose Candidate Avatar</h3>
              <div className="flex gap-4 justify-center flex-wrap pt-2">
                {avatars.map((avatar) => (
                  <img
                    key={avatar}
                    src={avatar}
                    alt="Avatar"
                    className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 cursor-pointer transition-all ${
                      selectedAvatar === avatar
                        ? 'border-blue-600 ring-4 ring-yellow-300 scale-105'
                        : 'border-black hover:scale-105'
                    }`}
                    onClick={() => handleAvatarSelect(avatar)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Resume Management Card */}
        <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 space-y-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <FileText className="w-4 h-4 text-black" />
              </div>
              <div>
                <h2 className="text-base font-black text-black">Resume Intelligence</h2>
                <p className="text-xs text-gray-700 font-medium">
                  {resumeUpdatedAt
                    ? `Last saved: ${new Date(resumeUpdatedAt).toLocaleDateString()}`
                    : 'No resume saved yet'}
                </p>
              </div>
            </div>
            {resumeText.trim() && (
              <button
                type="button"
                onClick={handleClearResume}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border-2 border-black bg-rose-100 hover:bg-rose-200 text-xs font-black text-rose-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* File Upload */}
          <label className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-dashed border-black bg-slate-50 hover:bg-purple-50 cursor-pointer transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Upload className="w-4 h-4 text-purple-700" />
            <span className="text-xs font-bold text-gray-800">
              {isSavingResume
                ? 'Parsing Resume Document...'
                : resumeFileName
                ? `Loaded: ${resumeFileName} — click to change`
                : 'Upload resume document (.pdf, .docx, .doc, or paste below)'}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              className="hidden"
              onChange={handleResumeFileUpload}
              disabled={isSavingResume}
            />
          </label>

          {/* Paste area */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-black tracking-wider">Resume Text</label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume here — name, experience, skills, projects, education..."
              rows={8}
              className="w-full p-3 text-sm font-medium rounded-xl border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            {resumeSaveMsg && (
              <span className={`text-xs font-bold flex items-center gap-1.5 ${resumeSaveMsg.includes('success') ? 'text-emerald-700' : 'text-rose-700'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {resumeSaveMsg}
              </span>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleSaveResume}
                disabled={isSavingResume || !resumeText.trim()}
                className="flex items-center gap-2 py-2.5 px-6 rounded-xl border-2 border-black font-black text-sm text-white bg-purple-600 hover:bg-purple-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSavingResume ? 'Saving...' : 'Save Resume'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
