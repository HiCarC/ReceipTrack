import { describe, it, expect } from 'vitest';
import { generateMoneyS4CSV } from '@/data/exporters/moneyS4';

describe('moneyS4 exporter', () => {
  it('generates CSV rows with normalized dates', () => {
    const receipts = [
      { id: '1', date: '2026-01-05', total: 12.5, currency: 'EUR', merchant: 'Cafe' },
      { id: '2', date: new Date('2026-01-06'), total: 8, currency: 'USD', merchant: 'Shop' },
    ];
    const csv = generateMoneyS4CSV(receipts as any);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('ExternalId');
    expect(lines[1]).toContain('rct_1');
    expect(lines[1]).toContain('2026-01-05');
    expect(lines[2]).toContain('rct_2');
  });
});
