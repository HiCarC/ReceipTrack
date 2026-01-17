import {
  buildActivitySeries,
  getAnalyticsCategoryTotals,
  getAnalyticsSummary,
  getDonutSegments,
  getTopExpenses,
} from '../analyticsUi';

const normalize = (d) => {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

describe('analyticsUi helpers', () => {
  it('summarizes totals and deltas for ranges', () => {
    const receipts = [
      { total: '10', date: '2024-10-01' },
      { total: '20', date: '2024-10-15' },
      { total: '40', date: '2024-09-20' },
    ];
    const range = {
      start: new Date(2024, 9, 1),
      end: new Date(2024, 9, 31, 23, 59, 59, 999),
      prevStart: new Date(2024, 8, 1),
      prevEnd: new Date(2024, 8, 30, 23, 59, 59, 999),
      compareLabel: 'last month',
    };

    const summary = getAnalyticsSummary(receipts, range, normalize);
    expect(summary.total).toBe(30);
    expect(summary.delta).toBe(-10);
    expect(Math.round(summary.deltaPct)).toBe(-25);
    expect(summary.compareLabel).toBe('last month');
  });

  it('builds category totals and top expenses', () => {
    const receipts = [
      { total: '50', category: 'Food' },
      { total: '-30', category: 'Travel' },
      { total: '20', category: 'Food' },
    ];
    const totals = getAnalyticsCategoryTotals(receipts);
    expect(totals.Food).toBe(70);
    expect(totals.Travel).toBe(30);

    const top = getTopExpenses(receipts, 2);
    expect(top[0].total).toBe('50');
    expect(top[1].total).toBe('20');
  });

  it('builds donut segments with fallbacks', () => {
    const emptySegments = getDonutSegments({}, {});
    expect(emptySegments).toHaveLength(4);
    expect(emptySegments[0].name).toBe('Food');

    const segments = getDonutSegments({ Food: 50, Travel: 20 }, { Food: '#fff' });
    expect(segments[0].name).toBe('Food');
    expect(segments[0].color).toBe('#fff');
  });

  it('builds activity series for week, month, and year', () => {
    const receipts = [
      { total: '10', date: '2024-10-07' },
      { total: '25', date: '2024-10-09' },
      { total: '40', date: '2024-12-24' },
    ];
    const weekRange = {
      start: new Date(2024, 9, 6),
      end: new Date(2024, 9, 12, 23, 59, 59, 999),
    };
    const weekSeries = buildActivitySeries(receipts.slice(0, 2), 'week', weekRange, normalize);
    expect(weekSeries.labels).toHaveLength(7);
    expect(weekSeries.data.reduce((a, b) => a + b, 0)).toBe(35);

    const monthRange = {
      start: new Date(2024, 9, 1),
      end: new Date(2024, 9, 31, 23, 59, 59, 999),
    };
    const monthSeries = buildActivitySeries(receipts.slice(0, 2), 'month', monthRange, normalize);
    expect(monthSeries.labels).toContain('01');
    expect(monthSeries.data.reduce((a, b) => a + b, 0)).toBe(35);

    const yearRange = {
      start: new Date(2024, 0, 1),
      end: new Date(2024, 11, 31, 23, 59, 59, 999),
    };
    const yearSeries = buildActivitySeries(receipts, 'year', yearRange, normalize);
    expect(yearSeries.labels).toHaveLength(7);
    expect(yearSeries.data.reduce((a, b) => a + b, 0)).toBe(75);
  });
});
