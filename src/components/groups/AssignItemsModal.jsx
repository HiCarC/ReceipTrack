import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { X, UserPlus, Users } from 'lucide-react';

// Props: open, onClose, items (array of {id, name, price}), members (array of {id, name, avatar}), onAssignDone(assignments)
export default function AssignItemsModal({ open, onClose, items, members, onAssignDone }) {
  // assignments: { itemId: [memberId, ...] }
  const [assignments, setAssignments] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  // Calculate per-member totals
  const memberTotals = {};
  items.forEach(item => {
    const assigned = assignments[item.id] || [];
    if (assigned.length === 0) return;
    const split = parseFloat(item.price) / assigned.length;
    assigned.forEach(memberId => {
      memberTotals[memberId] = (memberTotals[memberId] || 0) + split;
    });
  });

  const handleAssign = (itemId, memberId) => {
    setAssignments(prev => ({ ...prev, [itemId]: [memberId] }));
    setSelectedItem(null);
  };

  const handleSplitAssign = (itemId, memberId) => {
    setAssignments(prev => {
      const prevAssigned = prev[itemId] || [];
      if (prevAssigned.includes(memberId)) {
        // Remove
        return { ...prev, [itemId]: prevAssigned.filter(id => id !== memberId) };
      } else {
        // Add
        return { ...prev, [itemId]: [...prevAssigned, memberId] };
      }
    });
  };

  const allAssigned = items.every(item => (assignments[item.id] || []).length > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>Assign Items to People</DialogTitle>
        </DialogHeader>
        {/* Members Avatars */}
        <div className="flex gap-3 mb-4 overflow-x-auto">
          {members.map(m => (
            <div key={m.id} className="flex flex-col items-center">
              <img src={m.avatar} alt={m.name} className="w-10 h-10 rounded-full border-2 border-blue-400" />
              <span className="text-xs mt-1 text-blue-100">{m.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
        {/* Items List */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {items.map(item => {
            const assigned = assignments[item.id] || [];
            return (
              <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border ${assigned.length === 0 ? 'border-red-400 bg-red-50/10' : 'border-blue-400 bg-blue-50/10'}`}>
                <div className="flex-1">
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-xs text-blue-200">€{parseFloat(item.price).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Assigned Avatars */}
                  {assigned.map(memberId => {
                    const m = members.find(mem => mem.id === memberId);
                    return m ? <img key={memberId} src={m.avatar} alt={m.name} className="w-7 h-7 rounded-full border-2 border-blue-400" /> : null;
                  })}
                  {/* Assign Button */}
                  <Button size="icon" variant="ghost" onClick={() => setSelectedItem(item.id)}>
                    {assigned.length === 0 ? <UserPlus className="w-5 h-5 text-blue-300" /> : <Users className="w-5 h-5 text-blue-300" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {/* Assignment Popover */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-slate-900 rounded-xl p-6 w-80 flex flex-col gap-3">
              <div className="font-semibold text-blue-100 mb-2">Assign to:</div>
              <div className="flex flex-wrap gap-3">
                {members.map(m => (
                  <Button key={m.id} variant="outline" className={`flex flex-col items-center ${assignments[selectedItem]?.includes(m.id) ? 'border-blue-500 bg-blue-100/10' : ''}`} onClick={() => handleSplitAssign(selectedItem, m.id)}>
                    <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full mb-1" />
                    <span className="text-xs text-blue-100">{m.name.split(' ')[0]}</span>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => setSelectedItem(null)} variant="secondary" className="flex-1">Done</Button>
                <Button onClick={() => setAssignments(prev => ({ ...prev, [selectedItem]: [] }))} variant="destructive" className="flex-1">Clear</Button>
              </div>
            </div>
          </div>
        )}
        {/* Summary */}
        <div className="mt-6 bg-slate-800 rounded-lg p-4">
          <div className="font-semibold text-blue-200 mb-2">Summary</div>
          <div className="flex flex-col gap-1">
            {members.map(m => (
              <div key={m.id} className="flex justify-between text-blue-100">
                <span className="flex items-center gap-2">
                  <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full" />
                  {m.name.split(' ')[0]}
                </span>
                <span className="font-bold">€{(memberTotals[m.id] || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="mt-4 flex flex-col gap-2">
          <Button disabled={!allAssigned} onClick={() => onAssignDone(assignments)} className="w-full">Settle Up</Button>
          <Button variant="ghost" onClick={onClose} className="w-full text-red-400">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 