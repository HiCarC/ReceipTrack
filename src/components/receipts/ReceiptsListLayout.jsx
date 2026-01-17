import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Loader2, XCircle } from 'lucide-react';
import { groupReceiptsByMonth } from '@/utils/receiptGrouping';

export default function ReceiptsListLayout({
  showOnly,
  isFirestoreLoading,
  firestoreError,
  currentFunnyMessage,
  fetchReceipts,
  receipts,
  normalizeToLocalMidnight,
  setExpandedMonths,
  isMonthExpanded,
  calculatedTotals,
  formatCurrency,
  settings,
  groupFilter,
  setGroupFilter,
  groups,
  selectMode,
  selectedIds,
  setSelectedIds,
  renderReceiptCard,
}) {
  const isVisible = showOnly === 'receipts' || !showOnly;
  const { groupedReceipts, sortedMonths } = useMemo(() => (
    groupReceiptsByMonth(receipts, normalizeToLocalMidnight)
  ), [receipts, normalizeToLocalMidnight]);

  const fallbackMonthTotals = useMemo(() => {
    const totals = {};
    Object.entries(groupedReceipts).forEach(([monthKey, group]) => {
      const groupNetExpenses = {};
      let totalNetExpenses = 0;

      group.receipts.forEach(receipt => {
        const amount = parseFloat(receipt.total) || 0;
        const isGroupReceipt = receipt.isGroupExpense ||
          receipt.category === 'Group Expense' ||
          (receipt.note && receipt.note.includes('Group:'));

        if (isGroupReceipt && receipt.groupId) {
          if (!groupNetExpenses[receipt.groupId]) {
            groupNetExpenses[receipt.groupId] = {
              expenses: 0,
              reimbursements: 0,
              net: 0,
            };
          }

          const isReimbursement = receipt.isReimbursement;
          if (isReimbursement) {
            groupNetExpenses[receipt.groupId].reimbursements += amount;
          } else {
            groupNetExpenses[receipt.groupId].expenses += Math.abs(amount);
          }
        } else {
          totalNetExpenses += -Math.abs(amount);
        }
      });

      Object.values(groupNetExpenses).forEach(groupEntry => {
        groupEntry.net = -groupEntry.expenses + groupEntry.reimbursements;
        totalNetExpenses += groupEntry.net;
      });

      totals[monthKey] = totalNetExpenses;
    });
    return totals;
  }, [groupedReceipts]);

  const visibleReceiptsByMonth = useMemo(() => {
    const result = {};
    Object.entries(groupedReceipts).forEach(([monthKey, group]) => {
      const filtered = group.receipts.filter(r => {
        if (!groupFilter) return true;
        if (groupFilter === 'mine') {
          return !r.isGroupExpense &&
            r.category !== 'Group Expense' &&
            !(r.note && r.note.includes('Group:'));
        }
        return r.groupId === groupFilter;
      });
      result[monthKey] = filtered.sort((a, b) => {
        const dateA = normalizeToLocalMidnight(a.transactionDate || a.date);
        const dateB = normalizeToLocalMidnight(b.transactionDate || b.date);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB - dateA;
      });
    });
    return result;
  }, [groupedReceipts, groupFilter, normalizeToLocalMidnight]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="w-full md:w-1/3 flex-col items-center flex md:flex">
      <Card className="w-full p-4 md:p-6 flex flex-col items-center justify-start gap-4 bg-slate-800/80 text-white shadow-2xl rounded-2xl border border-blue-400/20">
        <CardHeader className="w-full p-0 mb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-blue-100">Your Receipts</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="w-full flex flex-col items-center justify-center p-0">
          {isFirestoreLoading ? (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>{currentFunnyMessage}</p>
            </div>
          ) : firestoreError ? (
            <div className="text-center text-red-400">
              <XCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{firestoreError}</p>
              <Button onClick={fetchReceipts} className="mt-4">Try Again</Button>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center">
              <p className="text-xl text-slate-400 font-semibold mb-2">No receipts yet!</p>
              <p className="text-md text-slate-500">
                It's a blank canvas for your financial journey. <br />
                Start by <span className="text-blue-400 font-medium">uploading your first receipt</span> or <span className="text-blue-400 font-medium">adding one manually</span>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 w-full md:max-h-[400px] md:overflow-y-auto md:overflow-x-hidden mb-12">
              {sortedMonths.map(monthKey => {
                  const group = groupedReceipts[monthKey];
                  const currentMonthLabel = new Date(group.year, group.month).toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  }).replace(/^[a-z]/, letter => letter.toUpperCase());

                  return (
                    <div key={monthKey} className="space-y-3">
                      <div
                        onClick={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isMonthExpanded(monthKey, group) }))}
                        role="button"
                        aria-expanded={isMonthExpanded(monthKey, group)}
                        className="sticky top-0 z-10 bg-gradient-to-r from-blue-900/90 via-slate-800/90 to-blue-900/90 backdrop-blur-md border border-blue-400/20 rounded-xl px-4 py-3 shadow-lg cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-blue-100 tracking-wide">
                            {currentMonthLabel}
                          </h3>
                          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMonths(prev => ({ ...prev, [monthKey]: !isMonthExpanded(monthKey, group) }));
                              }}
                              className="ml-2 inline-flex items-center justify-center w-7 h-7 rounded-full border border-blue-400/30 bg-blue-900/40 hover:bg-blue-900/60 transition"
                              aria-label="Toggle month"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${isMonthExpanded(monthKey, group) ? '' : '-rotate-90'}`} />
                            </button>
                            <span className="text-sm text-blue-200/90 font-medium bg-blue-800/40 rounded px-2 py-1">
                              {(() => {
                                const key = `${group.year}-${String(group.month + 1).padStart(2, '0')}`;
                                const monthlyTotal = calculatedTotals.monthlyTotals[key];
                                if (monthlyTotal && monthlyTotal.total > 0) {
                                  return formatCurrency(monthlyTotal.total, settings?.baseCurrency || 'EUR');
                                }
                                  return formatCurrency(
                                    fallbackMonthTotals[monthKey] || 0,
                                    settings?.baseCurrency || 'EUR'
                                  );
                                })()}
                            </span>
                            <div className="flex items-center space-x-1">
                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                              <span className="text-xs text-blue-200/80 font-medium">
                                {group.receipts.length}
                              </span>
                            </div>
                            <div className="ml-2">
                              <Select value={groupFilter || 'all'} onValueChange={(v) => setGroupFilter(v === 'all' ? null : v)}>
                                <SelectTrigger className="h-7 bg-slate-900/60 border-blue-700/40 text-blue-100 text-xs">
                                  <SelectValue placeholder="All groups" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 text-white border-blue-700/40 max-h-56">
                                  <SelectItem value="all">All groups</SelectItem>
                                  <SelectItem value="mine">Mine</SelectItem>
                                  {groups.map(g => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent"></div>
                      </div>

                      {isMonthExpanded(monthKey, group) && (
                        <div className="space-y-3 pl-2">
                          {(visibleReceiptsByMonth[monthKey] || []).map((receipt) => (
                              <div
                                key={receipt.id}
                                className="relative"
                                style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 180px' }}
                              >
                                {selectMode && (
                                  <input
                                    type="checkbox"
                                    className="absolute top-2 left-2 h-4 w-4 accent-blue-500"
                                    checked={selectedIds.has(receipt.id)}
                                    onChange={(e) => {
                                      setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        if (e.target.checked) next.add(receipt.id); else next.delete(receipt.id);
                                        return next;
                                      });
                                    }}
                                  />
                                )}
                                {renderReceiptCard(receipt)}
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
