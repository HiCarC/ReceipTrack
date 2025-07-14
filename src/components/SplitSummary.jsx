import React, { useMemo } from 'react';
import { useGroup } from '../contexts/GroupContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function SplitSummary({ items }) {
  const { members, assignments } = useGroup();

  // Calculate totals per member
  const memberTotals = useMemo(() => {
    const totals = {};
    members.forEach(m => { totals[m] = 0; });
    items.forEach((item, idx) => {
      const assigned = assignments[idx];
      if (assigned && totals.hasOwnProperty(assigned)) {
        const price = parseFloat(item.price) || 0;
        totals[assigned] += price;
      }
    });
    return totals;
  }, [members, assignments, items]);

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Split Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 && <div>No group members.</div>}
        {members.length > 0 && (
          <ul className="space-y-1">
            {members.map(m => (
              <li key={m} className="flex justify-between">
                <span>{m}</span>
                <span>{memberTotals[m].toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
} 