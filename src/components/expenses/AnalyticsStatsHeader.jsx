import React from 'react';

export default function AnalyticsStatsHeader({
  analyticsRange,
  setAnalyticsRange,
  customRange,
  setCustomRange,
  analyticsSummary,
  formatCurrency,
  settings,
}) {
  const formatDateInput = (date) => {
    if (!date) return '';
    const value = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().split('T')[0];
  };

  const parseDateInput = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const updateCustomRange = (nextStart, nextEnd) => {
    if (!setCustomRange) return;
    const start = nextStart ? parseDateInput(nextStart) : null;
    const end = nextEnd ? parseDateInput(nextEnd) : null;
    if (!start || !end) {
      setCustomRange({ start: nextStart || '', end: nextEnd || '' });
      return;
    }
    const safeStart = start <= end ? start : end;
    const safeEnd = start <= end ? end : start;
    setCustomRange({
      start: formatDateInput(safeStart),
      end: formatDateInput(safeEnd),
    });
  };

  const setQuickRange = (days) => {
    if (!setCustomRange) return;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    setCustomRange({
      start: formatDateInput(start),
      end: formatDateInput(end),
    });
    setAnalyticsRange('custom');
  };

  const setLastYearRange = () => {
    if (!setCustomRange) return;
    const now = new Date();
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31);
    setCustomRange({
      start: formatDateInput(start),
      end: formatDateInput(end),
    });
    setAnalyticsRange('custom');
  };

  const customStart = customRange?.start ? parseDateInput(customRange.start) : null;
  const customEnd = customRange?.end ? parseDateInput(customRange.end) : null;
  const customDays =
    customStart && customEnd
      ? Math.max(1, Math.round((customEnd.getTime() - customStart.getTime()) / 86400000) + 1)
      : null;

  return (
    <>
      <div className="mt-4 flex items-center justify-center rounded-2xl bg-app-surface p-1">
        {[
          { key: "week", label: "This Week" },
          { key: "month", label: "This Month" },
          { key: "year", label: "This Year" },
          { key: "custom", label: "Custom" },
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

      {analyticsRange === "custom" && (
        <div className="mt-4 rounded-2xl bg-app-surface/80 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-app-muted">Custom Range</p>
              <p className="text-sm text-slate-200">
                {customStart && customEnd
                  ? `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`
                  : "Pick start and end dates"}
              </p>
            </div>
            {customDays && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                {customDays} days
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-xs font-semibold text-slate-300">
              From
              <input
                type="date"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-app-primary"
                value={customRange?.start || ''}
                onChange={(e) => updateCustomRange(e.target.value, customRange?.end || '')}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-slate-300">
              To
              <input
                type="date"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-app-primary"
                value={customRange?.end || ''}
                onChange={(e) => updateCustomRange(customRange?.start || '', e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuickRange(90)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/30"
            >
              Last 90 days
            </button>
            <button
              type="button"
              onClick={setLastYearRange}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/30"
            >
              Last year
            </button>
          </div>
        </div>
      )}

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
