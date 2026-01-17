import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black/90 px-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center">
        <div className="text-6xl mb-4">😕</div>
        <div className="text-2xl font-bold text-white mb-2 text-center">Page Not Found</div>
        <div className="text-blue-200 mb-6 text-center">Sorry, we couldn't find what you were looking for.</div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
          onClick={() => navigate('/')}
        >
          Go Home
        </button>
      </div>
    </div>
  );
} 