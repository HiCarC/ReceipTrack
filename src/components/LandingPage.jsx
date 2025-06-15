import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Lock, Mail, LineChart } from 'lucide-react';

export default function LandingPage({ className }) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const scrollStart = windowHeight * 0.2; // Match header animation start
      const scrollEnd = windowHeight * 0.5; // Match header animation end
      
      if (scrollPosition > scrollStart) {
        const progress = Math.min(1, (scrollPosition - scrollStart) / (scrollEnd - scrollStart));
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`relative flex flex-col items-center w-full min-h-screen ${className}`}>
      {/* Decorative Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full opacity-25 blur-3xl -z-10 animate-float-slow"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full opacity-25 blur-3xl -z-10 animate-float-slow2"></div>

      {/* Hero Section with integrated header space */}
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto mt-32 mb-4 px-4">
        {/* Hero Illustration */}
        <div className="shadow-2xl rounded-full bg-gradient-to-br from-blue-400 via-indigo-300 to-purple-300 p-6 animate-fade-in">
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="24" width="72" height="48" rx="16" fill="#4F8FF9"/>
            <rect x="24" y="36" width="48" height="24" rx="8" fill="#fff"/>
            <circle cx="48" cy="48" r="12" fill="#4F8FF9"/>
            <rect x="36" y="60" width="24" height="6" rx="3" fill="#E0E7FF"/>
            <rect x="32" y="18" width="32" height="12" rx="6" fill="#fff"/>
            <rect x="40" y="70" width="16" height="4" rx="2" fill="#4F8FF9"/>
          </svg>
        </div>
        {/* Headline & Subheadline with enhanced visibility */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold text-blue-100 text-center leading-tight drop-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-100 to-indigo-200">
            Effortless Receipt Management
          </h1>
          <p className="text-lg md:text-xl text-slate-200 text-center font-medium max-w-xl mx-auto leading-relaxed">
            Welcome! Upload, track, and analyze your expenses in seconds.<br/>
            Built for modern teams and freelancers. Your data, your peace of mind.
          </p>
        </div>
      </div>

      {/* CTA Card with animated border */}
      <div className="relative flex flex-col items-center w-full max-w-md mx-auto">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-400 via-purple-400 to-indigo-400 opacity-35 blur-lg animate-gradient-glow z-0"></div>
        <div className="relative bg-gradient-to-br from-slate-700 via-indigo-800 to-blue-800 rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 w-full border border-blue-200/20 dark:border-gray-600 max-w-md z-10">
          {/* Animated confetti/sparkle */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-confetti">
            <svg width="48" height="24" viewBox="0 0 48 24" fill="none"><circle cx="8" cy="12" r="3" fill="#fff" opacity=".7"/><circle cx="24" cy="6" r="2" fill="#fbbf24" opacity=".8"/><circle cx="40" cy="16" r="2.5" fill="#a5b4fc" opacity=".7"/><circle cx="32" cy="20" r="1.5" fill="#f472b6" opacity=".8"/></svg>
          </div>
          {/* CTA Buttons */}
          <Button onClick={() => window.dispatchEvent(new CustomEvent('open-email-auth-modal'))} className="flex items-center gap-2 bg-black text-white font-bold shadow-md hover:bg-gradient-to-r from-blue-600 to-blue-500 w-full justify-center text-lg py-3 rounded-xl border border-gray-600 transition-all duration-300 ease-in-out transform hover:scale-105">
            <Mail className="h-5 w-5" /> Email Login
          </Button>
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent('open-google-auth-modal'))} // New event for Google Sign-in from landing page
            className="w-full bg-black text-white border border-gray-600 rounded-lg shadow-sm flex items-center justify-center gap-3 py-2.5 transition duration-200 ease-in-out hover:bg-white hover:text-black hover:border-black"
          >
            <img src="/google-icon.svg" alt="Google" className="h-5 w-5" />
            <span className="font-semibold">Sign in with Google</span>
          </Button>
          {/* Onboarding Steps */}
          <div className="w-full flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-3">
              <span className="bg-white text-blue-600 rounded-full p-2 shadow"><Lock className="h-5 w-5" /></span>
              <span className="text-slate-200 font-semibold text-base">Sign in securely with Google or Email</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-white text-blue-600 rounded-full p-2 shadow"><Camera className="h-5 w-5" /></span>
              <span className="text-slate-200 font-semibold text-base">Upload receipts or take a photo</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-white text-blue-600 rounded-full p-2 shadow"><LineChart className="h-5 w-5" /></span>
              <span className="text-slate-200 font-semibold text-base">Instantly track and analyze your expenses</span>
            </div>
          </div>
        </div>
      </div>
      {/* Testimonial Carousel */}
      <div className="w-full max-w-md mt-10">
        <div className="bg-slate-700/95 rounded-2xl shadow-lg p-6 flex flex-col gap-4 text-white">
          <div className="flex items-center gap-3">
            <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="User" className="h-10 w-10 rounded-full border-2 border-blue-200/40" />
            <div>
              <p className="text-slate-100 font-semibold">"ExpenseApp made my expense reports a breeze. Love the simplicity!"</p>
              <span className="text-xs text-slate-300">— Alex, Freelancer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="User" className="h-10 w-10 rounded-full border-2 border-blue-200/40" />
            <div>
              <p className="text-slate-100 font-semibold">"Our team saves hours every month. The best receipt tool we've tried."</p>
              <span className="text-xs text-slate-300">— Priya, Startup COO</span>
            </div>
          </div>
        </div>
      </div>
      {/* Client Logos */}
      <div className="flex flex-row items-center justify-center gap-8 mt-10 opacity-80 grayscale bg-slate-700/90 rounded-xl py-4 px-8 shadow">
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" className="h-8" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple-logo.png" alt="Apple" className="h-8" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg" alt="IBM" className="h-8" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" alt="Google" className="h-8" />
      </div>
      {/* Footer Branding - now a direct child of the outer flex-col and pushed to bottom */}
      <div className="mt-10 text-slate-300 font-semibold tracking-wide select-none flex items-center justify-center gap-1">
        Powered with <span className="text-red-500 text-lg animation-very-slow-pulse">❤️</span> by ExpenseApp
      </div>
    </div>
  );
} 