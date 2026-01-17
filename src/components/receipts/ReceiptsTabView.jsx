import React from 'react';
import { Edit, Store, Trash2 } from 'lucide-react';
import { estimateTaxForReceipt } from '@/utils/taxEstimator';

export default function ReceiptsTabView({
  user,
  receiptsNeedingFixCount,
  monthLabel,
  currentMonthTotal,
  monthDelta,
  daySections,
  expandedReceiptId,
  setExpandedReceiptId,
  getTimeLabel,
  getBaseAmount,
  getBaseTax,
  formatCurrency,
  settings,
  isOcrProcessing,
  onEditReceipt,
  onDeleteReceipt,
}) {
  return (
    <div className="min-h-screen w-full bg-app-bg text-app-fg">
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        <header className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-app-surface">
              {(user?.photoURL || settings?.photoURL) ? (
                (user?.photoURL || settings?.photoURL).length === 2 ? (
                  <div className="flex h-full w-full items-center justify-center text-lg">{user?.photoURL || settings?.photoURL}</div>
                ) : (
                  <img src={user?.photoURL || settings?.photoURL} alt="Profile" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">ME</div>
              )}
              {receiptsNeedingFixCount > 0 && (
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-app-bg bg-red-500" />
              )}
            </div>
            <h1 className="text-xl font-bold">My Receipts</h1>
          </div>
          <button
            type="button"
            disabled
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400"
            aria-label="Sort receipts"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h18" />
              <path d="M6 12h12" />
              <path d="M10 17h4" />
            </svg>
          </button>
        </header>

        <div className="pb-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search merchant or amount"
              className="h-12 w-full rounded-2xl border border-transparent bg-app-surface pl-11 pr-10 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="button"
              disabled
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500"
              aria-label="Filter receipts"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16" />
                <path d="M6 12h12" />
                <path d="M10 18h4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative mb-8 overflow-hidden rounded-2xl bg-[#1c1f27] p-5">
          <div className="absolute inset-0 bg-gradient-to-r from-app-primary/90 to-purple-900/80" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm text-blue-100">
                <span>{monthLabel}</span>
              </p>
              <p className="text-3xl font-bold text-white text-keep-white">
                {formatCurrency(currentMonthTotal, settings?.baseCurrency || 'EUR')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-green-400/20 px-2 py-0.5 text-xs font-bold text-green-300">
                  {monthDelta >= 0 ? '+' : ''}{monthDelta.toFixed(0)}%
                </span>
                <span className="text-xs text-blue-100/70">vs last month</span>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-6" />
              </svg>
            </div>
          </div>
        </div>

        {daySections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-slate-500">
            No receipts yet. Tap + to add your first one.
          </div>
        ) : (
          daySections.map((section) => (
            <div key={section.label} className="mb-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                {section.label}
              </h3>
              <div className="flex flex-col gap-3">
                {section.receipts.map((receipt) => {
                  const taxMeta = estimateTaxForReceipt(receipt, settings);
                  return (
                    <div
                      key={receipt.id}
                      className="space-y-2"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 220px' }}
                    >
                      <div
                        className="flex items-center justify-between rounded-2xl bg-app-surface p-3 shadow-sm cursor-pointer"
                        onClick={() => setExpandedReceiptId(expandedReceiptId === receipt.id ? null : receipt.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                            <Store className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-white">{receipt.merchant || 'Unknown'}</p>
                            <p className="text-sm text-app-muted">
                              {(receipt.category || 'Other')} {getTimeLabel(receipt) ? `- ${getTimeLabel(receipt)}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-semibold text-white">
                            {formatCurrency(getBaseAmount(receipt), settings?.baseCurrency || 'EUR')}
                          </div>
                          {receipt.currency && receipt.currency !== (settings?.baseCurrency || 'EUR') && (
                            <div className="text-xs text-app-muted">
                              {formatCurrency(receipt.total || 0, receipt.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                      {expandedReceiptId === receipt.id && (
                        <div className="rounded-2xl bg-[#151c27] border border-white/5 p-3 text-sm text-slate-200">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-slate-400">Base Total</p>
                              <p className="text-sm font-semibold">
                                {formatCurrency(getBaseAmount(receipt), settings?.baseCurrency || 'EUR')}
                              </p>
                              {receipt.currency && receipt.currency !== (settings?.baseCurrency || 'EUR') && (
                                <p className="text-xs text-slate-400">
                                  {formatCurrency(receipt.total || 0, receipt.currency)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">
                                Tax Paid
                                {taxMeta.isEstimated && (
                                  <span className="ml-1 text-[10px] uppercase text-slate-500">est.</span>
                                )}
                              </p>
                              <p className="text-sm font-semibold">
                                {formatCurrency(getBaseTax ? getBaseTax(receipt) : (parseFloat(receipt.tax) || 0), settings?.baseCurrency || 'EUR')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Category</p>
                              <p className="text-sm font-semibold">{receipt.category || 'Other'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Date</p>
                              <p className="text-sm font-semibold">
                                {receipt.transactionDate && receipt.transactionDate.toDate ? receipt.transactionDate.toDate().toLocaleDateString() : ''}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Payment</p>
                              <p className="text-sm font-semibold">{receipt.paymentMethod || 'Not specified'}</p>
                            </div>
                          </div>
                          {receipt.note && (
                            <div className="mt-3 text-xs text-slate-400">
                              Note: <span className="text-slate-200">{receipt.note}</span>
                            </div>
                          )}
                          {receipt.items && receipt.items.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-slate-400 mb-1">Items</p>
                              <div className="space-y-1">
                                {receipt.items.map((item, index) => (
                                  <div key={index} className="flex items-center justify-between text-xs text-slate-300">
                                    <span className="truncate">{item.name}</span>
                                    <span>{item.price}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-400">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (onEditReceipt) onEditReceipt(receipt);
                              }}
                              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-200 hover:bg-white/10"
                              aria-label="Edit receipt"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (onDeleteReceipt) onDeleteReceipt(event, receipt.id);
                              }}
                              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-rose-200 hover:bg-rose-500/10"
                              aria-label="Delete receipt"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {isOcrProcessing && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-app-surface/70 p-4 text-sm text-yellow-400">
            Processing receipt...
          </div>
        )}
      </div>
    </div>
  );
}
