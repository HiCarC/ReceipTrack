import React from 'react';

export default function Skeleton({ type }) {
  if (type === 'group') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/90">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-16 w-16 bg-slate-700 rounded-full mb-4"></div>
          <div className="h-6 w-40 bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-32 bg-slate-800 rounded mb-2"></div>
          <div className="h-4 w-48 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }
  // Add more skeleton types as needed
  return null;
} 