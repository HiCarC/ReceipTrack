import React from 'react';
import { Receipt, PieChart, Users, Settings, ScanLine } from 'lucide-react';
import { useLoading } from '@/contexts/LoadingContext';

const NAV_ITEMS = [
  { id: 'expenses', label: 'Analytics', Icon: PieChart },
  { id: 'receipts', label: 'Receipts', Icon: Receipt },
  { id: 'group', label: 'Groups', Icon: Users },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function MobileNavBar({ currentTab, onTabChange, needsFixCount = 0, showScanButton = true }) {
  const { isLoading } = useLoading();

  const handleTabChange = (tab) => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(18);
    }
    onTabChange(tab);
  };

  if (isLoading) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[2147483646] border-t border-[#1c1f27] bg-[#101622]/90 backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-md items-center justify-between px-4 pb-6 pt-2">
        {showScanButton && (
          <button
            type="button"
            onClick={() => handleTabChange('upload')}
            className="fixed left-1/2 bottom-24 z-[2147483647] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-app-primary text-white shadow-2xl shadow-blue-900/40 active:scale-95"
            aria-label="Scan receipt"
          >
            <ScanLine className="h-6 w-6" />
          </button>
        )}

        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = currentTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-app-primary' : 'text-slate-500'
              }`}
              aria-label={label}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {id === 'receipts' && needsFixCount > 0 && (
                  <span className="absolute -right-2 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    {Math.min(needsFixCount, 99)}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
