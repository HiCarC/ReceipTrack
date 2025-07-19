import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import GroupExpensesPage from './GroupExpensesPage';
import Skeleton from './Skeleton';
import NotFound from './NotFound';

export default function GroupExpensesPageLoader() {
  const { groupId, tab } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    if (!groupId) return;
    console.log('[GroupExpensesPageLoader] Fetching group:', groupId);
    const ref = doc(db, 'groups', groupId);
    // Use onSnapshot for real-time updates
    const unsub = onSnapshot(ref, (snap) => {
      console.log('[GroupExpensesPageLoader] Firestore snapshot:', snap);
      if (!snap.exists()) {
        console.warn('[GroupExpensesPageLoader] Group not found:', groupId);
        setError('Group not found.');
        setLoading(false);
        return;
      }
      const groupData = { id: snap.id, ...snap.data() };
      console.log('[GroupExpensesPageLoader] Loaded group data:', groupData);
      setGroup(groupData);
      setLoading(false);
    }, (e) => {
      console.error('[GroupExpensesPageLoader] Error loading group:', e);
      setError('Failed to load group.');
      setLoading(false);
    });
    return () => unsub();
  }, [groupId]);

  if (loading) {
    return <Skeleton type="group" />;
  }
  if (error === 'Group not found.') {
    return <NotFound />;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-black/90 text-red-400 text-xl">{error}</div>;
  }
  if (!group) return null;

  return <GroupExpensesPage group={group} initialTab={tab} onBack={() => navigate('/')} />;
} 