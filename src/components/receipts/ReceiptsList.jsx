import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function ReceiptsList({
  receipts,
  renderReceiptCard,
  isFirestoreLoading,
  firestoreError,
  fetchReceipts,
  currentFunnyMessage,
  settings,
}) {
  const normalizeToLocalMidnight = (d) => {
    if (!d) return null;
    if (typeof d.toDate === 'function') { d = d.toDate(); }
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [year, month, day] = d.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const date = new Date(d);
    if (isNaN(date)) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  const sortedReceipts = [...receipts].sort((a, b) => {
    const dateA = normalizeToLocalMidnight(a.transactionDate || a.date);
    const dateB = normalizeToLocalMidnight(b.transactionDate || b.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });

  return (
    <Card className="w-full max-w-sm p-6">
      <CardHeader>
        <CardTitle>Your Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        {isFirestoreLoading ? (
          <div className="flex items-center justify-center text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <p>{currentFunnyMessage}</p>
          </div>
        ) : firestoreError ? (
          <div className="text-center text-red-500">
            <p>{firestoreError}</p>
            <Button onClick={fetchReceipts} className="mt-4">Try Again</Button>
          </div>
        ) : receipts.length === 0 ? (
          <p className="text-center text-gray-500">No receipts yet. Upload one to get started!</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 w-full md:max-h-[400px] overflow-y-auto">
            {sortedReceipts.map((receipt) => renderReceiptCard(receipt))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
