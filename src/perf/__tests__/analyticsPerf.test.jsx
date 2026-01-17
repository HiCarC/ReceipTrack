import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useReceiptAnalytics from '@/hooks/useReceiptAnalytics';

const makeReceipts = (count) => {
  const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Other'];
  const receipts = [];
  for (let i = 0; i < count; i += 1) {
    receipts.push({
      id: `r-${i}`,
      merchant: `Merchant ${i}`,
      total: ((i % 50) + 1).toFixed(2),
      currency: 'EUR',
      category: categories[i % categories.length],
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    });
  }
  return receipts;
};

describe('analytics performance', () => {
  it('computes analytics for 2k receipts within budget', async () => {
    const receipts = makeReceipts(2000);
    const weekStart = new Date('2026-01-01');
    const weekEnd = new Date('2026-01-07');
    const start = performance.now();

    const { result } = renderHook(() =>
      useReceiptAnalytics({
        receipts,
        settings: { baseCurrency: 'EUR' },
        analyticsRange: 'month',
        weekStart,
        weekEnd,
        normalizeToLocalMidnight: (value) => (value ? new Date(value) : null),
        convertToBaseCurrency: async (amount) => parseFloat(amount || 0),
        categoryColors: {},
      })
    );

    await waitFor(() => {
      expect(result.current.analyticsSummary).toBeTruthy();
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1500);
  });
});
