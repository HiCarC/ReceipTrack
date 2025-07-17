import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

export default function JoinGroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [claimedName, setClaimedName] = useState(null);

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

  useEffect(() => {
    // If user is signed in, check if they have already claimed a name
    if (user && group && group.claimedBy) {
      const name = Object.keys(group.claimedBy).find(n => group.claimedBy[n] === user.uid);
      setClaimedName(name || null);
    }
  }, [user, group]);

  const handleClaim = async (name) => {
    if (!user) {
      setClaimError('You must be signed in to claim a name.');
      return;
    }
    setClaiming(true);
    setClaimError('');
    try {
      const ref = doc(db, 'groups', groupId);
      await updateDoc(ref, { [`claimedBy.${name}`]: user.uid });
      setGroup(g => ({ ...g, claimedBy: { ...g.claimedBy, [name]: user.uid } }));
      setClaimedName(name);
      setRedirecting(true);
      setTimeout(() => navigate(`/group/${groupId}`), 1200);
    } catch (e) {
      setClaimError('Failed to claim name. Try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black/90 text-white text-xl">Loading group...</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-black/90 text-red-400 text-xl">{error}</div>;
  }
  if (!group) return null;

  const unclaimed = (group.participants || []).filter(name => !group.claimedBy?.[name]);
  const alreadyClaimed = user && Object.values(group.claimedBy || {}).includes(user.uid);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black/90 px-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center">
        <div className="text-5xl mb-2">{group.emoji || '👥'}</div>
        <div className="text-2xl font-bold text-white mb-1 text-center">{group.name}</div>
        <div className="text-blue-200 mb-4 text-center">{group.currency}</div>
        <div className="w-full mb-4">
          <div className="text-blue-100 font-semibold mb-2">Participants</div>
          <ul className="bg-slate-800 rounded-lg p-3 mb-2">
            {(group.participants || []).map((p, i) => (
              <li key={i} className="text-white/90 py-1 flex items-center gap-2">
                <span>{p}</span>
                {group.claimedBy?.[p] && <span className="text-green-400 text-xs">(claimed)</span>}
              </li>
            ))}
          </ul>
        </div>
        {!user ? (
          <>
            <div className="text-blue-200 mb-2 text-center">Sign in to join this group:</div>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg mb-2"
              onClick={loginWithGoogle}
            >
              Sign in with Google
            </button>
          </>
        ) : claimedName ? (
          redirecting ? (
            <div className="flex flex-col items-center justify-center my-6">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mb-3"></div>
              <div className="text-blue-300 text-lg font-semibold">Joining group as <span className='font-bold'>{claimedName}</span>...</div>
            </div>
          ) : (
            <>
              <div className="text-green-400 font-semibold text-center mb-2">You have joined this group as <span className='font-bold'>{claimedName}</span>!</div>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg mt-2" onClick={() => navigate(`/group/${groupId}`)}>
                Go to Group
              </button>
            </>
          )
        ) : unclaimed.length > 0 ? (
          <>
            <div className="text-blue-200 mb-2 text-center">Who are you? Claim your name to join:</div>
            <div className="flex flex-col gap-3 w-full">
              {unclaimed.map(name => (
                <button
                  key={name}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg disabled:opacity-60"
                  onClick={() => handleClaim(name)}
                  disabled={claiming}
                >
                  {name}
                </button>
              ))}
            </div>
            {claimError && <div className="text-red-400 text-sm mt-2">{claimError}</div>}
          </>
        ) : (
          <div className="text-yellow-400 font-semibold text-center mb-2">All participant slots have been claimed.</div>
        )}
        <button className="mt-6 text-blue-400 hover:text-blue-300 underline" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    </div>
  );
} 