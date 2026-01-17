import { describe, it, expect } from 'vitest';
import { _test as balanceTest } from '@/hooks/useGroupBalances';

describe('useGroupBalances helpers', () => {
  it('rounds using bankers rounding', () => {
    expect(balanceTest.roundCents(1.005)).toBe(1);
    expect(balanceTest.roundCents(1.015)).toBe(1.01);
  });

  it('normalizes splits to match total', () => {
    const normalized = balanceTest.normalizeSplitsToTotal({ a: 0.1, b: 0.2 }, 0.3);
    const sum = Object.values(normalized).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(0.3, 5);
  });

  it('resolves name keys to uid and merges duplicates', () => {
    const merged = balanceTest.normalizeSplitKeys({ Alice: 10, uidA: 5 }, { Alice: 'uidA' });
    expect(merged.uidA).toBe(15);
  });

  it('maps names to uids when provided', () => {
    expect(balanceTest.resolveNameKey('Alice', { Alice: 'uidA' })).toBe('uidA');
    expect(balanceTest.resolveNameKey('uidB', { Alice: 'uidA' })).toBe('uidB');
  });

  it('nets reimbursements against settlements', () => {
    const expenses = [
      { amount: 50, paidBy: 'u1', splits: { u1: 25, u2: 25 } },
      { amount: 25, paidBy: 'u1', splits: { u2: 25 }, expenseType: 'reimbursement', date: '2026-01-01' },
    ];
    const settlements = [
      { from: 'u1', to: 'u2', amount: 25, settled: true, settledAt: { toDate: () => new Date('2026-01-01') } },
    ];
    const balances = balanceTest.computeBalances(expenses, settlements, { Alice: 'u1', Bob: 'u2' });
    expect(balances.Alice).toBeCloseTo(50, 2);
    expect(balances.Bob).toBeCloseTo(-50, 2);
  });
});
