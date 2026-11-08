'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Sparkles, CheckCircle2, ShieldCheck, ExternalLink, Sliders } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [isByokEnabled, setIsByokEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load local BYOK settings
    const savedGroq = localStorage.getItem('byok_groq_key') || '';
    const savedGemini = localStorage.getItem('byok_gemini_key') || '';
    const savedEnabled = localStorage.getItem('byok_enabled') === 'true';

    setGroqKey(savedGroq);
    setGeminiKey(savedGemini);
    setIsByokEnabled(savedEnabled);

    // Also sync from backend user settings if logged in
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            if (data.customGroqKey) {
              setGroqKey(data.customGroqKey);
              localStorage.setItem('byok_groq_key', data.customGroqKey);
            }
            if (data.customGeminiKey) {
              setGeminiKey(data.customGeminiKey);
              localStorage.setItem('byok_gemini_key', data.customGeminiKey);
            }
            if (data.customGroqKey || data.customGeminiKey) {
              setIsByokEnabled(true);
              localStorage.setItem('byok_enabled', 'true');
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      // 1. Save locally in browser
      localStorage.setItem('byok_groq_key', groqKey.trim());
      localStorage.setItem('byok_gemini_key', geminiKey.trim());
      localStorage.setItem('byok_enabled', isByokEnabled ? 'true' : 'false');

      // 2. Persist to backend if authenticated
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/users/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customGroqKey: isByokEnabled ? groqKey.trim() : null,
            customGeminiKey: isByokEnabled ? geminiKey.trim() : null,
          }),
        });
      }

      setMessage('Settings updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Settings saved locally in your browser.');
    } finally {
      setIsSaving(false);
    }
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

      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-200 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Sliders className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-black">Settings & Preferences</h1>
              <p className="text-xs text-gray-700 font-medium">Configure model preferences & Bring Your Own Key (BYOK)</p>
            </div>
          </div>
        </div>

        {/* BYOK Card */}
        <form onSubmit={handleSave} className="bg-white/95 rounded-2xl border-4 border-black p-6 sm:p-8 space-y-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-start justify-between gap-4 border-b-2 border-black/10 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-black text-black">Bring Your Own Key (Optional)</h2>
              </div>
              <p className="text-xs text-gray-700 font-medium mt-1">
                Provide your own free API keys to get unlimited interview runs, bypass public rate limits, and have zero queue delays.
              </p>
            </div>

            {/* Toggle */}
            <div
              onClick={() => setIsByokEnabled(!isByokEnabled)}
              className={`cursor-pointer w-12 h-7 rounded-full border-2 border-black flex items-center p-0.5 transition-all shrink-0 ${
                isByokEnabled ? 'bg-emerald-400 justify-end' : 'bg-gray-300 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white border border-black shadow-sm" />
            </div>
          </div>

          {isByokEnabled && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-blue-50 border-2 border-black rounded-xl text-xs text-blue-900 font-medium flex items-start gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  Your keys are encrypted, stored strictly for your sessions, and never shared with other candidates. Both Groq and Google offer 100% free API tiers.
                </span>
              </div>

              {/* Groq Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-black tracking-wider">
                    Groq API Key (Llama 3.3 Ultra-Fast Turns)
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>Get Free Groq Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-2.5 text-xs font-mono border-2 border-black rounded-xl bg-white text-black placeholder-gray-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Gemini Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-black tracking-wider">
                    Google Gemini API Key (Detailed Reports & Fallback)
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>Get Free Google Studio Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 text-xs font-mono border-2 border-black rounded-xl bg-white text-black placeholder-gray-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
            {message && (
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {message}
              </span>
            )}
            <div className="ml-auto">
              <button
                type="submit"
                disabled={isSaving}
                className="py-2.5 px-6 rounded-xl border-2 border-black font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
