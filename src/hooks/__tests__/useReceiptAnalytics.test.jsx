import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useReceiptAnalytics from '@/hooks/useReceiptAnalytics';

const normalize = (d) => {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

describe('useReceiptAnalytics', () => {
  it('uses base conversion for totals and report', async () => {
    const now = new Date();
    const receipts = [
      { id: '1', merchant: 'A', total: 10, currency: 'EUR', date: now },
      { id: '2', merchant: 'B', total: 5, currency: 'USD', date: now },
    ];

    const convertToBaseCurrency = async (amount, fromCurrency) => {
      if (fromCurrency === 'USD') return parseFloat(amount);
      return parseFloat(amount) * 2;
    };

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
      expect(result.current.analyticsSummary.total).toBe(25);
    });

    const topMerchant = result.current.analyticsReport.topMerchants[0];
    expect(topMerchant.baseAmount).toBe(20);
  });
});
