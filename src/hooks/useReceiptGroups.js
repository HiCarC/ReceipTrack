import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

export default function useReceiptGroups({ user, receipts }) {
  const [recentGroups, setRecentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState(null);
  const [groupSwitcherOpen, setGroupSwitcherOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        const snap = await getDocs(collection(db, 'groups'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const active = list.filter(g => {
          const claimedByVals = g?.claimedBy ? Object.values(g.claimedBy) : [];
          const isMember = Array.isArray(claimedByVals) && claimedByVals.includes(user.uid);
          const archivedBy = Array.isArray(g?.archivedBy) ? g.archivedBy : [];
          const isArchivedForUser = archivedBy.includes(user.uid);
          return isMember && !isArchivedForUser;
        });
        const counts = {};
        receipts.forEach(r => { if (r.groupId) counts[r.groupId] = (counts[r.groupId] || 0) + 1; });
        const enriched = active.map(g => ({
          id: g.id,
          name: g.name || `Group ${g.id.slice(0, 4)}`,
          emoji: g.emoji || 'Group',
          uses: counts[g.id] || 0,
          archivedBy: Array.isArray(g.archivedBy) ? g.archivedBy : [],
        }));
        setGroups(enriched);
        setRecentGroups(enriched);
      } catch (e) {
        console.warn('Failed to load groups', e);
      }
    };
    load();
  }, [receipts, user]);

  return {
    recentGroups,
    setRecentGroups,
    selectedGroupId,
    setSelectedGroupId,
    groups,
    setGroups,
    groupFilter,
    setGroupFilter,
    groupSwitcherOpen,
    setGroupSwitcherOpen,
  };
}
