import { describe, expect, it } from 'vitest';
import { aggregateReceipts, applyMessageHints, buildResponseText } from '../spendQuery.js';

const receipts = [
  {
    total: 10,
    category: 'Food',
    merchant: 'Cafe Uno',
    currency: 'EUR',
    tax: 1,
    transactionDate: new Date('2026-02-05T10:00:00Z'),
  },
  {
    total: 20,
    category: 'Travel',
    merchant: 'Metro',
    currency: 'EUR',
    tax: 0.5,
    transactionDate: new Date('2026-02-06T10:00:00Z'),
  },
  {
    total: 15,
    category: 'Food',
    merchant: 'Deli',
    currency: 'EUR',
    tax: 0,
    transactionDate: new Date('2025-12-31T10:00:00Z'),
  },
  {
    total: 30,
    category: 'Food',
    merchant: 'Cafe Uno',
    currency: 'USD',
    tax: 2,
    transactionDate: new Date('2026-02-10T10:00:00Z'),
  },
];

describe('applyMessageHints', () => {
  it('adds year range and category grouping for breakdown request', () => {
    const now = new Date('2026-02-15T00:00:00Z');
    const args = applyMessageHints('Break down my spending by category this year', {}, now);
    expect(args.filters.year).toBe(2026);
    expect(args.filters.period).toBe('year');
    expect(args.group_by).toContain('category');
    expect(args.metrics).toContain('total');
  });
});

describe('aggregateReceipts', () => {
  it('summarizes totals and groupings for a year with category filter', () => {
    const args = {
      filters: { year: 2026, currency: ['EUR'] },
      group_by: ['category'],
      sort: { metric: 'total', direction: 'desc' },
    };
    const summary = aggregateReceipts({ receipts, args, defaultCurrency: 'EUR' });
    expect(summary.summary.total).toBeCloseTo(30);
    expect(summary.summary.count).toBe(2);
    expect(summary.range.start).toBe('2026-01-01');
    expect(summary.range.end).toBe('2026-12-31');
    const top = summary.groupings[0];
    expect(top.key).toBe('Travel');
    expect(top.total).toBeCloseTo(20);
  });

  it('renders a helpful breakdown response', () => {
    const args = {
      filters: { year: 2026, currency: ['EUR'] },
      group_by: ['category'],
      sort: { metric: 'total', direction: 'desc' },
    };
    const summary = aggregateReceipts({ receipts, args, defaultCurrency: 'EUR' });
    const response = buildResponseText(summary, 'Break down my spending by category this year');
    expect(response).toMatch(/Top categories:/);
    expect(response).toMatch(/Travel/);
  });
});
