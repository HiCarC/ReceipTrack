import React, { useEffect, useState } from "react";
import { ChevronRight, Plus, Settings, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { db } from "@/firebase";
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
import { useAuth } from "@/contexts/AuthContext";
import QRCode from "react-qr-code";

export default function GroupHomeScreen({ onGroupEnter }) {
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [participants, setParticipants] = useState(() =>
    user ? [user.displayName] : []
  );
  const [creating, setCreating] = useState(false);
  const [participantsInput, setParticipantsInput] = useState("");

  const [pendingClaim, setPendingClaim] = useState(null);
  const [claimError, setClaimError] = useState("");

  const [showShare, setShowShare] = useState(false);
  const [lastCreatedGroup, setLastCreatedGroup] = useState(null);

  const [showQR, setShowQR] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const createdQ = query(
      collection(db, "groups"),
      where("createdBy", "==", user.uid)
    );
    const memberQ = query(
      collection(db, "groups"),
      where("memberUids", "array-contains", user.uid)
    );

    const unsubCreated = onSnapshot(createdQ, (snapCreated) => {
      const mine = snapCreated.docs.map((d) => ({ id: d.id, ...d.data() }));
      const unsubMember = onSnapshot(memberQ, (snapMember) => {
        const joined = snapMember.docs.map((d) => ({ id: d.id, ...d.data() }));
        const merged = [
          ...mine,
          ...joined.filter((j) => !mine.find((m) => m.id === j.id)),
        ];
        setGroups(merged);
        setLoading(false);
      });
      return () => unsubMember();
    });

    return () => unsubCreated();
  }, [user]);

  useEffect(() => {
    try {
      let pf = window.__GROUP_PREFILL__;
      if ((!pf || !pf.groupId) && typeof sessionStorage !== "undefined") {
        const any = groups.find((g) => sessionStorage.getItem(`group_prefill_${g.id}`));
        if (any) {
          try {
            pf = JSON.parse(sessionStorage.getItem(`group_prefill_${any.id}`));
          } catch {}
        }
      }
      if (!pf || !pf.groupId) return;
      const match = groups.find((g) => g.id === pf.groupId);
      if (match) {
        onGroupEnter?.(match);
      }
    } catch {}
  }, [groups, onGroupEnter]);

  const emptyState = (
    <p className="text-center text-app-muted text-base mt-16">
      No groups yet. Tap the button below to create your first one.
    </p>
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!user || creating) return;

    const participantNames = participants.filter(Boolean);
    if (!participantNames.includes(user.displayName)) {
      participantNames.unshift(user.displayName);
    }

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
      setError("Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  const handleEnterGroup = (group) => {
    if (!user) return;
    const already = Object.values(group.claimedBy || {}).includes(user.uid);
    if (already) {
      onGroupEnter?.(group);
      return;
    }
    const unclaimed = (group.participants || []).find(
      (p) => !(group.claimedBy || {})[p]
    );
    if (!unclaimed) return;
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
      onGroupEnter?.({
        ...group,
        claimedBy: { ...group.claimedBy, [name]: user.uid },
      });
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
    setParticipants(participants.filter((p) => p !== name));
  };

  const getTimeAgo = (timestamp) => {
    const date = timestamp?.toDate?.() || (timestamp ? new Date(timestamp) : null);
    if (!date || Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getGroupStatus = (group) => {
    if (typeof group.balance === "number") {
      if (group.balance > 0) {
        return { label: "You are owed", className: "text-emerald-400" };
      }
      if (group.balance < 0) {
        return { label: "You owe", className: "text-rose-400" };
      }
    }
    return { label: "Settled up", className: "text-slate-400" };
  };

  const getGroupAvatar = (group) => {
    const fallback = (group.name || "G").trim().slice(0, 1).toUpperCase();
    return group.emoji || fallback;
  };

  const visibleGroups = groups.filter(
    (g) => !(g.archivedBy || []).includes(user?.uid)
  );
  const archivedGroups = groups.filter((g) =>
    (g.archivedBy || []).includes(user?.uid)
  );

  return (
    <div className="min-h-screen bg-app-bg text-app-fg pb-28">
      <header className="sticky top-0 z-30 border-b border-[#1c1f27] bg-app-bg/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">My Groups</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-app-surface text-slate-200"
              aria-label="Create group"
            >
              <UserPlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-app-surface text-slate-200"
              aria-label="Group settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 pb-32">
        {loading ? (
          <p className="text-center text-app-muted text-lg mt-12">Loading...</p>
        ) : error ? (
          <p className="text-center text-red-400 text-lg mt-12">{error}</p>
        ) : visibleGroups.length === 0 ? (
          emptyState
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleGroups.map((group) => {
              const status = getGroupStatus(group);
              const timeAgo = getTimeAgo(group.createdAt);
              return (
                <li key={group.id}>
                  <button
                    onClick={() => handleEnterGroup(group)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-transparent bg-[#1c1f27] p-4 text-left shadow-sm transition hover:border-[#2a3241]"
                  >
                    <div className="relative h-14 w-14 rounded-full bg-[#2a3241] text-xl font-semibold flex items-center justify-center">
                      {getGroupAvatar(group)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="truncate text-base font-bold text-white text-keep-white">
                          {group.name}
                        </h3>
                        {timeAgo && (
                          <span className="text-xs text-keep-white opacity-70">{timeAgo}</span>
                        )}
                      </div>
                      <p className={`text-sm ${status.className}`}>{status.label}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-app-primary" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <button
        aria-label="New group"
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full bg-app-primary px-5 py-3 text-base font-semibold text-white shadow-xl shadow-blue-900/40 active:scale-95"
      >
        <Plus className="h-5 w-5" />
        New Group
      </button>

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
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-blue-200">Currency</span>
              <select
                className="rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {[
                  { code: "EUR", name: "Euro" },
                  { code: "USD", name: "US Dollar" },
                  { code: "GBP", name: "British Pound" },
                  { code: "JPY", name: "Japanese Yen" },
                ].map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-blue-200">Participants</span>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={participantsInput || ""}
                  onChange={(e) => setParticipantsInput(e.target.value)}
                  placeholder="Add a participant name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddParticipant();
                    }
                  }}
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
                {participants.map((p) => (
                  <li key={p} className="bg-slate-800 px-3 py-1 rounded-lg flex items-center gap-2">
                    <span>{p === user.displayName ? `${p} (me)` : p}</span>
                    {p !== user.displayName && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-600 text-xs font-bold"
                        onClick={() => handleRemoveParticipant(p)}
                        aria-label={`Remove ${p}`}
                      >
                        x
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
                {creating ? "Creating..." : "Create"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {pendingClaim && (
        <Dialog open onOpenChange={() => setPendingClaim(null)}>
          <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white">
            <DialogTitle>
              <VisuallyHidden>Claim group participant name</VisuallyHidden>
            </DialogTitle>
            <DialogDescription>
              <VisuallyHidden>Confirm group participant identity</VisuallyHidden>
            </DialogDescription>
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

      {showShare && lastCreatedGroup && (
        <Dialog open={showShare} onOpenChange={setShowShare}>
          <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white flex flex-col items-center">
            <DialogTitle className="text-2xl font-bold text-center">Group Created!</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">
              Share your group with friends so they can join.
            </DialogDescription>
            <div className="w-full mb-2">
              <div className="uppercase text-xs font-semibold text-blue-200 mb-1 tracking-wide">
                Participants to invite
              </div>
              <div className="bg-slate-800 rounded-lg p-2 flex flex-col gap-1">
                {(lastCreatedGroup.participants || [])
                  .filter((p) => p !== user.displayName)
                  .map((p) => (
                    <div key={p} className="text-white px-2 py-1 rounded text-base bg-slate-900/60">
                      {p}
                    </div>
                  ))}
                {((lastCreatedGroup.participants || []).filter((p) => p !== user.displayName)
                  .length === 0) && (
                  <div className="text-blue-300 px-2 py-1 text-sm">
                    No other participants to invite.
                  </div>
                )}
              </div>
            </div>
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
                WhatsApp
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl text-lg"
                onClick={async () => {
                  const url = `${window.location.origin}/join/${lastCreatedGroup.id}`;
                  const text = `Join my group "${lastCreatedGroup.name}" on ExpenseApp: ${url}`;
                  if (navigator.share) {
                    await navigator.share({ title: "Join my group", text, url });
                  } else {
                    await navigator.clipboard.writeText(url);
                    alert("Group link copied to clipboard!");
                  }
                }}
              >
                Share
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl shadow-xl text-lg"
                onClick={() => setShowQR(true)}
              >
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

      {showQR && lastCreatedGroup && (
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="bg-black text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-xl font-bold text-center mt-4 mb-2">
              QR code to invite participants
            </DialogTitle>
            <DialogDescription>
              Let other participants scan this QR code to quickly join your group.
            </DialogDescription>
            <div className="w-full flex flex-col items-center p-4 pt-0">
              <button
                className="self-start mb-2 text-blue-300 hover:text-blue-400"
                onClick={() => setShowQR(false)}
                aria-label="Back"
              >
                Back
              </button>
              <QRCode
                value={`${window.location.origin}/join/${lastCreatedGroup.id}`}
                size={180}
                bgColor="#fff"
                fgColor="#222"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showArchived && (
        <Dialog open onOpenChange={setShowArchived}>
          <DialogContent className="bg-slate-900 border-none rounded-2xl shadow-2xl w-[95vw] max-w-md text-white flex flex-col items-center p-0">
            <DialogTitle className="text-2xl font-bold text-center mt-4 mb-2">
              Archived Groups
            </DialogTitle>
            <DialogDescription className="text-blue-300 text-center mb-4">
              Groups you have archived. Restore to make them visible again.
            </DialogDescription>
            <div className="w-full flex flex-col gap-3 px-4 pb-4">
              {archivedGroups.length === 0 ? (
                <div className="text-blue-200 text-center py-8">No archived groups.</div>
              ) : (
                archivedGroups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between bg-slate-800 rounded-xl p-4 shadow border border-slate-700/40"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg text-white">{g.name}</span>
                      <span className="text-blue-300 text-sm">
                        {g.participants?.length || 0} members
                      </span>
                    </div>
                    <button
                      className="ml-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition-all text-sm"
                      onClick={async () => {
                        const groupRef = doc(db, "groups", g.id);
                        const newArchivedBy = (g.archivedBy || []).filter(
                          (uid) => uid !== user.uid
                        );
                        await updateDoc(groupRef, { archivedBy: newArchivedBy });
                        setShowArchived(false);
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 w-full px-4 mb-4 mt-2">
              <button
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow"
                onClick={() => setShowArchived(false)}
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
