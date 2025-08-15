import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { listQueued, updateStatus, removeQueued } from '@/data/storage';

export async function flushQueue(userId: string) {
  const items = await listQueued(userId);
  for (const q of items) {
    try {
      await updateStatus(q.id, 'processing');
      const payload = { ...q.payload, createdAt: serverTimestamp() } as any;
      if (q.type === 'group' && payload.groupId) {
        // Write to flat /receipts per your rules for group receipts
        await addDoc(collection(db, 'receipts'), {
          groupId: payload.groupId,
          label: payload.merchant || 'Receipt',
          amount: payload.total || 0,
          paidBy: 'unknown',
          date: payload.date || new Date().toISOString().slice(0,10),
          createdBy: userId,
          createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'users', userId, 'receipts'), payload);
      }
      await updateStatus(q.id, 'done');
      await removeQueued(q.id);
    } catch (e) {
      await updateStatus(q.id, 'needs_fix', (e as Error).message);
    }
  }
}

export function installBackgroundSync(getUserId: () => string | null) {
  async function tryFlush() {
    const uid = getUserId();
    if (!uid) return;
    if (navigator.onLine) {
      await flushQueue(uid);
    }
  }
  window.addEventListener('online', tryFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryFlush();
  });
  // initial attempt
  tryFlush();
}


