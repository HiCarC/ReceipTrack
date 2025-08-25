import React, { useEffect, useRef } from 'react';
import { useLoading } from "@/contexts/LoadingContext";
import { Camera, Users, MapPin } from 'lucide-react';

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

export default function MobileNavBar({ currentTab, onTabChange, needsFixCount = 0 }) {
  const { isLoading } = useLoading();

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
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-between items-end px-0 h-20 md:hidden shadow-2xl border-t border-blue-900/40 bg-gradient-to-tr from-slate-900/80 to-blue-900/60 backdrop-blur-xl bg-opacity-70 rounded-t-3xl transition-all duration-300 overflow-hidden"
        style={{
          WebkitBackdropFilter: 'blur(16px)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 32px 0 rgba(30,41,59,0.18), 0 2px 8px 0 rgba(59,130,246,0.08) inset',
          borderTop: '1.5px solid rgba(96,165,250,0.13)',
        }}
      >
        {/* Animated gradient shimmer for branding */}
        <div className="absolute inset-0 z-0 pointer-events-none animate-shimmer" style={{ background: 'linear-gradient(120deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.10) 50%, rgba(59,130,246,0.08) 100%)', opacity: 0.7 }} />
        {/* Expenses, Upload (center, floating FAB, slightly above nav), Receipts, Map, Group */}
        <div className="flex flex-1 h-full">
          {/* Expenses */}
        <button
          onClick={() => handleTabChange('expenses')}
            className={`flex-1 flex flex-col items-center justify-center h-20 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'expenses' ? 'text-blue-400' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
          aria-label="Expenses"
          tabIndex={0}
            style={{ touchAction: 'manipulation' }}
        >
            <WalletSVG className="h-7 w-7" />
        </button>
          {/* Upload (camera, vertically centered) */}
        <button
          onClick={() => handleTabChange('upload')}
            className={`flex-1 flex flex-col items-center justify-center h-20 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'upload' ? 'text-blue-400' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
          aria-label="Upload"
          tabIndex={0}
            style={{ touchAction: 'manipulation' }}
        >
            <Camera className={`h-9 w-9 text-white transition-transform duration-300 ${currentTab === 'upload' ? 'scale-110 rotate-6' : ''}`} />
        </button>
          {/* Receipts */}
        <button
          onClick={() => handleTabChange('receipts')}
            className={`flex-1 flex flex-col items-center justify-center h-20 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'receipts' ? 'text-blue-400' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
          aria-label="Receipts"
          tabIndex={0}
            style={{ touchAction: 'manipulation' }}
        >
            <div className="relative">
              <ReceiptSVG className="h-7 w-7" />
              {needsFixCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full shadow-lg">
                  {Math.min(needsFixCount, 99)}
                </span>
              )}
            </div>
          </button>
          {/* Map */}
          <button
            onClick={() => handleTabChange('map')}
            className={`flex-1 flex flex-col items-center justify-center h-20 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'map' ? 'text-blue-400' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
            aria-label="Map"
            tabIndex={0}
            style={{ touchAction: 'manipulation' }}
          >
            <MapPin className="h-7 w-7" />
          </button>
          {/* Group */}
          <button
            onClick={() => handleTabChange('group')}
            className={`flex-1 flex flex-col items-center justify-center h-20 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'group' ? 'text-blue-400' : 'text-slate-400 opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0'}`}
            aria-label="Group"
            tabIndex={0}
            style={{ touchAction: 'manipulation' }}
          >
            <Users className="h-7 w-7" />
        </button>
        </div>
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