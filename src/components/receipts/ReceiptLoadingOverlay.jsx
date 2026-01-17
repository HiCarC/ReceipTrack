import React from 'react';

export default function ReceiptLoadingOverlay({ isOcrProcessing, currentFunnyMessage }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-8 md:p-12 max-w-md mx-4 text-center border border-blue-400/20 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" className="animate-pulse">
            <rect x="10" y="5" width="40" height="50" rx="3" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <line x1="15" y1="15" x2="45" y2="15" stroke="#3b82f6" strokeWidth="1"/>
            <line x1="15" y1="20" x2="45" y2="20" stroke="#3b82f6" strokeWidth="1"/>
            <line x1="15" y1="25" x2="35" y2="25" stroke="#3b82f6" strokeWidth="1"/>
            <line x1="15" y1="30" x2="40" y2="30" stroke="#3b82f6" strokeWidth="1"/>
            <line x1="15" y1="35" x2="30" y2="35" stroke="#3b82f6" strokeWidth="1"/>

            <circle cx="30" cy="30" r="25" fill="none" stroke="#1e40af" strokeWidth="2" strokeDasharray="157" strokeDashoffset="157">
              <animate attributeName="stroke-dashoffset" values="157;0;157" dur="2s" repeatCount="indefinite"/>
            </circle>

            <ellipse cx="20" cy="45" rx="2" ry="2" fill="#64748b">
              <animate attributeName="ry" values="2;0.5;2" keyTimes="0;0.5;1" dur="2s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="40" cy="45" rx="2" ry="2" fill="#64748b">
              <animate attributeName="ry" values="2;2;0.5;2" keyTimes="0;0.3;0.5;1" dur="2s" repeatCount="indefinite"/>
            </ellipse>
            <path d="M18 48 Q30 54 42 48" stroke="#64748b" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="space-y-2">
          <p className="text-xl font-medium text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {isOcrProcessing ? "Processing your receipt..." : "Saving receipt..."}
          </p>
          <p className="text-lg text-blue-300 animate-pulse" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {isOcrProcessing ? currentFunnyMessage : "Almost done..."}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {isOcrProcessing ? "AI is analyzing your receipt..." : "Updating your expense dashboard..."}
          </p>
        </div>
      </div>
    </div>
  );
}
