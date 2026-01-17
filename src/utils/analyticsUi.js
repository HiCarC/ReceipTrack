export const sumReceiptsInRange = (receipts, start, end, normalizeDate) =>
  receipts.reduce((total, receipt) => {
    const date = normalizeDate(receipt.transactionDate || receipt.date);
    if (!date || date < start || date > end) return total;
    const amount = parseFloat(receipt.total);
    return total + (Number.isFinite(amount) ? Math.abs(amount) : 0);
  }, 0);

export const getAnalyticsSummary = (receipts, range, normalizeDate) => {
  const total = sumReceiptsInRange(receipts, range.start, range.end, normalizeDate);
  const prevTotal = sumReceiptsInRange(receipts, range.prevStart, range.prevEnd, normalizeDate);
  const delta = total - prevTotal;
  const deltaPct = prevTotal ? (delta / prevTotal) * 100 : 0;
  return { total, delta, deltaPct, compareLabel: range.compareLabel };
};

export const getAnalyticsCategoryTotals = (receipts) =>
  receipts.reduce((acc, receipt) => {
    const amount = parseFloat(receipt.total);
    if (!Number.isFinite(amount)) return acc;
    const cat = receipt.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + Math.abs(amount);
    return acc;
  }, {});

export const getTopExpenses = (receipts, count = 3) =>
  [...receipts]
    .filter((receipt) => receipt && receipt.total)
    .sort((a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0))
    .slice(0, count);

export const getDonutSegments = (categoryTotals, categoryColors) => {
  const categoryEntries = Object.entries(categoryTotals || {}).filter(
    ([, value]) => value && Math.abs(value) > 0
  );
  const sortedCategories = categoryEntries.sort((a, b) => b[1] - a[1]);
  const segments = sortedCategories.slice(0, 4).map(([name, value]) => ({
    name,
    value,
    color: categoryColors[name] || "#135bec",
  }));
  if (segments.length === 0) {
    segments.push({ name: "Food", value: 1, color: "#135bec" });
    segments.push({ name: "Transport", value: 1, color: "#8b5cf6" });
    segments.push({ name: "Shopping", value: 1, color: "#14b8a6" });
    segments.push({ name: "Entertainment", value: 1, color: "#fb7185" });
  }
  return segments;
};

const buildBucketIndex = (value, markers) => {
  let idx = 0;
  for (let i = 1; i < markers.length; i += 1) {
    if (value >= markers[i]) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
};

export const buildActivitySeries = (receipts, rangeKey, range, normalizeDate) => {
  if (rangeKey === "week") {
    const labels = [];
    const data = Array(7).fill(0);
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(range.start);
      date.setDate(range.start.getDate() + i);
      labels.push(date.toLocaleDateString(undefined, { weekday: "short" }));
    }
    receipts.forEach((receipt) => {
      const date = normalizeDate(receipt.transactionDate || receipt.date);
      if (!date) return;
      const idx = Math.floor((date.getTime() - range.start.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) {
        const amount = parseFloat(receipt.total);
        data[idx] += Number.isFinite(amount) ? Math.abs(amount) : 0;
      }
    });
    return { labels, data };
  }

  if (rangeKey === "year") {
    const monthMarkers = [0, 2, 4, 6, 8, 10, 11];
    const labels = monthMarkers.map((monthIndex) =>
      new Date(range.start.getFullYear(), monthIndex, 1).toLocaleDateString(undefined, {
        month: "short",
      })
    );
    const data = Array(monthMarkers.length).fill(0);
    receipts.forEach((receipt) => {
      const date = normalizeDate(receipt.transactionDate || receipt.date);
      if (!date) return;
      const idx = buildBucketIndex(date.getMonth(), monthMarkers);
      const amount = parseFloat(receipt.total);
      data[idx] += Number.isFinite(amount) ? Math.abs(amount) : 0;
    });
    return { labels, data };
  }

  const lastDay = range.end.getDate();
  const dayMarkers = [1, 5, 10, 15, 20, 25, lastDay];
  const labels = dayMarkers.map((day) => String(day).padStart(2, "0"));
  const data = Array(dayMarkers.length).fill(0);
  receipts.forEach((receipt) => {
    const date = normalizeDate(receipt.transactionDate || receipt.date);
    if (!date) return;
    const idx = buildBucketIndex(date.getDate(), dayMarkers);
    const amount = parseFloat(receipt.total);
    data[idx] += Number.isFinite(amount) ? Math.abs(amount) : 0;
  });
  return { labels, data };
};
