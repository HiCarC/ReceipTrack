import React, { useEffect, useState } from "react";
import { Plus, Users, Link2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
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

  // Claim‑name modal
  const [pendingClaim, setPendingClaim] = useState(null);
  const [claimError, setClaimError] = useState("");

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
      await addDoc(collection(db, "groups"), groupData);
      setShowCreate(false);
      setGroupName("");
      setParticipants([user.displayName]);
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

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex flex-col h-screen bg-black/90 text-white">
      {/* Title always visible */}
      <header className="shrink-0 py-4 text-center text-2xl font-bold tracking-tight border-b border-slate-800 backdrop-blur">
        Groups
      </header>

      {/* Scrollable list – account for bottom nav & FAB */}
      <main
        className="flex-1 overflow-y-auto px-4"
        style={{ paddingBottom: `${NAV_HEIGHT + FAB_SIZE / 2 + 24}px` }}
      >
        {loading ? (
          <p className="text-center text-blue-200/70 text-lg mt-16">Loading…</p>
        ) : groups.length === 0 ? (
          emptyState
        ) : (
          <ul className="flex flex-col gap-4 mt-4 pb-2">
            {groups.map(g => (
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
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription className="text-blue-300">
              Name your group and choose a currency.
            </DialogDescription>
          </DialogHeader>

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
            <DialogHeader>
              <DialogTitle>Join as {pendingClaim.name}?</DialogTitle>
              {claimError && <p className="text-red-400">{claimError}</p>}
            </DialogHeader>
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
    </div>
  );
}
