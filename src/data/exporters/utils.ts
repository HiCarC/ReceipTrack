import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';

export async function fetchMonthReceipts(month: string) {
  // month: YYYY-MM
  const { auth } = await import('@/contexts/AuthContext');
  // Fallback: try window auth provider if hook unavailable here
  const user = auth?.currentUser || (await import('firebase/auth')).getAuth()?.currentUser;
  if (!user) return [];
  const snap = await getDocs(collection(db, 'users', user.uid, 'receipts'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const [y,m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return list.filter(r => {
    const d = r.transactionDate?.toDate ? r.transactionDate.toDate() : (r.transactionDate ? new Date(r.transactionDate) : (r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null)));
    return d && !isNaN(d) && d >= start && d <= end;
  });
}

export async function fetchRangeReceipts(startMonth: string, endMonth: string) {
  const { auth } = await import('@/contexts/AuthContext');
  const user = auth?.currentUser || (await import('firebase/auth')).getAuth()?.currentUser;
  if (!user) return [];
  const snap = await getDocs(collection(db, 'users', user.uid, 'receipts'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const start = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em, 0, 23, 59, 59, 999);
  return list.filter(r => {
    const d = r.transactionDate?.toDate ? r.transactionDate.toDate() : (r.transactionDate ? new Date(r.transactionDate) : (r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null)));
    return d && !isNaN(d) && d >= start && d <= end;
  });
}


