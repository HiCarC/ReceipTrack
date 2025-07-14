import React from 'react';
import { useGroup } from '../contexts/GroupContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function ItemAssignment({ items, onAssignmentChange }) {
  const { members, assignments, assignItem } = useGroup();

  const handleAssign = (itemIdx, member) => {
    assignItem(itemIdx, member);
    if (onAssignmentChange) onAssignmentChange(itemIdx, member);
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Assign Items to Friends</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 && <div>No items to assign.</div>}
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="flex-1">{item.name} <span className="text-gray-500">({item.price})</span></span>
              <Select
                value={assignments[idx] || ''}
                onValueChange={val => handleAssign(idx, val)}
                disabled={members.length === 0}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
} 