import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown } from 'lucide-react';

export default function CategoryDetailsModal({
  modalOpen,
  setModalOpen,
  selectedCategory,
  receipts,
  settings,
  formatCurrency,
  formatDateSafely,
  normalizeToLocalMidnight,
  expandedInCategoryModalId,
  setExpandedInCategoryModalId,
  AsyncCurrencyConversion,
}) {
  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="max-w-md w-[95vw] bg-slate-900/95 text-white rounded-2xl shadow-2xl animate-fade-in-up p-0 flex flex-col overflow-hidden">
        {selectedCategory && (
          <>
            <DialogHeader className="p-6 pb-4 flex-shrink-0 border-b border-white/10">
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-indigo-200 tracking-tight overflow-hidden">
                <span className="text-3xl flex-shrink-0">{selectedCategory.emoji}</span>
                <span className="truncate min-w-0">{selectedCategory.name}</span>
              </DialogTitle>
              <DialogDescription className="text-blue-200/80 mt-1 text-sm">
                Category breakdown, recent receipts, and stats.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 max-h-[70vh] overflow-y-auto">
              <div className="p-6 flex flex-col gap-4 overflow-x-hidden">
                <div className="flex flex-row items-center justify-between mb-2">
                  <div>
                    <div className="text-2xl font-extrabold text-indigo-300">{formatCurrency(Math.abs(selectedCategory.amount), settings?.baseCurrency || 'EUR')}</div>
                    <div className="text-xs text-gray-400">{selectedCategory.percent}% of total</div>
                    {selectedCategory.categoryData && selectedCategory.categoryData.currencies && Object.keys(selectedCategory.categoryData.currencies).length > 0 && (
                      <div className="text-xs text-blue-300/80 mt-1">
                        {Object.entries(selectedCategory.categoryData.currencies).map(([currency, amount], idx) => (
                          <span key={currency}>
                            {formatCurrency(amount, currency)}
                            {idx < Object.keys(selectedCategory.categoryData.currencies).length - 1 ? ' ƒ?½ ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-28 h-16 flex items-end">
                    {(() => {
                      const today = new Date();
                      const days = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(today);
                        d.setDate(today.getDate() - (6 - i));
                        return d;
                      });
                      const dayLabels = days.map(d => d.toLocaleDateString(undefined, { weekday: 'short' }));
                      const dayTotals = days.map(d => {
                        const dStr = d.toISOString().split('T')[0];
                        return receipts.filter(r =>
                          (r.category || 'Uncategorized') === selectedCategory.name &&
                          (
                            (typeof r.transactionDate === 'string' && (r.transactionDate === dStr || r.transactionDate.startsWith(dStr))) ||
                            (r.transactionDate && r.transactionDate.toDate && r.transactionDate.toDate().toISOString().startsWith(dStr))
                          )
                        ).reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
                      });
                      const maxVal = Math.max(...dayTotals, 1);
                      return (
                        <div className="flex items-end w-full h-full">
                          {dayTotals.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                              <div
                                className="rounded-full"
                                style={{
                                  width: 10,
                                  height: `${Math.max(8, (val / maxVal) * 48)}px`,
                                  background: selectedCategory.color,
                                  opacity: val > 0 ? 1 : 0.25,
                                  transition: 'height 0.4s cubic-bezier(.4,2,.3,1)',
                                }}
                              ></div>
                              <div className="text-[10px] text-gray-400 mt-1">{dayLabels[i][0]}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-blue-200 mb-1">Recent Receipts</div>
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const categoryReceipts = receipts.filter(r => {
                        if (selectedCategory.name === 'Trip' || selectedCategory.name === 'Vacacions' || selectedCategory.name === 'Family') {
                          return r.isGroupExpense &&
                                 r.note &&
                                 r.note.includes('Group: ') &&
                                 r.note.split('Group: ')[1].split(' -')[0] === selectedCategory.name;
                        }
                        return (r.category || 'Uncategorized') === selectedCategory.name;
                      })
                      .sort((a, b) => {
                        const dateA = normalizeToLocalMidnight(a.transactionDate || a.date);
                        const dateB = normalizeToLocalMidnight(b.transactionDate || b.date);
                        if (!dateA && !dateB) return 0;
                        if (!dateA) return 1;
                        if (!dateB) return -1;
                        return dateB - dateA;
                      });

                      const groupedReceipts = [];
                      let currentMonth = null;
                      let currentMonthLabel = null;
                      let currentMonthReceipts = [];

                      categoryReceipts.forEach((receipt) => {
                        const receiptDate = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
                        if (!receiptDate) {
                          console.warn('Invalid date for receipt:', receipt.id, receipt.transactionDate || receipt.date);
                          return;
                        }

                        const year = receiptDate.getFullYear();
                        const month = receiptDate.getMonth();
                        const monthKey = `${year}-${month}`;
                        const monthLabel = receiptDate.toLocaleDateString(undefined, {
                          month: 'long',
                          year: 'numeric'
                        }).replace(/^[a-z]/, letter => letter.toUpperCase());

                        if (monthKey !== currentMonth) {
                          if (currentMonthReceipts.length > 0 && currentMonthLabel) {
                            groupedReceipts.push({
                              type: 'month',
                              label: currentMonthLabel,
                              receipts: currentMonthReceipts
                            });
                          }
                          currentMonth = monthKey;
                          currentMonthLabel = monthLabel;
                          currentMonthReceipts = [receipt];
                        } else {
                          currentMonthReceipts.push(receipt);
                        }
                      });

                      if (currentMonthReceipts.length > 0 && currentMonthLabel) {
                        groupedReceipts.push({
                          type: 'month',
                          label: currentMonthLabel,
                          receipts: currentMonthReceipts
                        });
                      }

                      return groupedReceipts.map((monthGroup, monthIndex) => (
                        <div key={monthIndex} className="space-y-2">
                          <div className="flex items-center gap-2 py-1">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
                            <span className="text-xs font-semibold text-blue-300/80 px-2 py-1 bg-blue-400/10 rounded-full">
                              {monthGroup.label}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
                          </div>

                          {monthGroup.receipts.map((r, idx) => {
                            const isExpanded = expandedInCategoryModalId === r.id;
                            return (
                              <div key={r.id || idx} className="bg-slate-800/80 rounded-lg shadow-inner overflow-hidden transition-all duration-300 ease-in-out">
                                <button
                                  className="w-full grid grid-cols-[1fr_auto] items-center gap-x-2 px-3 py-2 text-left"
                                  onClick={() => setExpandedInCategoryModalId(isExpanded ? null : r.id)}
                                >
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="font-medium text-white text-sm truncate">{r.merchant || 'Unknown'}</span>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs text-gray-400">{formatCurrency(r.total, r.currency || settings?.baseCurrency || 'EUR')}</span>
                                      {r.currency && r.currency !== (settings?.baseCurrency || 'EUR') && (
                                        <AsyncCurrencyConversion amount={r.total} currency={r.currency} date={r.transactionDate || r.date} />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-right whitespace-nowrap">
                                    <div className="flex flex-col items-end">
                                      <span className="text-xs text-blue-200">{formatDateSafely(r.transactionDate || r.date)}</span>
                                      <span className="text-xs text-gray-400">{r.paymentMethod || ''}</span>
                                    </div>
                                    <div className="transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                      <ChevronDown className="h-5 w-5 text-blue-400 flex-shrink-0" />
                                    </div>
                                  </div>
                                </button>
                                <div
                                  style={{ maxHeight: isExpanded ? '250px' : '0px' }}
                                  className="transition-all duration-300 ease-in-out"
                                >
                                  <div className="p-3 border-t border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Items:</div>
                                    {r.items && r.items.length > 0 ? (
                                      <ul className="text-xs text-gray-300 space-y-0.5">
                                        {r.items.map((item, i) => (
                                          <li key={i} className="flex justify-between">
                                            <span>{item.name}</span>
                                            <div className="flex flex-col items-end gap-0.5">
                                              <span>{formatCurrency(item.price, r.currency || settings?.baseCurrency || 'EUR')}</span>
                                              {r.currency && r.currency !== (settings?.baseCurrency || 'EUR') && (
                                                <AsyncCurrencyConversion amount={item.price} currency={r.currency} date={r.transactionDate || r.date} />
                                              )}
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-xs text-gray-500">No items listed.</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t border-white/10">
              <Button onClick={() => setModalOpen(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
