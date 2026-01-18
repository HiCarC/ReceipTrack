import { useEffect, useMemo, useRef, useState } from 'react';
import { getDonutSegments } from '@/utils/analyticsUi';
import { estimateTaxForReceipt } from '@/utils/taxEstimator';

export default function useReceiptAnalytics({
  receipts,
  settings,
  analyticsRange,
  customRange,
  weekStart,
  weekEnd,
  normalizeToLocalMidnight,
  convertToBaseCurrency,
  categoryColors,
  enabled = true,
}) {
  const analyticsRangeConfig = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    const customStartRaw = customRange?.start ? new Date(`${customRange.start}T00:00:00`) : null;
    const customEndRaw = customRange?.end ? new Date(`${customRange.end}T23:59:59`) : null;
    const customStart = customStartRaw && !Number.isNaN(customStartRaw.getTime()) ? customStartRaw : null;
    const customEnd = customEndRaw && !Number.isNaN(customEndRaw.getTime()) ? customEndRaw : null;
    let customConfig = null;
    if (customStart && customEnd) {
      const start = customStart <= customEnd ? customStart : customEnd;
      const end = customStart <= customEnd ? customEnd : customStart;
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      customConfig = {
        start,
        end,
        prevStart,
        prevEnd,
        compareLabel: "previous period",
      };
    }

    return {
      week: {
        start: weekStart,
        end: weekEnd,
        prevStart: lastWeekStart,
        prevEnd: lastWeekEnd,
        compareLabel: "last week",
      },
      month: {
        start: monthStart,
        end: monthEnd,
        prevStart: lastMonthStart,
        prevEnd: lastMonthEnd,
        compareLabel: "last month",
      },
      year: {
        start: yearStart,
        end: yearEnd,
        prevStart: lastYearStart,
        prevEnd: lastYearEnd,
        compareLabel: "last year",
      },
      ...(customConfig ? { custom: customConfig } : {}),
    };
  }, [customRange?.end, customRange?.start, weekStart, weekEnd]);

  const analyticsReceipts = useMemo(() => {
    if (!enabled) return [];
    const range = analyticsRangeConfig[analyticsRange] || analyticsRangeConfig.month;
    return receipts.filter((receipt) => {
      const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
      return date && date >= range.start && date <= range.end;
    });
  }, [analyticsRange, analyticsRangeConfig, receipts, normalizeToLocalMidnight, enabled]);

  const getReceiptKey = (receipt) => {
    return (
      receipt?.id ||
      receipt?.transactionDate?.toDate?.()?.toISOString?.() ||
      receipt?.date ||
      receipt?.createdAt?.toDate?.()?.toISOString?.() ||
      `${receipt?.merchant || 'receipt'}-${receipt?.total || ''}`
    );
  };

  const computeTaxValue = (receipt) => {
    const { amount } = estimateTaxForReceipt(receipt, settings);
    return amount || 0;
  };

  const [baseAmountByReceipt, setBaseAmountByReceipt] = useState({});
  const [baseTaxByReceipt, setBaseTaxByReceipt] = useState({});
  const lastBaseAmountRef = useRef(null);
  const lastBaseTaxRef = useRef(null);

  const areMapsEqual = (next, prev) => {
    if (next === prev) return true;
    if (!next || !prev) return false;
    const nextKeys = Object.keys(next);
    const prevKeys = Object.keys(prev);
    if (nextKeys.length !== prevKeys.length) return false;
    for (let i = 0; i < nextKeys.length; i += 1) {
      const key = nextKeys[i];
      if (next[key] !== prev[key]) return false;
    }
    return true;
  };

  useEffect(() => {
    let isMounted = true;
    const loadBaseAmounts = async () => {
      if (!enabled) {
        if (isMounted) setBaseAmountByReceipt({});
        if (isMounted) setBaseTaxByReceipt({});
        return;
      }
      const range = analyticsRangeConfig[analyticsRange] || analyticsRangeConfig.month;
      const receiptsToConvert = receipts.filter((receipt) => {
        const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
        if (!date) return false;
        return (date >= range.start && date <= range.end) || (date >= range.prevStart && date <= range.prevEnd);
      });
      if (!receiptsToConvert.length) {
        if (isMounted) setBaseAmountByReceipt({});
        return;
      }
      const entries = await Promise.all(
        receiptsToConvert.map(async (receipt) => {
          const key = getReceiptKey(receipt);
          const amount = await convertToBaseCurrency(
            receipt.total,
            receipt.currency || settings?.baseCurrency || 'EUR',
            receipt.transactionDate || receipt.date
          );
          return [key, Math.abs(amount)];
        })
      );
      const taxEntries = await Promise.all(
        receiptsToConvert.map(async (receipt) => {
          const key = getReceiptKey(receipt);
          const taxValue = computeTaxValue(receipt);
          if (!taxValue) return [key, 0];
          const amount = await convertToBaseCurrency(
            taxValue,
            receipt.currency || settings?.baseCurrency || 'EUR',
            receipt.transactionDate || receipt.date
          );
          return [key, Math.abs(amount)];
        })
      );
      if (!isMounted) return;
      const next = {};
      entries.forEach(([key, value]) => {
        if (key) next[key] = value;
      });
      const nextTax = {};
      taxEntries.forEach(([key, value]) => {
        if (key) nextTax[key] = value;
      });
      if (!areMapsEqual(next, lastBaseAmountRef.current)) {
        lastBaseAmountRef.current = next;
        setBaseAmountByReceipt(next);
      }
      if (!areMapsEqual(nextTax, lastBaseTaxRef.current)) {
        lastBaseTaxRef.current = nextTax;
        setBaseTaxByReceipt(nextTax);
      }
    };
    loadBaseAmounts();
    return () => {
      isMounted = false;
    };
  }, [
    convertToBaseCurrency,
    receipts,
    settings?.baseCurrency,
    settings?.taxRates,
    enabled,
    analyticsRange,
    normalizeToLocalMidnight,
    weekStart,
    weekEnd,
    analyticsRangeConfig,
  ]);

  const getBaseAmount = (receipt) => {
    const key = getReceiptKey(receipt);
    if (key && baseAmountByReceipt[key] !== undefined) {
      return baseAmountByReceipt[key];
    }
    return Math.abs(parseFloat(receipt.total) || 0);
  };

  const getBaseTax = (receipt) => {
    const key = getReceiptKey(receipt);
    if (key && baseTaxByReceipt[key] !== undefined) {
      return baseTaxByReceipt[key];
    }
    return computeTaxValue(receipt);
  };

  const analyticsSummary = useMemo(() => {
    if (!enabled) {
      return { total: 0, delta: 0, deltaPct: 0, compareLabel: "" };
    }
    const range = analyticsRangeConfig[analyticsRange] || analyticsRangeConfig.month;
    const sumForRange = (start, end) =>
      receipts.reduce((total, receipt) => {
        const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
        if (!date || date < start || date > end) return total;
        return total + getBaseAmount(receipt);
      }, 0);

    const total = sumForRange(range.start, range.end);
    const prevTotal = sumForRange(range.prevStart, range.prevEnd);
    const delta = total - prevTotal;
    const deltaPct = prevTotal ? (delta / prevTotal) * 100 : 0;

    return { total, delta, deltaPct, compareLabel: range.compareLabel };
  }, [analyticsRange, analyticsRangeConfig, getBaseAmount, receipts, normalizeToLocalMidnight, enabled]);

  const analyticsCategoryTotals = useMemo(() => {
    if (!enabled) return {};
    return analyticsReceipts.reduce((acc, receipt) => {
      const amount = getBaseAmount(receipt);
      if (!Number.isFinite(amount)) return acc;
      const cat = receipt.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + amount;
      return acc;
    }, {});
  }, [analyticsReceipts, getBaseAmount, enabled]);

  const sortedCategories = Object.entries(analyticsCategoryTotals || {}).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0]?.[0] || "Food";

  const topExpenses = useMemo(() => {
    if (!enabled) return [];
    return [...analyticsReceipts]
      .filter((receipt) => receipt && receipt.total)
      .sort((a, b) => getBaseAmount(b) - getBaseAmount(a))
      .slice(0, 3);
  }, [analyticsReceipts, getBaseAmount, enabled]);

  const donutSegments = useMemo(
    () => (enabled ? getDonutSegments(analyticsCategoryTotals, categoryColors) : []),
    [analyticsCategoryTotals, categoryColors, enabled]
  );
  const donutTotal = donutSegments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  let donutOffset = 0;
  const donutStops = donutSegments.map((seg) => {
    const start = (donutOffset / donutTotal) * 100;
    donutOffset += seg.value;
    const end = (donutOffset / donutTotal) * 100;
    return `${seg.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  const activitySeries = useMemo(() => {
    if (!enabled) return { labels: [], data: [] };
    const range = analyticsRangeConfig[analyticsRange] || analyticsRangeConfig.month;
    const addAmount = (data, idx, receipt) => {
      const amount = getBaseAmount(receipt);
      if (!Number.isFinite(amount)) return;
      data[idx] += Math.abs(amount);
    };

    if (analyticsRange === "week") {
      const labels = [];
      const data = Array(7).fill(0);
      for (let i = 0; i < 7; i += 1) {
        const date = new Date(range.start);
        date.setDate(range.start.getDate() + i);
        labels.push(date.toLocaleDateString(undefined, { weekday: "short" }));
      }
      analyticsReceipts.forEach((receipt) => {
        const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
        if (!date) return;
        const idx = Math.floor((date.getTime() - range.start.getTime()) / 86400000);
        if (idx >= 0 && idx < 7) addAmount(data, idx, receipt);
      });
      return { labels, data };
    }

    if (analyticsRange === "custom") {
      const start = range.start;
      const end = range.end;
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      if (days <= 14) {
        const labels = [];
        const data = Array(days).fill(0);
        for (let i = 0; i < days; i += 1) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          labels.push(date.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
        }
        analyticsReceipts.forEach((receipt) => {
          const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
          if (!date) return;
          const idx = Math.floor((date.getTime() - start.getTime()) / 86400000);
          if (idx >= 0 && idx < days) addAmount(data, idx, receipt);
        });
        return { labels, data };
      }
      if (days <= 62) {
        const bucketCount = Math.ceil(days / 7);
        const labels = Array(bucketCount).fill(0).map((_, idx) => {
          const date = new Date(start);
          date.setDate(start.getDate() + idx * 7);
          return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        });
        const data = Array(bucketCount).fill(0);
        analyticsReceipts.forEach((receipt) => {
          const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
          if (!date) return;
          const idx = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
          if (idx >= 0 && idx < bucketCount) addAmount(data, idx, receipt);
        });
        return { labels, data };
      }
      const monthBuckets = [];
      const data = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        monthBuckets.push(cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" }));
        data.push(0);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      analyticsReceipts.forEach((receipt) => {
        const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
        if (!date) return;
        const idx = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
        if (idx >= 0 && idx < data.length) addAmount(data, idx, receipt);
      });
      return { labels: monthBuckets, data };
    }

    if (analyticsRange === "year") {
      const monthMarkers = [0, 2, 4, 6, 8, 10, 11];
      const labels = monthMarkers.map((monthIndex) =>
        new Date(range.start.getFullYear(), monthIndex, 1).toLocaleDateString(undefined, {
          month: "short",
        })
      );
      const data = Array(monthMarkers.length).fill(0);
      analyticsReceipts.forEach((receipt) => {
        const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
        if (!date) return;
        let idx = 0;
        for (let i = 1; i < monthMarkers.length; i += 1) {
          if (date.getMonth() >= monthMarkers[i]) idx = i;
          else break;
        }
        addAmount(data, idx, receipt);
      });
      return { labels, data };
    }

    const lastDay = range.end.getDate();
    const dayMarkers = [1, 5, 10, 15, 20, 25, lastDay];
    const labels = dayMarkers.map((day) => String(day).padStart(2, "0"));
    const data = Array(dayMarkers.length).fill(0);
    analyticsReceipts.forEach((receipt) => {
      const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
      if (!date) return;
      let idx = 0;
      for (let i = 1; i < dayMarkers.length; i += 1) {
        if (date.getDate() >= dayMarkers[i]) idx = i;
        else break;
      }
      addAmount(data, idx, receipt);
    });
    return { labels, data };
  }, [
    analyticsRange,
    analyticsRangeConfig,
    analyticsReceipts,
    normalizeToLocalMidnight,
    enabled,
    getBaseAmount,
  ]);

  const analyticsReport = useMemo(() => {
    if (!enabled) {
      return {
        range: analyticsRangeConfig[analyticsRange] || analyticsRangeConfig.month,
        daysInRange: 0,
        avgPerDay: 0,
        topCategories: [],
        topMerchants: [],
        activityMax: 0,
        activityMin: 0,
        activityAvg: 0,
        transactionCount: 0,
        averageTicket: 0,
        topCategoryShare: 0,
      };
    }
    const range = analyticsRangeConfig[analyticsRange] || analyticsRangeConfig.month;
    const receiptsInRange = analyticsReceipts;
    const total = analyticsSummary.total || 0;
    const daysInRange = Math.max(
      1,
      Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1
    );
    const avgPerDay = total / daysInRange;
    const categoryEntries = Object.entries(analyticsCategoryTotals || {}).sort((a, b) => b[1] - a[1]);
    const topCategories = categoryEntries.slice(0, 5).map(([name, value]) => ({
      name,
      value,
      pct: total ? (value / total) * 100 : 0,
    }));
    const topMerchants = [...receiptsInRange]
      .filter((receipt) => receipt && receipt.merchant && receipt.total)
      .map((receipt) => ({
        ...receipt,
        baseAmount: getBaseAmount(receipt),
      }))
      .sort((a, b) => (b.baseAmount || 0) - (a.baseAmount || 0))
      .slice(0, 5);
    const activityMax = Math.max(...activitySeries.data, 0);
    const activityMin = Math.min(...activitySeries.data, 0);
    const activityAvg = activitySeries.data.length
      ? activitySeries.data.reduce((sum, value) => sum + value, 0) / activitySeries.data.length
      : 0;
    const transactionCount = receiptsInRange.length;
    const averageTicket = transactionCount ? total / transactionCount : 0;
    const topCategoryShare = topCategories
      .slice(0, 3)
      .reduce((sum, entry) => sum + entry.pct, 0);
    const totalTax = receiptsInRange.reduce((sum, receipt) => sum + getBaseTax(receipt), 0);

    return {
      range,
      daysInRange,
      avgPerDay,
      topCategories,
      topMerchants,
      activityMax,
      activityMin,
      activityAvg,
      transactionCount,
      averageTicket,
      topCategoryShare,
      totalTax,
    };
  }, [
    analyticsCategoryTotals,
    analyticsRange,
    analyticsRangeConfig,
    analyticsReceipts,
    analyticsSummary.total,
    activitySeries.data,
    enabled,
    getBaseTax,
  ]);

  return {
    analyticsReceipts,
    analyticsSummary,
    analyticsCategoryTotals,
    topCategory,
    topExpenses,
    donutSegments,
    donutStops,
    activitySeries,
    analyticsReport,
    getBaseAmount,
    getBaseTax,
  };
}
