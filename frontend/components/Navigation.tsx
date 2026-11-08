'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { User, LogOut } from 'lucide-react';
import Image from 'next/image';

const Navigation = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);

    const handleStorageChange = () => {
      const updatedToken = localStorage.getItem('token');
      setIsLoggedIn(!!updatedToken);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    router.push('/login');
  };

  const handleNavScroll = (sectionId: string) => {
    if (pathname === '/') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('scrollToSection', sectionId);
      }
      router.push('/');
    }
  };

  // Don't render on interview room page
  if (pathname === '/interview') {
    return null;
  }

  return (
    <nav className="relative z-20 flex justify-between items-center px-4 sm:px-8 py-3 bg-white/95 backdrop-blur-md border-b-4 border-black">
      <div className="flex items-center space-x-3">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <Image
            src="/Group1.png"
            alt="AI Interview Coach"
            width={200}
            height={60}
            priority
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        <Link
          href="/"
          className="px-3 sm:px-4 py-2 bg-white rounded-xl border-2 border-black text-black font-bold text-xs sm:text-sm hover:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          Home
        </Link>
        <button
          type="button"
          onClick={() => handleNavScroll('features')}
          className="px-3 sm:px-4 py-2 bg-white rounded-xl border-2 border-black text-black font-bold text-xs sm:text-sm hover:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
        >
          Features
        </button>
        <button
          type="button"
          onClick={() => handleNavScroll('about-footer')}
          className="hidden sm:inline-block px-4 py-2 bg-white rounded-xl border-2 border-black text-black font-bold text-xs sm:text-sm hover:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
        >
          About
        </button>

        {isLoggedIn ? (
          <>
            <Link
              href="/settings"
              className="px-3 sm:px-4 py-2 bg-white rounded-xl border-2 border-black text-black font-bold text-xs sm:text-sm hover:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              Settings
            </Link>
            <Link
              href="/profile"
              className="w-10 h-10 bg-yellow-200 border-2 border-black rounded-xl flex items-center justify-center hover:bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              title="Candidate Profile"
            >
              <User className="w-5 h-5 text-black" />
            </Link>
            <button
              onClick={handleLogout}
              className="bg-rose-200 border-2 border-black text-black font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm hover:bg-rose-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="bg-blue-600 text-white font-black px-4 sm:px-5 py-2 rounded-xl border-2 border-black text-xs sm:text-sm hover:bg-blue-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-yellow-300 text-black font-black px-4 sm:px-5 py-2 rounded-xl border-2 border-black text-xs sm:text-sm hover:bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all hidden sm:inline-block"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
