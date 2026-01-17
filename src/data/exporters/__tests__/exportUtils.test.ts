import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRangeReceipts } from '@/data/exporters/utils';

vi.mock('@/firebase', () => ({ db: {} }));

const mockGetDocs = vi.fn(async () => ({
  docs: [
    { id: 'a', data: () => ({ date: '2026-01-15', total: 10 }) },
    { id: 'b', data: () => ({ date: '2026-03-01', total: 20 }) },
  ],
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: (...args: any[]) => mockGetDocs(...args),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'u1' } }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  auth: { currentUser: { uid: 'u1' } },
}));

describe('export utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters receipts in month range', async () => {
    const receipts = await fetchRangeReceipts('2026-01', '2026-01');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].id).toBe('a');
  });
});
