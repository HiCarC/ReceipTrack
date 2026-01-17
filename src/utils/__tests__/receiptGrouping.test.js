import { describe, it, expect } from 'vitest';
import { buildDaySections } from '@/utils/receiptGrouping';

const normalize = (d) => {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

describe('receiptGrouping', () => {
  it('groups receipts by day in descending order', () => {
    const receipts = [
      { id: '1', date: '2026-01-02', total: 10 },
      { id: '2', date: '2026-01-01', total: 20 },
      { id: '3', date: '2026-01-02', total: 30 },
    ];
    const sections = buildDaySections(receipts, normalize);
    expect(sections.length).toBe(2);
    expect(sections[0].receipts.map(r => r.id)).toEqual(['1', '3']);
    expect(sections[1].receipts.map(r => r.id)).toEqual(['2']);
  });
});
