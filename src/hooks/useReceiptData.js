import { useCallback } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  addE2EReceipt,
  deleteE2EReceipt,
  getE2EReceipts,
  isE2E,
  updateE2EReceipt,
} from '@/utils/e2eUtils';

export default function useReceiptData({
  user,
  toast,
  receipts,
  setReceipts,
  setIsFirestoreLoading,
  setFirestoreError,
}) {
  const buildTransactions = (receiptData, receiptId, uid) => {
    const baseCategory = (receiptData.category || 'uncategorized').toString().toLowerCase();
    const dateValue =
      receiptData.transactionDate || receiptData.date || serverTimestamp();
    const currency = receiptData.currency || 'EUR';
    const merchant = receiptData.merchant || 'Unknown';
    const items = Array.isArray(receiptData.items) ? receiptData.items : [];

    if (items.length > 0) {
      return items
        .filter(item => item && item.name && Number.isFinite(Number(item.price)))
        .map(item => ({
          uid,
          receiptId,
          date: dateValue,
          merchant,
          category: baseCategory,
          amount: Math.abs(parseFloat(item.price) || 0),
          currency,
          itemName: item.name,
        }));
    }

    return [{
      uid,
      receiptId,
      date: dateValue,
      merchant,
      category: baseCategory,
      amount: Math.abs(parseFloat(receiptData.total) || 0),
      currency,
      itemName: null,
    }];
  };

  const upsertTransactions = async (receiptId, receiptData) => {
    if (!user) return;
    const batch = writeBatch(db);
    const existing = await getDocs(
      query(
        collection(db, 'transactions'),
        where('uid', '==', user.uid),
        where('receiptId', '==', receiptId)
      )
    );
    existing.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    const transactions = buildTransactions(receiptData, receiptId, user.uid);
    transactions.forEach((tx) => {
      const ref = doc(collection(db, 'transactions'));
      batch.set(ref, tx);
    });
    await batch.commit();
  };

  const deleteTransactions = async (receiptId) => {
    if (!user) return;
    const batch = writeBatch(db);
    const existing = await getDocs(
      query(
        collection(db, 'transactions'),
        where('uid', '==', user.uid),
        where('receiptId', '==', receiptId)
      )
    );
    existing.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  };

  const fetchReceipts = useCallback(async () => {
    if (!user) {
      return;
    }
    setIsFirestoreLoading(true);
    setFirestoreError(null);
    if (isE2E()) {
      try {
        const nextReceipts = getE2EReceipts(user.uid);
        const sortedReceipts = nextReceipts.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setReceipts(sortedReceipts);
      } finally {
        setIsFirestoreLoading(false);
      }
      return;
    }
    try {
      const data = await getDocs(collection(db, 'users', user.uid, 'receipts'));
      const receiptsList = data.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
      const sortedReceipts = receiptsList.sort((a, b) => {
        const dateA = (a.updated_at?.toDate?.() || a.createdAt?.toDate?.() || new Date(0));
        const dateB = (b.updated_at?.toDate?.() || b.createdAt?.toDate?.() || new Date(0));
        return dateB - dateA;
      });
      setReceipts(sortedReceipts);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setFirestoreError('Failed to load receipts. Please try again.');
    } finally {
      setIsFirestoreLoading(false);
    }
  }, [setIsFirestoreLoading, setFirestoreError, setReceipts, user]);

  const createReceipt = useCallback(async (receiptData) => {
    if (!user) {
      throw new Error('Authentication required to save receipt.');
    }
    if (isE2E()) {
      const now = Date.now();
      const created = addE2EReceipt({
        ...receiptData,
        id: `e2e-receipt-${now}`,
        userId: user.uid,
        createdAtMs: now,
      });
      setReceipts((prev) => [created, ...prev]);
      return created;
    }
    const receiptRef = await addDoc(collection(db, 'users', user.uid, 'receipts'), receiptData);
    try {
      await upsertTransactions(receiptRef.id, receiptData);
    } catch (error) {
      console.warn('Failed to write transactions:', error);
    }
    return receiptRef;
  }, [setReceipts, user]);

  const updateReceipt = useCallback(async (receiptId, receiptData) => {
    if (!user) {
      throw new Error('Authentication required to update receipt.');
    }
    if (isE2E()) {
      updateE2EReceipt(receiptId, receiptData);
      setReceipts((prev) => prev.map((receipt) => (receipt.id === receiptId ? { ...receipt, ...receiptData } : receipt)));
      return;
    }
    await updateDoc(doc(db, 'users', user.uid, 'receipts', receiptId), receiptData);
    try {
      await upsertTransactions(receiptId, receiptData);
    } catch (error) {
      console.warn('Failed to sync transactions:', error);
    }
  }, [setReceipts, user]);

  const deleteReceipt = useCallback(async (receiptId) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to delete receipts.',
        variant: 'destructive',
      });
      return;
    }
    if (isE2E()) {
      deleteE2EReceipt(receiptId);
      setReceipts(receipts.filter((receipt) => receipt.id !== receiptId));
      toast({
        title: 'Receipt Deleted',
        description: 'The receipt has been successfully removed.',
      });
      return;
    }
    try {
      const receiptToDelete = receipts.find(r => r.id === receiptId);

      if (receiptToDelete?.isGroupExpense && receiptToDelete?.groupExpenseId) {
        try {
          await deleteDoc(doc(db, 'groups', receiptToDelete.groupId, 'expenses', receiptToDelete.groupExpenseId));
          toast({
            title: 'Group Expense Deleted',
            description: 'The group expense has been removed from the group.',
          });
        } catch (groupError) {
          console.warn('Group expense delete skipped:', groupError);
        }
      }

      await deleteDoc(doc(db, 'users', user.uid, 'receipts', receiptId));
      try {
        await deleteTransactions(receiptId);
      } catch (error) {
        console.warn('Failed to delete transactions:', error);
      }
      setReceipts(receipts.filter((receipt) => receipt.id !== receiptId));

      if (!receiptToDelete?.isGroupExpense) {
        toast({
          title: 'Receipt Deleted',
          description: 'The receipt has been successfully removed.',
        });
      }

      await fetchReceipts();
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast({
        title: 'Error Deleting Receipt',
        description: `There was an issue deleting the receipt: ${error.message}`,
        variant: 'destructive',
      });
    }
  }, [fetchReceipts, receipts, setReceipts, toast, user]);

  return {
    fetchReceipts,
    createReceipt,
    updateReceipt,
    deleteReceipt,
  };
}
