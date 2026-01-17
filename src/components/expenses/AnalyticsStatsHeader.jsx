import React from 'react';

export default function AnalyticsStatsHeader({
  analyticsRange,
  setAnalyticsRange,
  analyticsSummary,
  formatCurrency,
  settings,
}) {
  return (
    <>
      <div className="mt-4 flex items-center justify-center rounded-2xl bg-app-surface p-1">
        {[
          { key: "week", label: "This Week" },
          { key: "month", label: "This Month" },
          { key: "year", label: "This Year" },
        ].map((option) => {
          const isActive = analyticsRange === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setAnalyticsRange(option.key)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                isActive ? "bg-white text-slate-900" : "text-slate-500"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-wider text-app-muted">Total Spending</p>
        <h2 className="text-4xl font-extrabold">
          {formatCurrency(analyticsSummary.total, settings?.baseCurrency || "EUR")}
        </h2>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            analyticsSummary.delta >= 0
              ? "bg-green-500/20 text-green-300"
              : "bg-rose-500/20 text-rose-300"
          }`}
        >
          {analyticsSummary.delta >= 0 ? "+" : "-"}
          {formatCurrency(Math.abs(analyticsSummary.delta), settings?.baseCurrency || "EUR")} (
          {Math.abs(analyticsSummary.deltaPct).toFixed(0)}%)
          <span className="text-slate-400 font-normal">vs {analyticsSummary.compareLabel}</span>
        </div>
      </div>
    </>
  );
}
