import React, { useState } from 'react';
import AnalyticsReportDialog from '@/components/expenses/AnalyticsReportDialog';
import AnalyticsStatsHeader from '@/components/expenses/AnalyticsStatsHeader';
import AnalyticsSummaryBlocks from '@/components/expenses/AnalyticsSummaryBlocks';
import InsightsSection from '@/components/expenses/InsightsSection';
import SpendingMapBlock from '@/components/expenses/SpendingMapBlock';
import ReceiptChatDrawer from '@/components/expenses/ReceiptChatDrawer';
import { MessageCircle } from 'lucide-react';

export default function ExpensesTabView({
  analyticsRange,
  setAnalyticsRange,
  customRange,
  setCustomRange,
  analyticsSummary,
  analyticsReport,
  formatCurrency,
  settings,
  receipts,
  categoryTotals,
  calculatedTotals,
  getBaseAmount,
  categoryColors,
  showAnalyticsReport,
  setShowAnalyticsReport,
  donutStops,
  donutSegments,
  topCategory,
  topExpenses,
  onTabChange,
  showLocationInsights = true,
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-app-bg text-app-fg">
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        <header className="flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-lg font-bold">Analytics</h1>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
            aria-label="Open spend chat"
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </button>
        </header>

        <AnalyticsStatsHeader
          analyticsRange={analyticsRange}
          setAnalyticsRange={setAnalyticsRange}
          customRange={customRange}
          setCustomRange={setCustomRange}
          analyticsSummary={analyticsSummary}
          formatCurrency={formatCurrency}
          settings={settings}
        />

        <div className="mt-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold">Insights</h3>
            <button
              type="button"
              className="text-sm font-semibold text-app-primary"
              onClick={() => setShowAnalyticsReport(true)}
            >
              View Report
            </button>
          </div>
          <InsightsSection
            receipts={receipts}
            categoryTotals={categoryTotals}
            calculatedTotals={calculatedTotals}
            formatCurrency={formatCurrency}
            settings={settings}
            periodOverride={analyticsRange}
            onPeriodChange={setAnalyticsRange}
            variant="dark"
            hidePeriodSelect
            showTitle={false}
            getBaseAmount={getBaseAmount}
            categoryColors={categoryColors}
          />
        </div>

        <AnalyticsSummaryBlocks
          donutStops={donutStops}
          donutSegments={donutSegments}
          topCategory={topCategory}
          topExpenses={topExpenses}
          formatCurrency={formatCurrency}
          settings={settings}
          getBaseAmount={getBaseAmount}
        />

        {showLocationInsights && (
          <SpendingMapBlock
            receipts={receipts}
            getBaseAmount={getBaseAmount}
            onTabChange={onTabChange}
          />
        )}
      </div>
      <AnalyticsReportDialog
        open={showAnalyticsReport}
        onOpenChange={setShowAnalyticsReport}
        analyticsReport={analyticsReport}
        analyticsSummary={analyticsSummary}
        formatCurrency={formatCurrency}
        settings={settings}
        categoryColors={categoryColors}
      />
      <ReceiptChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
