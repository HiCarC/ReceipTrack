import React, { useEffect, useState } from "react";
import { Plus, Users, Link2, X, MoreVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import QRCode from 'react-qr-code';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

/**
 * Mobile‑first, fully responsive implementation of the Groups home screen.
 * Layout invariants:
 * – A global *top banner* (provided by the app shell) sits above this page.
 * – A *bottom nav bar* (72 px) is fixed below. We keep clear of it via padding.
 * – A floating action button (+) stays just above the nav bar.
 * – The page title ("Groups") is always visible without scrolling.
 */
export default function GroupHomeScreen({ onTabChange, onGroupEnter }) {
  /* ------------------------------------------------------------------ */
  /* Local state & hooks                                                */
  /* ------------------------------------------------------------------ */
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Creation modal state
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [participants, setParticipants] = useState(() =>
    user ? [user.displayName] : []
  );
  const [creating, setCreating] = useState(false);
  const [participantsInput, setParticipantsInput] = useState("");

  // Claim‑name modal
  const [pendingClaim, setPendingClaim] = useState(null);
  const [claimError, setClaimError] = useState("");

  // World-class sharing confirmation window after creating a group
  const [showShare, setShowShare] = useState(false);
  const [lastCreatedGroup, setLastCreatedGroup] = useState(null);

  // QR code modal
  const [showQR, setShowQR] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Firestore: live list of groups where current user is a member       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Groups I created
    const createdQ = query(collection(db, "groups"), where("createdBy", "==", user.uid));
    // Groups I joined
    const memberQ = query(collection(db, "groups"), where("memberUids", "array-contains", user.uid));

    // Listen to both queries and merge the snapshots
    const unsubCreated = onSnapshot(createdQ, snapCreated => {
      const mine = snapCreated.docs.map(d => ({ id: d.id, ...d.data() }));
      // nested listener for the second query so we always merge latest results
      const unsubMember = onSnapshot(memberQ, snapMember => {
        const joined = snapMember.docs.map(d => ({ id: d.id, ...d.data() }));
        const merged = [...mine, ...joined.filter(j => !mine.find(m => m.id === j.id))];
        setGroups(merged);
        setLoading(false);
      });
      // clean up both listeners when deps change
      return () => unsubMember();
    });

    return () => unsubCreated();
  }, [user]);

  // Auto-enter a group if a prefill is present (coming from capture flow)
  useEffect(() => {
    try {
      let pf = window.__GROUP_PREFILL__;
      if ((!pf || !pf.groupId) && typeof sessionStorage !== 'undefined') {
        const any = groups.find(g => sessionStorage.getItem(`group_prefill_${g.id}`));
        if (any) {
          try { pf = JSON.parse(sessionStorage.getItem(`group_prefill_${any.id}`)); } catch {}
        }
      }
      if (!pf || !pf.groupId) return;
      const match = groups.find(g => g.id === pf.groupId);
      if (match) {
        onGroupEnter?.(match);
      }
    } catch {}
  }, [groups]);

  /* ------------------------------------------------------------------ */
  /* UI helpers                                                         */
  /* ------------------------------------------------------------------ */
  const NAV_HEIGHT = 72; // px – matches bottom nav bar height in shell
  const FAB_SIZE = 72; // px – size of the floating + button

  const emptyState = (
    <p className="text-center text-blue-200/70 text-lg mt-16">
      No groups yet. Tap <span className="font-bold">+</span> to create or join one.
    </p>
  );

  /* ------------------------------------------------------------------ */
  /* Handlers                                                           */
  /* ------------------------------------------------------------------ */
  const handleCreate = async e => {
    e.preventDefault();
    if (!user || creating) return;

    const participantNames = participants.filter(Boolean);
    if (!participantNames.includes(user.displayName)) participantNames.unshift(user.displayName);

    const groupData = {
      name: groupName.trim(),
      currency,
      participants: participantNames,
      claimedBy: { [user.displayName]: user.uid },
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      memberUids: [user.uid],
    };

    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, "groups"), groupData);
      setShowCreate(false);
      setGroupName("");
      setParticipants([user.displayName]);
      setLastCreatedGroup({ id: docRef.id, ...groupData });
      setShowShare(true);
    } catch (err) {
      console.error(err);
      // real app: toast
    } finally {
      setCreating(false);
    }
  };

  const handleEnterGroup = group => {
    if (!user) return;
    const already = Object.values(group.claimedBy || {}).includes(user.uid);
    if (already) {
      onGroupEnter?.(group);
      return;
    }
    // find an unclaimed slot
    const unclaimed = (group.participants || []).find(p => !(group.claimedBy || {})[p]);
    if (!unclaimed) return; // all taken
    setPendingClaim({ group, name: unclaimed });
  };

  const claimName = async () => {
    if (!pendingClaim || !user) return;
    const { group, name } = pendingClaim;
    try {
      await updateDoc(doc(db, "groups", group.id), {
        [`claimedBy.${name}`]: user.uid,
        memberUids: arrayUnion(user.uid),
      });
      setPendingClaim(null);
      onGroupEnter?.({ ...group, claimedBy: { ...group.claimedBy, [name]: user.uid } });
    } catch (err) {
      console.error(err);
      setClaimError("Could not claim name. Try again.");
    }
  };

  const handleAddParticipant = () => {
    const name = participantsInput.trim();
    if (!name || participants.includes(name) || name === user.displayName) return;
    setParticipants([...participants, name]);
    setParticipantsInput("");
  };
  const handleRemoveParticipant = (name) => {
    setParticipants(participants.filter(p => p !== name));
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  // Filter out groups archived by this user
  const visibleGroups = groups.filter(g => !(g.archivedBy || []).includes(user?.uid));
  // Get archived groups for this user
  const archivedGroups = groups.filter(g => (g.archivedBy || []).includes(user?.uid));
  return (
    <div className="flex flex-col h-screen bg-black/90 text-white">
      {/* Title always visible */}
      {/* Main header bar */}
      <header className="shrink-0 py-4 px-4 text-2xl font-bold tracking-tight border-b border-slate-800 backdrop-blur bg-[#10182a] text-blue-400">
        ExpenseTracker
      </header>
      {/* Remove avatar/profile and three dots from here */}
      {/* Floating 3-dot menu button at bottom right */}
      <div className="fixed bottom-[calc(88px)] right-4 z-40">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-4 rounded-full bg-slate-800/90 hover:bg-slate-700 focus:outline-none shadow-xl border border-slate-700 transition-all duration-150" aria-label="Group list options">
              <MoreVertical className="h-7 w-7 text-white" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className="z-50 min-w-[140px] bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700/40 py-2 px-1"
            side="top"
            align="end"
            sideOffset={8}
          >
            <DropdownMenu.Item className="px-4 py-2 rounded hover:bg-blue-700/30 cursor-pointer" onClick={() => setShowArchived(true)}>
              Archived
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* Scrollable list – account for bottom nav & FAB */}
      <main
        className="flex-1 overflow-y-auto px-4"
        style={{ paddingBottom: `${NAV_HEIGHT + FAB_SIZE / 2 + 24}px` }}
      >
        {loading ? (
          <p className="text-center text-blue-200/70 text-lg mt-16">Loading…</p>
        ) : visibleGroups.length === 0 ? (
          emptyState
        ) : (
          <ul className="flex flex-col gap-4 mt-4 pb-2">
            {visibleGroups.map(g => (
              <li key={g.id}>
                <button
                  onClick={() => handleEnterGroup(g)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 shadow-lg border border-blue-700/20 hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  <span className="text-3xl">👥</span>
                  <span className="flex-1 text-left truncate font-semibold text-lg">
                    {g.name}
                  </span>
                  <span className="text-blue-400 text-xl">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Floating + button */}
      <button
        aria-label="Add group"
        onClick={() => setShowCreate(true)}
        className="fixed left-1/2 -translate-x-1/2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 flex items-center justify-center shadow-xl border-4 border-blue-900 transition-all"
        style={{
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
          bottom: `calc(${NAV_HEIGHT}px + 12px)`,
        }}
      >
        <Plus className="w-10 h-10" />
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Create group modal                                                */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white">
          <DialogTitle className="text-2xl font-bold text-center">Create a group</DialogTitle>
          <DialogDescription className="text-blue-300 text-center mb-2">
            Name your group, choose a currency, and add participants.
            </DialogDescription>

          <form onSubmit={handleCreate} className="flex flex-col gap-4 mt-4">
            <label className="flex flex-col gap-1">
              <span className="text-blue-200">Group name</span>
              <input
                className="rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                required
              />
            </label>

            {/* currency select */}
            <label className="flex flex-col gap-1">
              <span className="text-blue-200">Currency</span>
              <select
                className="rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {[
                  { code: "EUR", name: "Euro", symbol: "€" },
                  { code: "USD", name: "US Dollar", symbol: "$" },
                  { code: "GBP", name: "British Pound", symbol: "£" },
                  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
                ].map(c => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </label>

            {/* Add members UI */}
            <label className="flex flex-col gap-1">
              <span className="text-blue-200">Participants</span>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={participantsInput || ''}
                  onChange={e => setParticipantsInput(e.target.value)}
                  placeholder="Add a participant name"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddParticipant(); } }}
                />
                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow"
                  onClick={handleAddParticipant}
                >
                  Add
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {participants.map((p, idx) => (
                  <li key={p} className="bg-slate-800 px-3 py-1 rounded-lg flex items-center gap-2">
                    <span>{p === user.displayName ? `${p} (me)` : p}</span>
                    {p !== user.displayName && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-600 text-xs font-bold"
                        onClick={() => handleRemoveParticipant(p)}
                        aria-label={`Remove ${p}`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </label>

            <DialogFooter className="mt-2">
              <button
                type="submit"
                disabled={creating}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold shadow-lg"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Claim modal                                                      */}
      {/* ------------------------------------------------------------------ */}
      {pendingClaim && (
        <Dialog open onOpenChange={() => setPendingClaim(null)}>
          <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white">
            <DialogTitle><VisuallyHidden>Claim group participant name</VisuallyHidden></DialogTitle>
            <DialogDescription><VisuallyHidden>Confirm group participant identity</VisuallyHidden></DialogDescription>
              {claimError && <p className="text-red-400">{claimError}</p>}
            <DialogFooter className="mt-4 flex gap-2">
              <button
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold shadow-lg"
                onClick={claimName}
              >
                Claim & join
              </button>
              <DialogClose asChild>
                <button className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-800 font-semibold shadow-lg">
                  Cancel
                </button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* World-class sharing confirmation window after creating a group */}
      {showShare && lastCreatedGroup && (
        <Dialog open={showShare} onOpenChange={setShowShare}>
          <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white flex flex-col items-center">
            <DialogTitle className="text-2xl font-bold text-center">Group Created!</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">Share your group with friends so they can join.</DialogDescription>
            <div className="w-full mb-2">
              <div className="uppercase text-xs font-semibold text-blue-200 mb-1 tracking-wide">Participants to invite</div>
              <div className="bg-slate-800 rounded-lg p-2 flex flex-col gap-1">
                {(lastCreatedGroup.participants || []).filter(p => p !== user.displayName).map(p => (
                  <div key={p} className="text-white px-2 py-1 rounded text-base bg-slate-900/60">{p}</div>
                ))}
                {((lastCreatedGroup.participants || []).filter(p => p !== user.displayName).length === 0) && (
                  <div className="text-blue-300 px-2 py-1 text-sm">No other participants to invite.</div>
                )}
              </div>
            </div>
            {/* Add the visible message with hyperlink here */}
            <div className="text-blue-200 text-center text-base my-2 px-2 break-words">
              Join my group "{lastCreatedGroup.name}" on ExpenseApp:
              <br />
              <a
                href={`${window.location.origin}/join/${lastCreatedGroup.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline break-all"
              >
                {`${window.location.origin}/join/${lastCreatedGroup.id}`}
              </a>
            </div>
            <div className="text-blue-300 text-xs mt-2 mb-4 text-center px-2">
              Participants can view, edit, and delete expenses, as well as add their own.
            </div>
            <div className="flex w-full gap-2 mb-2">
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-xl text-lg"
                onClick={async () => {
                  const url = `${window.location.origin}/join/${lastCreatedGroup.id}`;
                  const text = `Join my group "${lastCreatedGroup.name}" on ExpenseApp: ${url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                }}
              >
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A12.07 12.07 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.19 1.6 6.01L0 24l6.18-1.62A12.07 12.07 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.23-3.48-8.52zM12 22c-1.85 0-3.68-.5-5.26-1.44l-.38-.22-3.67.96.98-3.58-.25-.37A9.94 9.94 0 0 1 2 12C2 6.48 6.48 2 12 2c2.4 0 4.68.84 6.5 2.36A9.93 9.93 0 0 1 22 12c0 5.52-4.48 10-10 10zm5.2-7.8c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.62-.47-.16-.01-.36-.01-.56-.01-.19 0-.5.07-.76.34-.26.27-1 1-.97 2.43.03 1.43 1.03 2.81 1.18 3.01.15.2 2.03 3.1 5.02 4.23.7.24 1.25.38 1.68.48.71.17 1.36.15 1.87.09.57-.07 1.75-.72 2-1.41.25-.69.25-1.28.18-1.41-.07-.13-.25-.2-.53-.34z"/></svg>
                WhatsApp
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl text-lg"
                onClick={async () => {
                  const url = `${window.location.origin}/join/${lastCreatedGroup.id}`;
                  const text = `Join my group "${lastCreatedGroup.name}" on ExpenseApp: ${url}`;
                  if (navigator.share) {
                    await navigator.share({ title: 'Join my group', text, url });
                  } else {
                    await navigator.clipboard.writeText(url);
                    alert('Group link copied to clipboard!');
                  }
                }}
              >
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77l-7.15-4.13c.05-.23.08-.47.08-.72s-.03-.49-.08-.72l7.12-4.11c.54.5 1.25.81 2.02.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .25.03.49.08.72L6.91 9.84A2.97 2.97 0 0 0 4 7c0-1.66 1.34-3 3-3s3 1.34 3 3c0 .25-.03.49-.08.72l-7.12 4.11c-.54-.5-1.25-.81-2.02-.81C1.34 12 0 13.34 0 15s1.34 3 3 3 3-1.34 3-3c0-.25-.03-.49-.08-.72l7.12-4.11c.54.5 1.25.81 2.02.81 1.66 0 3-1.34 3-3s-1.34-3-3-3z"/></svg>
                Share
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl shadow-xl text-lg"
                onClick={() => setShowQR(true)}
              >
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm6 0h8v8h-8V5zm2 2v4h4V7h-4zm-8 8h8v8H3v-8zm2 2v4h4v-4H5zm6 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2z"/></svg>
                QR
              </button>
            </div>
            <button
              className="mt-2 text-blue-400 hover:text-blue-300 underline text-base"
              onClick={() => setShowShare(false)}
            >
              Invite later
            </button>
          </DialogContent>
        </Dialog>
      )}

      {/* QR code modal */}
      {showQR && lastCreatedGroup && (
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="bg-black text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-xl font-bold text-center mt-4 mb-2">QR code to invite participants</DialogTitle>
            <DialogDescription>Let other participants scan this QR code to quickly join your group.</DialogDescription>
            <div className="w-full flex flex-col items-center p-4 pt-0">
              <button className="self-start mb-2 text-blue-300 hover:text-blue-400" onClick={() => setShowQR(false)} aria-label="Back">
                <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              </button>
              <QRCode value={`${window.location.origin}/join/${lastCreatedGroup.id}`} size={180} bgColor="#fff" fgColor="#222" />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showArchived && (
        <Dialog open onOpenChange={setShowArchived}>
          <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white flex flex-col items-center p-0">
            <DialogTitle className="text-2xl font-bold text-center mt-4 mb-2">Archived Groups</DialogTitle>
            <DialogDescription className="text-blue-300 text-center mb-4">Groups you have archived. Restore to make them visible again.</DialogDescription>
            <div className="w-full flex flex-col gap-3 px-4 pb-4">
              {archivedGroups.length === 0 ? (
                <div className="text-blue-200 text-center py-8">No archived groups.</div>
              ) : (
                archivedGroups.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-slate-800 rounded-xl p-4 shadow border border-slate-700/40">
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg text-white">{g.name}</span>
                      <span className="text-blue-300 text-sm">{g.participants?.length || 0} members</span>
                    </div>
                    <button className="ml-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition-all text-sm" onClick={async () => {
                      // Remove user.uid from archivedBy
                      const groupRef = doc(db, 'groups', g.id);
                      const newArchivedBy = (g.archivedBy || []).filter(uid => uid !== user.uid);
                      await updateDoc(groupRef, { archivedBy: newArchivedBy });
                      setShowArchived(false);
                      // No alert, just close modal and return to group list
                    }}>Restore</button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 w-full px-4 mb-4 mt-2">
              <button className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow" onClick={() => setShowArchived(false)}>Close</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
