import React, { useEffect, useRef } from 'react';
import { useLoading } from "@/contexts/LoadingContext";
import { Camera, Users } from 'lucide-react';
import { useNavigate } from "react-router-dom";

// Custom SVGs for premium look
const WalletSVG = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="6.5" width="19" height="11" rx="3.5" fill="url(#walletGradient)" stroke="currentColor" />
    <defs>
      <linearGradient id="walletGradient" x1="2.5" y1="6.5" x2="21.5" y2="17.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60a5fa" />
        <stop offset="1" stopColor="#818cf8" />
      </linearGradient>
    </defs>
    <rect x="5.5" y="10" width="4" height="2.5" rx="1.25" fill="#fff" stroke="#c7d2fe" />
  </svg>
);

const ReceiptSVG = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" fill="url(#receiptGradient)" stroke="currentColor" />
    <defs>
      <linearGradient id="receiptGradient" x1="4" y1="3.5" x2="20" y2="20.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a5b4fc" />
        <stop offset="1" stopColor="#38bdf8" />
      </linearGradient>
    </defs>
    <line x1="8" y1="8" x2="16" y2="8" stroke="#fff" strokeWidth="1.2" />
    <line x1="8" y1="12" x2="16" y2="12" stroke="#fff" strokeWidth="1.2" />
    <line x1="8" y1="16" x2="14" y2="16" stroke="#fff" strokeWidth="1.2" />
  </svg>
);

export default function MobileNavBar({ currentTab, onTabChange }) {
  const { isLoading } = useLoading();
  const navigate = useNavigate();

  // Haptic feedback on tab change
  const handleTabChange = (tab) => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(18);
    }
    onTabChange(tab);
  };

  // Fade/slide-in animation on mount
  const navRef = useRef(null);
  useEffect(() => {
    if (navRef.current) {
      navRef.current.classList.add('animate-fade-slide-up');
    }
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-between items-center px-8 h-20 md:hidden shadow-2xl border-t border-blue-900/40 bg-gradient-to-tr from-slate-900/80 to-blue-900/60 backdrop-blur-xl bg-opacity-70 rounded-t-3xl transition-all duration-300 overflow-hidden"
        style={{
          WebkitBackdropFilter: 'blur(16px)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 32px 0 rgba(30,41,59,0.18), 0 2px 8px 0 rgba(59,130,246,0.08) inset',
          borderTop: '1.5px solid rgba(96,165,250,0.13)',
        }}
      >
        {/* Animated gradient shimmer for branding */}
        <div className="absolute inset-0 z-0 pointer-events-none animate-shimmer" style={{ background: 'linear-gradient(120deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.10) 50%, rgba(59,130,246,0.08) 100%)', opacity: 0.7 }} />
        {/* Expenses (left, custom SVG) */}
        <button
          onClick={() => handleTabChange('expenses')}
          className={`relative flex items-center justify-center h-14 w-14 rounded-full transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'expenses' ? 'bg-blue-500/30 text-white scale-110 shadow-lg' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
          aria-label="Expenses"
          tabIndex={0}
          style={{ touchAction: 'manipulation', zIndex: 2 }}
        >
          <WalletSVG className="h-8 w-8" />
        </button>

        {/* Upload (center, floating FAB, morphing) */}
        <button
          onClick={() => handleTabChange('upload')}
          className={`absolute left-1/2 -translate-x-1/2 -top-0.5 rounded-full h-20 w-20 flex items-center justify-center border-4 border-slate-900 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'upload' ? 'bg-gradient-to-tr from-blue-500 via-blue-600 to-indigo-500 shadow-[0_0_32px_8px_rgba(59,130,246,0.35)] animate-glow ring-4 ring-blue-300' : 'bg-slate-700 opacity-70 grayscale hover:opacity-100 hover:grayscale-0'}`}
          style={{ zIndex: 60, boxShadow: currentTab === 'upload' ? '0 0 32px 8px rgba(59,130,246,0.35)' : undefined, touchAction: 'manipulation' }}
          aria-label="Upload"
          tabIndex={0}
        >
          <Camera className={`h-11 w-11 text-white transition-transform duration-300 ${currentTab === 'upload' ? 'scale-110 rotate-6' : ''}`} />
        </button>

        {/* Receipts (right, custom SVG) */}
        <button
          onClick={() => handleTabChange('receipts')}
          className={`relative flex items-center justify-center h-14 w-14 rounded-full transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'receipts' ? 'bg-blue-500/30 text-white scale-110 shadow-lg' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
          aria-label="Receipts"
          tabIndex={0}
          style={{ touchAction: 'manipulation', zIndex: 2 }}
        >
          <ReceiptSVG className="h-8 w-8" />
        </button>

        {/* Groups (new tab) */}
        <button
          className="flex flex-col items-center justify-center text-blue-300 hover:text-blue-500 transition"
          onClick={() => navigate('/groups')}
        >
          <Users className="h-6 w-6" />
          <span className="text-xs">Groups</span>
        </button>

        {/* Animations */}
        <style>{`
          @keyframes glow {
            0% { box-shadow: 0 0 32px 8px rgba(59,130,246,0.35); }
            50% { box-shadow: 0 0 48px 16px rgba(59,130,246,0.55); }
            100% { box-shadow: 0 0 32px 8px rgba(59,130,246,0.35); }
          }
          .animate-glow { animation: glow 1.5s infinite alternate; }
          @keyframes pulse-fab {
            0%, 100% { box-shadow: 0 4px 24px 0 rgba(59,130,246,0.18); }
            50% { box-shadow: 0 8px 32px 0 rgba(59,130,246,0.28); }
          }
          .animate-pulse-fab { animation: pulse-fab 2.2s infinite; }
          @keyframes morph {
            0% { transform: scale(1) rotate(0deg); }
            40% { transform: scale(1.12) rotate(8deg); }
            60% { transform: scale(1.08) rotate(-6deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
          .animate-morph { animation: morph 0.7s; }
          @keyframes shimmer {
            0% { background-position: -200px 0; }
            100% { background-position: 200px 0; }
          }
          .animate-shimmer {
            animation: shimmer 3.5s linear infinite;
            background-size: 400px 100%;
          }
          @keyframes fade-slide-up {
            0% { opacity: 0; transform: translateY(32px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-slide-up {
            animation: fade-slide-up 0.7s cubic-bezier(0.4,0.2,0.2,1) both;
          }
        `}</style>
      </nav>
    </>
  );
} 