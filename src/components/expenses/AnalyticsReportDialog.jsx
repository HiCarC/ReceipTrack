import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AnalyticsReportDialog({
  open,
  onOpenChange,
  analyticsReport,
  analyticsSummary,
  formatCurrency,
  settings,
  categoryColors,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-bg text-white border border-white/10 rounded-3xl p-0 max-w-md w-[94vw] max-h-[92vh]">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-white/10">
          <DialogTitle className="text-xl font-bold">Analytics Report</DialogTitle>
          <DialogDescription className="text-sm text-app-muted">
            Strategic spend analysis for the selected period.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[72vh]">
          <div className="px-6 py-5 space-y-5">
            <div className="rounded-2xl bg-app-surface p-4">
              <div className="text-xs uppercase tracking-wider text-app-muted">Executive Summary</div>
              <div className="mt-3 text-2xl font-bold">
                {formatCurrency(analyticsSummary.total, settings?.baseCurrency || "EUR")}
              </div>
              <div className="mt-2 text-sm text-slate-300">
                Average {formatCurrency(analyticsReport.avgPerDay, settings?.baseCurrency || "EUR")} per day over{" "}
                {analyticsReport.daysInRange} days.
              </div>
              <div className="mt-2 text-xs text-app-muted">
                {analyticsSummary.delta >= 0 ? "Increase" : "Decrease"} of{" "}
                {formatCurrency(Math.abs(analyticsSummary.delta), settings?.baseCurrency || "EUR")} vs{" "}
                {analyticsSummary.compareLabel}.
              </div>
            </div>

            <div className="rounded-2xl bg-app-surface p-4">
              <div className="text-sm font-semibold">Spend Pulse</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-black/30 p-3">
                  <div className="text-xs text-app-muted">Peak Day</div>
                  <div className="mt-1 font-semibold">
                    {formatCurrency(analyticsReport.activityMax, settings?.baseCurrency || "EUR")}
                  </div>
                </div>
                <div className="rounded-xl bg-black/30 p-3">
                  <div className="text-xs text-app-muted">Average Ticket</div>
                  <div className="mt-1 font-semibold">
                    {formatCurrency(analyticsReport.averageTicket, settings?.baseCurrency || "EUR")}
                  </div>
                </div>
                <div className="rounded-xl bg-black/30 p-3">
                  <div className="text-xs text-app-muted">Average Daily</div>
                  <div className="mt-1 font-semibold">
                    {formatCurrency(analyticsReport.activityAvg, settings?.baseCurrency || "EUR")}
                  </div>
                </div>
                <div className="rounded-xl bg-black/30 p-3">
                  <div className="text-xs text-app-muted">Transactions</div>
                  <div className="mt-1 font-semibold">
                    {analyticsReport.transactionCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-app-surface p-4">
              <div className="text-sm font-semibold">Category Concentration</div>
              <div className="mt-3 space-y-3">
                {analyticsReport.topCategories.length === 0 ? (
                  <div className="text-sm text-app-muted">No spend captured in this period.</div>
                ) : (
                  analyticsReport.topCategories.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColors[entry.name] || "#135bec" }} />
                        <span className="text-slate-200">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(entry.value, settings?.baseCurrency || "EUR")}
                        </div>
                        <div className="text-xs text-app-muted">{entry.pct.toFixed(0)}%</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-app-surface p-4">
              <div className="text-sm font-semibold">Top Merchants</div>
              <div className="mt-3 space-y-3">
                {analyticsReport.topMerchants.length === 0 ? (
                  <div className="text-sm text-app-muted">No merchant data available.</div>
                ) : (
                  analyticsReport.topMerchants.map((receipt) => (
                    <div key={receipt.id || receipt.merchant} className="flex items-center justify-between text-sm">
                      <div className="text-slate-200 truncate max-w-[55%]">{receipt.merchant}</div>
                      <div className="font-semibold">
                        {formatCurrency(
                          receipt.baseAmount ?? (parseFloat(receipt.total) || 0),
                          settings?.baseCurrency || "EUR"
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-app-surface p-4">
              <div className="text-sm font-semibold">Strategic Signals</div>
              <div className="mt-3 text-sm text-slate-300 space-y-2">
                <div>
                  {analyticsSummary.delta >= 0 ? "Spend acceleration" : "Spend moderation"} is observed vs{" "}
                  {analyticsSummary.compareLabel}.{" "}
                  {analyticsSummary.delta >= 0
                    ? "Consider reinforcing controls on discretionary categories."
                    : "Maintain momentum and reallocate surplus to priority goals."}
                </div>
                <div>
                  {analyticsReport.transactionCount > 0
                    ? "Transaction cadence indicates your spending velocity for the period."
                    : "No transactions captured; confirm data coverage and sync cadence."}
                </div>
                <div>
                  Top categories drive{" "}
                  {analyticsReport.topCategoryShare.toFixed(0)}% of spend.
                  Tighten vendor management in these areas for material impact.
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t border-white/10">
          <Button onClick={() => onOpenChange(false)} className="w-full bg-app-primary text-white">
            Close Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
