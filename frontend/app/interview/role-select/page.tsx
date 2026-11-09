'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Code,
  Users,
  Layers,
  Sparkles,
  Clock,
  Mic,
  Building,
  Sliders,
  CheckCircle,
  FileText,
  Upload,
} from 'lucide-react';

const roles = [
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    description: 'General software engineering, system design, and algorithms',
    isTechnical: true,
    hasDSAQuestions: true,
  },
  {
    id: 'frontend-developer',
    title: 'Frontend Developer',
    description: 'Frontend architecture, UI/UX, modern JS/TS, and web APIs',
    isTechnical: true,
    hasDSAQuestions: true,
  },
  {
    id: 'backend-developer',
    title: 'Backend Developer',
    description: 'Server architecture, databases, APIs, and scalability',
    isTechnical: true,
    hasDSAQuestions: true,
  },
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    description: 'Data analysis, machine learning algorithms, and statistics',
    isTechnical: true,
    hasDSAQuestions: false,
  },
  {
    id: 'product-manager',
    title: 'Product Manager',
    description: 'Product strategy, execution, system trade-offs, and metrics',
    isTechnical: false,
    hasDSAQuestions: false,
  },
  {
    id: 'devops-engineer',
    title: 'DevOps Engineer',
    description: 'CI/CD, cloud infrastructure, container orchestration, and security',
    isTechnical: true,
    hasDSAQuestions: true,
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    description: 'LLM agents, RAG, prompt engineering, model fine-tuning, and vector databases',
    isTechnical: true,
    hasDSAQuestions: false,
  },
  {
    id: 'ml-engineer',
    title: 'ML Engineer',
    description: 'Machine learning pipelines, MLOps, deep learning architectures, and model training',
    isTechnical: true,
    hasDSAQuestions: false,
  },
];

const programmingLanguages = [
  'JavaScript',
  'Python',
  'Java',
  'C++',
  'TypeScript',
  'Go',
  'Rust',
  'Ruby',
  'C#',
  'PHP',
];

const roleColors: Record<string, string> = {
  'software-engineer': 'bg-yellow-200',
  'frontend-developer': 'bg-pink-200',
  'backend-developer': 'bg-green-200',
  'data-scientist': 'bg-purple-200',
  'product-manager': 'bg-orange-200',
  'devops-engineer': 'bg-blue-200',
  'ai-engineer': 'bg-emerald-200',
  'ml-engineer': 'bg-violet-200',
};

const CANONICAL_PATTERNS = [
  { id: 'two-pointers', label: 'Two Pointers' },
  { id: 'sliding-window', label: 'Sliding Window' },
  { id: 'binary-search', label: 'Binary Search' },
  { id: 'bfs-dfs', label: 'BFS & DFS' },
  { id: 'dynamic-programming', label: 'Dynamic Programming' },
  { id: 'tree-graph', label: 'Trees & Graphs' },
  { id: 'linked-list', label: 'Linked Lists' },
  { id: 'stack-queue', label: 'Stack & Queue' },
  { id: 'greedy', label: 'Greedy' },
  { id: 'backtracking', label: 'Backtracking' },
];

export default function RoleSelectPage() {
  const router = useRouter();

  // Basic selections
  const [selectedRole, setSelectedRole] = useState('software-engineer');
  const [selectedLanguage, setSelectedLanguage] = useState('JavaScript');
  const [error, setError] = useState('');

  // Extended options
  const [interviewMode, setInterviewMode] = useState<'mixed' | 'dsa' | 'hr'>('mixed');
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(
    CANONICAL_PATTERNS.map((p) => p.id)
  );
  const [difficulty, setDifficulty] = useState<'adaptive' | 'easy' | 'medium' | 'hard'>('adaptive');
  const [targetCompany, setTargetCompany] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [voiceEvaluation, setVoiceEvaluation] = useState(true);

  // Resume Options
  const [resumeMode, setResumeMode] = useState<'pure' | 'mix' | 'none'>('mix');
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [isSavingResume, setIsSavingResume] = useState(false);

  // Load saved resume if user has one
  useEffect(() => {
    const fetchUserResume = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/resume`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.resumeText) {
            setResumeText(data.resumeText);
            setResumeFileName(data.resumeFileName || 'Saved Resume');
          }
        }
      } catch (err) {
        console.warn('Failed to load user resume:', err);
      }
    };
    fetchUserResume();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFileName(file.name);
    setIsSavingResume(true);

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
        } else {
          setError(data.msg || 'Could not parse document. Please paste the text below.');
        }
      } catch (err: any) {
        console.error('Document upload error:', err);
        setError('Error uploading document. Please paste text directly.');
      } finally {
        setIsSavingResume(false);
      }
      return;
    }

    // For plain text / markdown files
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        setResumeText(content);
        if (token) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/resume`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ resumeText: content, fileName: file.name }),
            });
          } catch {}
        }
      }
      setIsSavingResume(false);
    };
    reader.readAsText(file);
  };

  const activeRole = roles.find((r) => r.id === selectedRole);

  // Auto-switch mode if role doesn't have DSA questions but DSA mode selected
  useEffect(() => {
    if (activeRole && !activeRole.hasDSAQuestions && interviewMode === 'dsa') {
      setInterviewMode('mixed');
    }
  }, [activeRole, interviewMode]);

  const togglePattern = (id: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAllPatterns = () => {
    setSelectedPatterns(CANONICAL_PATTERNS.map((p) => p.id));
  };

  const clearPatterns = () => {
    setSelectedPatterns([]);
  };

  const handleStartInterview = () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (activeRole?.isTechnical && !selectedLanguage) {
      setError('Please select a programming language');
      return;
    }

    // Assemble comprehensive payload for startInterview and localStorage
    const roleData = {
      role: selectedRole,
      programmingLanguage: activeRole?.isTechnical ? selectedLanguage : undefined,
      config: {
        mode: interviewMode,
        patterns: (interviewMode === 'hr' || !activeRole?.hasDSAQuestions) ? [] : selectedPatterns,
        difficulty,
        durationMin,
        maxQuestions: 0,
        voice: voiceEvaluation,
        company: targetCompany.trim() || null,
        resumeMode: interviewMode === 'dsa' ? 'none' : resumeMode,
        resumeText: interviewMode === 'dsa' || resumeMode === 'none' ? null : resumeText.trim(),
      },
    };

    localStorage.setItem('selectedRole', JSON.stringify(roleData));
    router.push('/interview');
  };

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

      <div className="relative z-10 max-w-4xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black bg-yellow-300 text-black text-xs font-bold uppercase tracking-wider shadow-sm mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Customized Interview Setup
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-black tracking-tight">
            Select Your Interview Role & Options
          </h1>
          <p className="mt-3 text-lg text-gray-800 font-medium">
            Tailor the role, question types, DSA patterns, and difficulty for your practice session.
          </p>
        </div>

        {error && (
          <div className="bg-red-500 text-white font-bold p-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
            {error}
          </div>
        )}

        {/* Step 1: Select Role */}
        <div className="role-select-section bg-white/90 backdrop-blur-sm rounded-2xl border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex items-center gap-2 border-b-2 border-black/10 pb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-sm font-black">
              1
            </span>
            <h2 className="text-xl font-bold text-black">Target Role</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => {
                    setSelectedRole(role.id);
                    setError('');
                  }}
                  className={`role-option-card role-${role.id} relative cursor-pointer transition-all transform hover:-translate-y-1 hover:shadow-xl
                    rounded-xl border-4 border-black p-5 flex flex-col justify-between
                    ${roleColors[role.id]} ${
                    isSelected
                      ? 'ring-4 ring-blue-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                      : 'shadow-md opacity-90 hover:opacity-100'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center shadow">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-black mb-1">{role.title}</h3>
                    <p className="text-sm text-gray-800 leading-snug">{role.description}</p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-black/15 flex items-center justify-between text-xs font-semibold text-gray-700">
                    <span>{role.isTechnical ? 'Technical + HR' : 'Behavioral Focus'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Programming language selector if technical */}
          {activeRole?.isTechnical && (
            <div className="pt-2">
              <label htmlFor="language" className="block text-sm font-bold text-black mb-1.5">
                Primary Programming Language
              </label>
              <div className="relative max-w-sm">
                <select
                  id="language"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 text-base font-semibold border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {programmingLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Interview Mode & Topics */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex items-center gap-2 border-b-2 border-black/10 pb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-sm font-black">
              2
            </span>
            <h2 className="text-xl font-bold text-black">Interview Mode</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
{[
              {
                id: 'mixed',
                title: 'Mixed (HR + DSA)',
                desc: 'Balanced round with technical problem solving and behavioral inquiries.',
                badge: 'Recommended',
                color: 'bg-indigo-50 border-indigo-400',
              },
              {
                id: 'dsa',
                title: 'DSA / Coding Only',
                desc: 'Algorithm problems with live code editor and test-case execution.',
                badge: 'Technical',
                color: 'bg-emerald-50 border-emerald-400',
                requiresDSAQuestions: true,
              },
              {
                id: 'hr',
                title: 'Behavioral / HR',
                desc: 'Leadership principles, STAR situational questions, and soft skills.',
                badge: 'Conversational',
                color: 'bg-amber-50 border-amber-400',
              },
            ].map((mode) => {
              const active = interviewMode === mode.id;
              const isDisabled = mode.requiresDSAQuestions && !activeRole?.hasDSAQuestions;
              if (isDisabled) return null;
              return (
                <div
                  key={mode.id}
                  onClick={() => !isDisabled && setInterviewMode(mode.id as any)}
                  className={`cursor-pointer rounded-xl border-3 border-black p-4 transition-all ${
                    isDisabled
                      ? 'bg-slate-100 opacity-50 cursor-not-allowed'
                      : active
                      ? 'bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                      : 'bg-white hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border border-black bg-white">
                      {mode.badge}
                    </span>
                    {active && <CheckCircle className="w-4 h-4 text-black" />}
                  </div>
                  <h4 className="font-bold text-black text-base">{mode.title}</h4>
                  <p className="text-xs text-gray-700 mt-1 leading-relaxed">{mode.desc}</p>
                </div>
              );
            })}
          </div>

          {/* DSA Pattern selection (active when mode includes technical/dsa) */}
          {interviewMode !== 'hr' && activeRole?.hasDSAQuestions && (
            <div className="pt-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-sm font-bold text-black flex items-center gap-1.5">
                    <Code className="w-4 h-4" /> Focus DSA Patterns
                  </label>
                  <p className="text-xs text-gray-700">
                    Select target algorithmic topics to prioritize in the question bank.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllPatterns}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-400">•</span>
                  <button
                    type="button"
                    onClick={clearPatterns}
                    className="font-bold text-gray-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {CANONICAL_PATTERNS.map((pattern) => {
                  const isSelected = selectedPatterns.includes(pattern.id);
                  return (
                    <button
                      key={pattern.id}
                      type="button"
                      onClick={() => togglePattern(pattern.id)}
                      className={`px-3 py-1.5 rounded-lg border-2 border-black text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-white text-black hover:bg-yellow-100'
                      }`}
                    >
                      {pattern.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Difficulty, Duration & Additional Config */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex items-center gap-2 border-b-2 border-black/10 pb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-sm font-black">
              3
            </span>
            <h2 className="text-xl font-bold text-black">Session Configuration</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Difficulty */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" /> Difficulty Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'adaptive', label: 'Adaptive' },
                  { id: 'easy', label: 'Easy' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'hard', label: 'Hard' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDifficulty(item.id as any)}
                    className={`py-2 px-3 rounded-xl border-2 border-black text-xs font-bold text-center transition-all ${
                      difficulty === item.id
                        ? 'bg-yellow-300 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-extrabold'
                        : 'bg-white text-black hover:bg-slate-100 shadow-sm'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5">
                Adaptive automatically adjusts follow-up difficulty according to your answers.
              </p>
            </div>

            {/* Duration & Question Limit */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-black mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Session Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mins: 30, label: '30 Min' },
                    { mins: 45, label: '45 Min' },
                    { mins: 60, label: '1 Hour' },
                  ].map((d) => (
                    <button
                      key={d.mins}
                      type="button"
                      onClick={() => setDurationMin(d.mins)}
                      className={`py-2 px-3 rounded-xl border-2 border-black text-xs font-bold text-center transition-all ${
                        durationMin === d.mins
                          ? 'bg-pink-200 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-extrabold'
                          : 'bg-white text-black hover:bg-slate-100 shadow-sm'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-gray-600 mt-1">
                The interview continues naturally until the timer ends. The interviewer adapts difficulty and question style as the conversation develops.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 pt-2 border-t border-black/10">
            {/* Target Company */}
            <div>
              <label
                htmlFor="company"
                className="block text-sm font-bold text-black mb-1.5 flex items-center gap-1.5"
              >
                <Building className="w-4 h-4" /> Target Company (Optional)
              </label>
              <input
                id="company"
                type="text"
                placeholder="e.g. Google, Amazon, Meta, Stripe..."
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                className="w-full px-4 py-2.5 text-sm font-medium border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Voice Evaluation Toggle */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5 flex items-center gap-1.5">
                <Mic className="w-4 h-4" /> Voice & Speech Evaluation
              </label>
              <div
                onClick={() => setVoiceEvaluation(!voiceEvaluation)}
                className={`cursor-pointer rounded-xl border-2 border-black p-2.5 flex items-center justify-between transition-all ${
                  voiceEvaluation
                    ? 'bg-emerald-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-slate-100 text-gray-500 shadow-sm'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-black flex items-center gap-1.5">
                    {voiceEvaluation ? 'Speech Analytics Active' : 'Text / Keyboard Only'}
                  </div>
                  <div className="text-[11px] text-gray-700">
                    {voiceEvaluation
                      ? 'Measures WPM, filler words & tone'
                      : 'Audio evaluation disabled'}
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full border-2 border-black flex items-center p-0.5 transition-all ${
                    voiceEvaluation ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white border border-black shadow-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resume questions do not apply to coding-only interviews. */}
        {interviewMode !== 'dsa' && (
        <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 space-y-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <FileText className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-base font-black text-black">Resume Intelligence</h2>
              <p className="text-xs text-gray-700 font-medium">Upload your resume to get personalized questions from your actual experience</p>
            </div>
          </div>

          {/* Question Source Toggle */}
          <div>
            <label className="block text-sm font-bold text-black mb-2">Question Source</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'pure', label: 'Purely Resume', desc: 'All questions from your experience' },
                { id: 'mix', label: 'Mix', desc: 'Resume + standard question bank' },
                { id: 'none', label: 'No Resume', desc: 'Standard question bank only' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResumeMode(opt.id)}
                  className={`p-3 rounded-xl border-2 border-black text-left transition-all ${
                    resumeMode === opt.id
                      ? 'bg-purple-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                      : 'bg-white hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  <div className="text-xs font-black text-black">{opt.label}</div>
                  <div className="text-[10px] text-gray-600 font-medium mt-0.5 leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resume Upload area - shown when not "none" */}
          {resumeMode !== 'none' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-black flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-700" /> Resume Document
                </label>
                {resumeFileName && (
                  <span className="text-xs font-black text-purple-900 bg-purple-200 px-2.5 py-0.5 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    {resumeFileName}
                  </span>
                )}
              </div>

              {/* File upload */}
              <label className="flex items-center justify-center gap-2 py-4 px-4 rounded-xl border-2 border-dashed border-black bg-slate-50 hover:bg-purple-50 cursor-pointer transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Upload className="w-5 h-5 text-purple-700" />
                <span className="text-xs sm:text-sm font-bold text-gray-800">
                  {isSavingResume
                    ? 'Extracting Resume Intelligence...'
                    : resumeFileName
                    ? `Loaded: ${resumeFileName} (Click to replace file)`
                    : 'Upload Resume File (.pdf, .docx, .doc)'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isSavingResume}
                />
              </label>

              {resumeFileName && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border-2 border-black p-2.5 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Resume verified & parsed! The AI interviewer will calibrate questions from your background.</span>
                </div>
              )}

              <p className="text-[11px] text-gray-600 font-medium">
                AI extracts your technical projects, experience timeline, and stack to tailor live interview scenarios.
              </p>
            </div>
          )}
        </div>
        )}

        {/* Start Interview CTA */}
        <div className="pt-2">
          <button
            onClick={handleStartInterview}
            className="w-full flex items-center justify-center gap-3 py-4 px-8 border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-lg font-black text-white bg-blue-600 hover:bg-blue-700 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all"
          >
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span>Launch Interview Room</span>
          </button>
        </div>
      </div>
    </div>
  );
}
