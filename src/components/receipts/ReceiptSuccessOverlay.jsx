import React from 'react';

export default function ReceiptSuccessOverlay() {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-8 md:p-12 max-w-md mx-4 text-center border border-green-400/20 shadow-2xl animate-in fade-in duration-300">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div className="absolute inset-0 w-16 h-16 bg-green-400 rounded-full animate-ping opacity-20"></div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-bold text-green-400">Receipt Saved!</p>
          <p className="text-lg text-white">Your expense has been successfully recorded.</p>
          <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    </div>
  );
}
