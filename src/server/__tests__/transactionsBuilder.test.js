import { describe, expect, it } from 'vitest';
import { buildTransactionsFromReceipt } from '../transactionsBuilder.js';

describe('buildTransactionsFromReceipt', () => {
  it('creates one transaction per item', () => {
    const receipt = {
      merchant: 'Cafe Uno',
      category: 'Dining',
      currency: 'EUR',
      transactionDate: '2026-02-10',
      items: [
        { name: 'Coffee', price: 3.5 },
        { name: 'Sandwich', price: 7.25 },
      ],
      total: 10.75,
    };
    const txs = buildTransactionsFromReceipt(receipt, 'r1', 'u1');
    expect(txs).toHaveLength(2);
    expect(txs[0].itemName).toBe('Coffee');
    expect(txs[0].amount).toBe(3.5);
    expect(txs[0].category).toBe('dining');
  });

  it('falls back to total when no items', () => {
    const receipt = {
      merchant: 'Metro',
      category: 'Transportation',
      currency: 'EUR',
      transactionDate: '2026-02-11',
      total: 8.2,
    };
    const txs = buildTransactionsFromReceipt(receipt, 'r2', 'u1');
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(8.2);
    expect(txs[0].itemName).toBeNull();
  });
});
