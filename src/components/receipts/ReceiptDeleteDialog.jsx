import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

export default function ReceiptDeleteDialog({
  showDeleteModal,
  setShowDeleteModal,
  pendingDeleteId,
  setPendingDeleteId,
  handleDeleteReceipt,
}) {
  return (
    <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
      <DialogContent className="max-w-xs bg-red-600/95 text-white border-none rounded-2xl shadow-2xl animate-fade-in-up">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Trash2 className="h-6 w-6 text-yellow-200 animate-bounce" />
            Delete Receipt?
          </DialogTitle>
          <DialogDescription className="text-white/80 mt-2">
            This action <span className="font-bold text-yellow-200">cannot be undone</span>.<br />
            Are you sure you want to send this receipt to the digital shredder?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            className="bg-white/10 text-white hover:bg-white/20 rounded-lg px-4 py-2"
            onClick={() => { setShowDeleteModal(false); setPendingDeleteId(null); }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="bg-yellow-400 text-red-700 font-bold hover:bg-yellow-300 rounded-lg px-4 py-2 shadow-md animate-pulse"
            onClick={() => {
              if (pendingDeleteId) handleDeleteReceipt(pendingDeleteId);
              setShowDeleteModal(false); setPendingDeleteId(null);
            }}
          >
            <Trash2 className="inline-block mr-1 h-5 w-5" /> Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
