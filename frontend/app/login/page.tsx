'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isDevLoginEnabled } from '@/lib/devAuth';
import { Lock, Mail, Sparkles, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      if (!data.token) {
        throw new Error('No token received');
      }
      localStorage.setItem('token', data.token);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  const handleDevLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/dev-login', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Dev login failed');
      }
      if (!data.token) {
        throw new Error('No token received');
      }
      localStorage.setItem('token', data.token);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Dev login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{
        backgroundImage: "url('/background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-white/75 z-0 pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
          {/* Login Card */}
          <div className="bg-white/95 rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-10 w-full max-w-md mx-auto space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black bg-yellow-200 text-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Sign In
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-black">Welcome Back</h2>
              <p className="text-gray-700 text-sm font-medium mt-1">Sign in to resume your interview prep</p>
            </div>

            {error && (
              <div className="bg-rose-100 border-2 border-black text-rose-900 px-4 py-3 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-black mb-1.5 text-xs font-black uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 border-2 border-black rounded-xl font-medium text-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-black mb-1.5 text-xs font-black uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border-2 border-black rounded-xl font-medium text-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-blue-600 text-white py-3 rounded-xl border-2 border-black font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-700 hover:translate-x-0.5 hover:translate-y-0.5 transition-all ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Signing in...' : 'Sign In to Interview Room'}
              </button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-black/15" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-700 font-bold uppercase">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 border-2 border-black bg-white py-2.5 rounded-xl font-bold text-xs sm:text-sm text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4" />
              <span>Continue with Google</span>
            </button>

            {isDevLoginEnabled && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDevLogin}
                  disabled={loading}
                  className="w-full border-2 border-black bg-yellow-200 text-black py-2.5 rounded-xl font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300 hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  {loading ? 'Signing in...' : '1-Click Dev Login (Local Only)'}
                </button>
              </div>
            )}

            <div className="text-center pt-2 text-xs text-gray-800 font-medium">
              Don&apos;t have an account?{' '}
              <a href="/register" className="text-blue-700 font-black hover:underline">
                Sign up now
              </a>
            </div>
          </div>

          {/* Illustration Container */}
          <div className="hidden lg:flex bg-white/95 rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] items-center justify-center p-10 min-w-[380px]">
            <div className="text-center space-y-3">
              <img
                src="/logoo.png"
                alt="AI Interview Coach"
                className="max-w-[240px] w-full mx-auto rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
              <h3 className="text-xl font-black text-black">AI Interview Coach</h3>
              <p className="text-xs text-gray-700 font-semibold max-w-xs mx-auto">
                Realistic simulations, real speech analysis, instant actionable feedback.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
