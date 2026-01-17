import React from 'react';
import { Store } from 'lucide-react';

export default function AnalyticsSummaryBlocks({
  donutStops,
  donutSegments,
  topCategory,
  topExpenses,
  formatCurrency,
  settings,
  getBaseAmount,
}) {
  return (
    <>
      <div className="mt-6 rounded-2xl bg-app-surface p-5">
        <h3 className="text-lg font-bold">Spending by Category</h3>
        <div className="mt-6 flex items-center gap-6">
          <div className="relative h-32 w-32 shrink-0">
            <div
              className="h-full w-full rounded-full"
              style={{ background: `conic-gradient(${donutStops.join(', ')})` }}
            />
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-app-surface text-center">
              <span className="w-full text-[10px] uppercase text-app-muted">Top</span>
              <span className="w-full text-sm font-bold text-center">{topCategory}</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {donutSegments.map((seg) => (
              <div key={seg.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-200">{seg.name}</span>
                </div>
                <span className="text-slate-200 font-semibold">
                  {formatCurrency(seg.value, settings?.baseCurrency || 'EUR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold">Top Expenses</h3>
          <button type="button" className="text-sm font-semibold text-app-primary" disabled>View All</button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {topExpenses.map((expense) => (
            <div key={expense.id} className="flex items-center gap-3 rounded-2xl bg-app-surface p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-primary/20 text-app-primary">
                <Store className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold">{expense.merchant || 'Unknown'}</p>
                <p className="text-xs text-app-muted">{expense.category || 'Other'}</p>
              </div>
              <span className="text-sm font-bold">
                {formatCurrency(getBaseAmount(expense), settings?.baseCurrency || 'EUR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
