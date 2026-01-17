import React from 'react';

export default function SwipeHintTooltip({ show, onDismiss }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 max-w-sm mx-4 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Swipe to Quick Actions</h3>
        <p className="text-blue-200 text-sm mb-4">
          Swipe right to edit or left to delete receipts.
          <br />
          <span className="text-blue-300/80 text-xs">Vertical scrolling still works normally!</span>
        </p>
        <div className="flex gap-2 justify-center">
          <div className="flex items-center gap-2 text-xs text-blue-300">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Swipe Right - Edit</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-red-300">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Swipe Left - Delete</span>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
