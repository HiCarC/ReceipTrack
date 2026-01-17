import React, { useState } from 'react';
import { useGroup } from '@/contexts/GroupContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GroupManager() {
  const { members, addMember, removeMember } = useGroup();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name');
      return;
    }
    if (members.includes(trimmed)) {
      setError('Already added');
      return;
    }
    addMember(trimmed);
    setName('');
    setError('');
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Group Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Add a friend (name)"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="flex-1"
          />
          <Button onClick={handleAdd}>Add</Button>
        </div>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <ul className="list-disc pl-5">
          {members.map(m => (
            <li key={m} className="flex items-center justify-between py-1">
              <span>{m}</span>
              <Button variant="ghost" size="sm" onClick={() => removeMember(m)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
} 