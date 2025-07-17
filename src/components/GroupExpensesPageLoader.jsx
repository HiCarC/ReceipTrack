import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import GroupExpensesPage from './GroupExpensesPage';

export default function GroupExpensesPageLoader() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchGroup() {
      setLoading(true);
      setError('');
      try {
        const ref = doc(db, 'groups', groupId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError('Group not found.');
          setLoading(false);
          return;
        }
        setGroup({ id: snap.id, ...snap.data() });
        setLoading(false);
      } catch (e) {
        setError('Failed to load group.');
        setLoading(false);
      }
    }
    fetchGroup();
  }, [groupId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black/90 text-white text-xl">Loading group...</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-black/90 text-red-400 text-xl">{error}</div>;
  }
  if (!group) return null;

  return <GroupExpensesPage group={group} onBack={() => navigate('/')} />;
} 