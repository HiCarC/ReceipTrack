import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,          // ← NEW
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import AuthHeader from './AuthHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

export default function JoinGroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();

  const [group, setGroup]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const [claiming, setClaiming]     = useState(false);
  const [claimError, setClaimError] = useState('');

  const [redirecting, setRedirecting] = useState(false);
  const [claimedName, setClaimedName] = useState(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName]             = useState('');
  const [addError, setAddError]           = useState('');
  const [adding, setAdding]               = useState(false);

  /* ------------------------------------------------------------------ */
  /* Load group and keep it in‑sync                                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const ref = doc(db, 'groups', groupId);
    const unsub = onSnapshot(
      ref,
      snap => {
        if (!snap.exists()) {
          setError('Group not found.');
        } else {
          setGroup({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      },
      () => {
        setError('Failed to load group.');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [groupId]);

  /* ------------------------------------------------------------------ */
  /* Detect if this user already claimed a slot                          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (user && group?.claimedBy) {
      const mine = Object.entries(group.claimedBy).find(
        ([, uid]) => uid === user.uid,
      );
      setClaimedName(mine ? mine[0] : null);
    }
  }, [user, group]);

  /* ------------------------------------------------------------------ */
  /* Claim an existing *unclaimed* participant name                      */
  /* ------------------------------------------------------------------ */
  const handleClaim = async name => {
    if (!user) {
      setClaimError('You must be signed in.');
      return;
    }
    if (group.claimedBy?.[name]) {
      setClaimError('This name is already claimed.');
      return;
    }

    setClaiming(true);
    setClaimError('');
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        [`claimedBy.${name}`]: user.uid,          // ← field‑path update
        memberUids: arrayUnion(user.uid),         // ← always update memberUids
      });
      setClaimedName(name);
      setRedirecting(true);
      setTimeout(() => navigate(`/group/${groupId}`), 1200);
    } catch (err) {
      console.error(err);
      setClaimError('Failed to claim name. Try again.');
    } finally {
      setClaiming(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Add a new participant + claim it                                    */
  /* ------------------------------------------------------------------ */
  const handleAddMyself = async () => {
    setAddError('');
    const name = newName.trim();

    if (!name) {
      setAddError('Name required.');
      return;
    }
    if (group.participants?.includes(name)) {
      setAddError('Name already exists.');
      return;
    }

    setAdding(true);
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        participants: arrayUnion(name),            // append
        [`claimedBy.${name}`]: user.uid,           // claim
        memberUids: arrayUnion(user.uid),          // ← always update memberUids
      });
      setClaimedName(name);
      setShowAddDialog(false);
      setRedirecting(true);
      setTimeout(() => navigate(`/group/${groupId}`), 1200);
    } catch (err) {
      console.error(err);
      setAddError('Failed to add. Try again.');
    } finally {
      setAdding(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/90 text-white text-xl">
        Loading group...
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/90 text-red-400 text-xl">
        {error}
      </div>
    );

  if (!group) return null;

  const unclaimed =
    group.participants?.filter(p => !group.claimedBy?.[p]) || [];

  return (
    <div className="min-h-screen flex flex-col bg-black/90">
      <AuthHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-8">
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full flex flex-col items-center">
          {/* Header ------------------------------------------------------ */}
          <div className="text-xl md:text-2xl font-bold text-white mb-1 text-center">
            {group.name}
          </div>
          <div className="text-blue-200 mb-4 text-center">{group.currency}</div>

          {/* Participant list ------------------------------------------- */}
          <div className="w-full mb-4">
            <div className="text-blue-100 font-semibold mb-2">Participants</div>
            <ul className="bg-slate-800 rounded-lg p-3 mb-2">
              {group.participants?.map(p => (
                <li
                  key={p}
                  className="text-white/90 py-1 flex items-center gap-2"
                >
                  <span>{p}</span>
                  {group.claimedBy?.[p] && (
                    <span className="text-green-400 text-xs">(Taken)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Auth / claim flow ----------------------------------------- */}
          {!user ? (
            <div className="w-full">
              {/* Enhanced sign-in section with better visual hierarchy */}
              <div className="bg-gradient-to-br from-slate-800 via-indigo-800 to-blue-800 rounded-2xl p-6 border border-blue-200/20 shadow-2xl mb-4">
                {/* Animated confetti/sparkle */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 animate-confetti">
                  <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
                    <circle cx="6" cy="8" r="2" fill="#fff" opacity=".7"/>
                    <circle cx="16" cy="4" r="1.5" fill="#fbbf24" opacity=".8"/>
                    <circle cx="26" cy="10" r="1.8" fill="#a5b4fc" opacity=".7"/>
                  </svg>
                </div>
                
                <div className="text-center mb-6">
                  <div className="text-2xl font-bold text-blue-100 mb-2">
                    Join "{group.name}"
                  </div>
                  <div className="text-slate-300 text-sm">
                    Sign in to claim your spot in this expense group
                  </div>
                </div>

                {/* Google Sign-in Button - matching landing page style */}
                <button
                  onClick={signInWithGoogle}
                  className="w-full bg-black text-white border border-gray-600 rounded-xl shadow-lg flex items-center justify-center gap-3 py-3.5 transition duration-200 ease-in-out hover:bg-white hover:text-black hover:border-black hover:scale-[1.02] active:scale-95 font-semibold text-lg"
                >
                  <img src="/google-icon.svg" alt="Google" className="h-5 w-5" />
                  <span>Sign in with Google</span>
                </button>

                {/* Divider */}
                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-slate-600"></div>
                  <span className="px-3 text-slate-400 text-sm">or</span>
                  <div className="flex-1 border-t border-slate-600"></div>
                </div>

                {/* Email Sign-in Button */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-email-auth-modal'))}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all duration-200 ease-in-out hover:scale-[1.02] active:scale-95 text-lg flex items-center justify-center gap-3"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Sign in with Email</span>
                </button>

                {/* Enhanced trust indicators */}
                <div className="flex items-center justify-center gap-3 mt-6">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Instant access</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600"></div>
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Bank-level security</span>
                  </div>
                </div>
              </div>
            </div>
          ) : claimedName ? (
            redirecting ? (
              <div className="flex flex-col items-center justify-center my-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mb-3" />
                <div className="text-blue-300 text-lg font-semibold">
                  Joining group as <span className="font-bold">{claimedName}</span>
                  ...
                </div>
              </div>
            ) : (
              <>
                <div className="text-green-400 font-semibold text-center mb-2">
                  You have joined this group as{' '}
                  <span className="font-bold">{claimedName}</span>!
                </div>
                <button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg mt-2"
                  onClick={() => navigate(`/group/${groupId}`)}
                >
                  Go to Group
                </button>
              </>
            )
          ) : (
            <>
              {/* Claim existing name ----------------------------------- */}
              {unclaimed.length > 0 && (
                <>
                  <div className="text-blue-200 mb-2 text-center">
                    Who are you? Claim your name to join:
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    {group.participants.map(name => {
                      const taken = !!group.claimedBy?.[name];
                      return taken ? (
                        <div
                          key={name}
                          className="w-full bg-slate-800 text-gray-400 font-semibold py-3 rounded-xl shadow-xl text-lg flex items-center justify-between px-4 opacity-60 cursor-not-allowed"
                        >
                          <span>{name}</span>
                          <span className="text-green-400 text-sm">(Taken)</span>
                        </div>
                      ) : (
                        <button
                          key={name}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
                          onClick={() => handleClaim(name)}
                          disabled={claiming}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Add myself ------------------------------------------- */}
              <Button
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
                onClick={() => setShowAddDialog(true)}
                disabled={adding}
              >
                + Add myself
              </Button>
              {claimError && (
                <div className="text-red-400 text-sm mt-2">{claimError}</div>
              )}

              {/* Add dialog ------------------------------------------ */}
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add yourself to this group</DialogTitle>
                    <DialogDescription>
                      Enter your name to join.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-4 mt-2">
                    <Label>Your name</Label>
                    <Input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Enter your name"
                      disabled={adding}
                    />
                    {addError && (
                      <div className="text-red-400 text-sm mt-1">{addError}</div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleAddMyself}
                      disabled={adding || !newName.trim()}
                      className="w-full mt-2"
                    >
                      {adding ? 'Adding...' : 'Add & Join'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          <button
            className="mt-6 text-blue-400 hover:text-blue-300 underline"
            onClick={() => navigate('/')}
          >
            🤖🚀 Take me home 🏠
          </button>
        </div>
      </div>
    </div>
  );
}
