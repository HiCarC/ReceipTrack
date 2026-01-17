import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useReceiptData from '@/hooks/useReceiptData';

vi.mock('@/firebase', () => ({ db: {} }));

const mockAddDoc = vi.fn(async () => ({ id: 'new' }));
const mockUpdateDoc = vi.fn(async () => ({}));
const mockDeleteDoc = vi.fn(async () => ({}));
const mockGetDocs = vi.fn(async () => ({
  docs: [
    { id: 'r1', data: () => ({ total: 10, createdAt: { toDate: () => new Date('2025-01-01') } }) },
    { id: 'r2', data: () => ({ total: 20, createdAt: { toDate: () => new Date('2025-02-01') } }) },
  ],
}));
const mockCollection = vi.fn(() => ({}));
const mockDoc = vi.fn(() => ({}));

vi.mock('firebase/firestore', () => ({
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
}));

describe('useReceiptData integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and sorts receipts by updated/created date', async () => {
    const setReceipts = vi.fn();
    const setIsFirestoreLoading = vi.fn();
    const setFirestoreError = vi.fn();
    const { result } = renderHook(() =>
      useReceiptData({
        user: { uid: 'u1' },
        toast: vi.fn(),
        receipts: [],
        setReceipts,
        setIsFirestoreLoading,
        setFirestoreError,
      })
    );

    await act(async () => {
      await result.current.fetchReceipts();
    });

    const sorted = setReceipts.mock.calls[0][0];
    expect(sorted[0].id).toBe('r2');
    expect(sorted[1].id).toBe('r1');
  });

  it('creates and updates receipts via Firestore', async () => {
    const { result } = renderHook(() =>
      useReceiptData({
        user: { uid: 'u1' },
        toast: vi.fn(),
        receipts: [],
        setReceipts: vi.fn(),
        setIsFirestoreLoading: vi.fn(),
        setFirestoreError: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.createReceipt({ total: 10 });
    });
    expect(mockAddDoc).toHaveBeenCalled();

    await act(async () => {
      await result.current.updateReceipt('r1', { total: 20 });
    });
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('deletes receipts and updates local state', async () => {
    const setReceipts = vi.fn();
    const receipts = [{ id: 'r1' }, { id: 'r2' }];
    const { result } = renderHook(() =>
      useReceiptData({
        user: { uid: 'u1' },
        toast: vi.fn(),
        receipts,
        setReceipts,
        setIsFirestoreLoading: vi.fn(),
        setFirestoreError: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.deleteReceipt('r1');
    });
    expect(mockDeleteDoc).toHaveBeenCalled();
    expect(setReceipts).toHaveBeenCalledWith([{ id: 'r2' }]);
  });
});
