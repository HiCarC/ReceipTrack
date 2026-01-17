import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useReceiptAnalytics from '@/hooks/useReceiptAnalytics';
import { _test as balanceTest } from '@/hooks/useGroupBalances';

const normalize = (d) => {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

describe('stress tests', () => {
  it('handles 2000 receipts for analytics totals', async () => {
    const now = new Date();
    const receipts = Array.from({ length: 2000 }).map((_, i) => ({
      id: `r${i}`,
      merchant: `M${i}`,
      total: i % 2 === 0 ? 10 : 5,
      currency: i % 2 === 0 ? 'EUR' : 'USD',
      date: now,
    }));

    const convertToBaseCurrency = async (amount, fromCurrency) => {
      if (fromCurrency === 'EUR') return parseFloat(amount) * 2;
      return parseFloat(amount);
    };

    const expectedTotal = receipts.reduce((sum, r) => (
      sum + (r.currency === 'EUR' ? r.total * 2 : r.total)
    ), 0);

    const { result } = renderHook(() =>
      useReceiptAnalytics({
        receipts,
        settings: { baseCurrency: 'USD' },
        analyticsRange: 'month',
        weekStart: normalize(now),
        weekEnd: normalize(now),
        normalizeToLocalMidnight: normalize,
        convertToBaseCurrency,
        categoryColors: {},
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.analyticsSummary.total).toBe(expectedTotal);
    }, { timeout: 10000 });
  });

  it('handles 1000 group expenses with netting', () => {
    const expenses = Array.from({ length: 1000 }).map((_, i) => ({
      amount: 10,
      paidBy: i % 2 === 0 ? 'u1' : 'u2',
      splits: { u1: 5, u2: 5 },
    }));
    const settlements = [];
    const balances = balanceTest.computeBalances(expenses, settlements, { Alice: 'u1', Bob: 'u2' });
    const sum = Object.values(balances).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(0, 5);
  });
});
