import React, { useState } from 'react';
import ReceiptMap from '@/components/map/ReceiptMap';

export default function SpendingMapBlock({ receipts, getBaseAmount, onTabChange }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold">Spending Map</h3>
        <button
          type="button"
          className="text-sm font-semibold text-app-primary"
          onClick={() => onTabChange && onTabChange('map')}
        >
          Expand
        </button>
      </div>
      <div className="mt-3 rounded-2xl bg-app-surface p-2">
        {showPreview ? (
          <ReceiptMap
            receipts={receipts}
            getBaseAmount={getBaseAmount}
            showControls={false}
            showStyleSelector={false}
            showDesktopOverlays={false}
            showMobilePanel={false}
            showMaplibreControls={false}
            minHeight={220}
            className="h-[220px] md:h-[260px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex h-[220px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 text-sm text-white/80 hover:bg-white/10"
          >
            <span className="text-base font-semibold text-white">Load map preview</span>
            <span className="text-xs text-white/70">Opens the map only when needed</span>
          </button>
        )}
      </div>
    </div>
  );
}
