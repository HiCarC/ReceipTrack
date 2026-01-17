import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  convertToBaseCurrency,
  convertCurrency,
  getExchangeRate,
} from '@/utils/currencyUtils';

const mockFetch = (rates, base = 'USD') => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ rates, base_code: base }),
  }));
};

describe('currencyUtils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('converts to base currency using API rate', async () => {
    localStorage.setItem('expenseAppSettings', JSON.stringify({ baseCurrency: 'USD' }));
    mockFetch({ EUR: 0.5 }, 'USD');
    const converted = await convertToBaseCurrency(10, 'EUR', '2025-01-01');
    expect(converted).toBe(20);
  });

  it('converts between non-base currencies via base currency', async () => {
    localStorage.setItem('expenseAppSettings', JSON.stringify({ baseCurrency: 'USD' }));
    mockFetch({ EUR: 0.5, GBP: 2 }, 'USD');
    const converted = await convertCurrency(10, 'EUR', 'GBP', '2025-01-01');
    expect(converted).toBe(40);
  });

  it('uses the new base currency after change', async () => {
    localStorage.setItem('expenseAppSettings', JSON.stringify({ baseCurrency: 'USD' }));
    mockFetch({ EUR: 0.5 }, 'USD');
    const rateUsd = await getExchangeRate('2025-01-01', 'EUR');
    expect(rateUsd).toBe(0.5);

    localStorage.setItem('expenseAppSettings', JSON.stringify({ baseCurrency: 'EUR' }));
    mockFetch({ USD: 2 }, 'EUR');
    const rateEur = await getExchangeRate('2025-01-01', 'USD');
    expect(rateEur).toBe(2);
  });
});
