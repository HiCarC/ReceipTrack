import { useCallback } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export default function useReceiptData({
  user,
  toast,
  receipts,
  setReceipts,
  setIsFirestoreLoading,
  setFirestoreError,
}) {
  const fetchReceipts = useCallback(async () => {
    if (!user) {
      return;
    }
    setIsFirestoreLoading(true);
    setFirestoreError(null);
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
    return addDoc(collection(db, 'users', user.uid, 'receipts'), receiptData);
  }, [user]);

  const updateReceipt = useCallback(async (receiptId, receiptData) => {
    if (!user) {
      throw new Error('Authentication required to update receipt.');
    }
    return updateDoc(doc(db, 'users', user.uid, 'receipts', receiptId), receiptData);
  }, [user]);

  const deleteReceipt = useCallback(async (receiptId) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to delete receipts.',
        variant: 'destructive',
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
