'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, CheckCircle2 } from 'lucide-react';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const { name, email, password, password2 } = formData;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (password !== password2) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.msg || data.error || 'Registration failed');
      }

      localStorage.setItem('token', data.token);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      if (
        err.message.toLowerCase().includes('already exists') ||
        err.message.toLowerCase().includes('duplicate') ||
        err.message.toLowerCase().includes('taken')
      ) {
        setError('User already exists. Please sign in instead.');
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F0F4F8] relative flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 w-full h-full bg-white/75 z-0 pointer-events-none" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black bg-yellow-200 text-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Join Today
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            Create Your Account
          </h1>
          <p className="mt-2 text-sm text-gray-800 font-medium">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-blue-700 hover:underline">
              Sign in here
            </Link>
          </p>
        </div>

        <div className="bg-white/95 rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-10 space-y-6">
          {success && (
            <div className="bg-emerald-100 border-2 border-black text-emerald-900 p-3.5 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Registration successful! Redirecting...</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-100 border-2 border-black text-rose-900 p-3.5 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="name" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={onChange}
                placeholder="Alex Candidate"
                className="w-full px-4 py-2.5 border-2 border-black rounded-xl font-medium text-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={onChange}
                placeholder="alex@example.com"
                className="w-full px-4 py-2.5 border-2 border-black rounded-xl font-medium text-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={onChange}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border-2 border-black rounded-xl font-medium text-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password2" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                Confirm Password
              </label>
              <input
                id="password2"
                name="password2"
                type="password"
                autoComplete="new-password"
                required
                value={password2}
                onChange={onChange}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border-2 border-black rounded-xl font-medium text-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 border-2 border-black rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Creating Account...' : 'Register Candidate Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
