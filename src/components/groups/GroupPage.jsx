import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from "firebase/firestore";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { QRCodeCanvas } from "qrcode.react";
import { saveAs } from "file-saver";
import MobileNavBar from "../MobileNavBar";
import AuthHeader from "../AuthHeader";
import ReceiptUploader from "../ReceiptUploader";
import { Dialog, DialogContent } from "../ui/dialog";

function getInitials(email) {
  return email[0].toUpperCase();
}

function getGroupColor(id) {
  const colors = ["#6366f1", "#f59e42", "#10b981", "#f43f5e", "#fbbf24"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return colors[hash % colors.length];
}

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMember, setFilterMember] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    const groupRef = doc(db, "groups", groupId);
    getDoc(groupRef).then((snap) => {
      if (snap.exists()) setGroup(snap.data());
    });

    const q = query(
      collection(db, "receipts"),
      where("groupId", "==", groupId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [groupId]);

  if (!group) return <div className="p-8 text-center">Loading group...</div>;

  const isAdmin = group.members.find(m => (m.email || m) === user.email)?.role === "admin";
  const inviteUrl = `${window.location.origin}/groups/join/${group.id}`;

  async function handleRemoveMember(email) {
    if (!window.confirm(`Remove ${email} from the group?`)) return;
    const groupRef = doc(db, "groups", groupId);
    const snap = await getDoc(groupRef);
    if (snap.exists()) {
      const groupData = snap.data();
      const updatedMembers = groupData.members.filter(m => (m.email || m) !== email);
      await updateDoc(groupRef, { members: updatedMembers });
    }
  }

  const filteredReceipts = receipts.filter(r =>
    (filterMember === "all" || r.uploadedBy === filterMember) &&
    (filterCategory === "all" || r.category === filterCategory)
  );

  // Calculate stats
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const receiptsThisMonth = receipts.filter(r => {
    const d = new Date(r.date || (r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt));
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const totalThisMonth = receiptsThisMonth.reduce((sum, r) => sum + (parseFloat(r.amount || r.total) || 0), 0);

  const categoryTotals = {};
  receipts.forEach(r => {
    if (r.category) {
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + (parseFloat(r.amount || r.total) || 0);
    }
  });
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const memberCounts = {};
  receipts.forEach(r => {
    if (r.uploadedBy) {
      memberCounts[r.uploadedBy] = (memberCounts[r.uploadedBy] || 0) + 1;
    }
  });
  const mostActiveMember = Object.entries(memberCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  // Export CSV
  function exportGroupReceiptsAsCSV(receipts, group) {
    if (!receipts.length) return;
    const headers = [
      "Merchant",
      "Amount",
      "Date",
      "Category",
      "Uploaded By"
    ];
    const rows = receipts.map(r => [
      r.merchant || "",
      r.amount || r.total || "",
      new Date(r.date || (r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt)).toLocaleDateString(),
      r.category || "",
      r.uploadedBy || ""
    ]);
    const csvContent =
      [headers, ...rows]
        .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${group.name || "group"}-receipts.csv`);
  }

  // Settle Up Calculation
  const balances = {};
  if (group && group.members) {
    group.members.forEach(m => {
      const email = m.email || m;
      balances[email] = 0;
    });
    receipts.forEach(r => {
      if (!r.paidBy || !r.splitWith || !Array.isArray(r.splitWith) || r.splitWith.length === 0) return;
      const amount = parseFloat(r.amount || r.total) || 0;
      const share = amount / r.splitWith.length;
      r.splitWith.forEach(member => {
        if (member !== r.paidBy) {
          balances[member] -= share;
          balances[r.paidBy] += share;
        }
      });
    });
  }

  const settleUp = [];
  const emails = Object.keys(balances);
  const threshold = 0.01;
  emails.forEach(from => {
    emails.forEach(to => {
      if (from !== to && balances[from] < -threshold && balances[to] > threshold) {
        const amount = Math.min(-balances[from], balances[to]);
        if (amount > threshold) {
          settleUp.push({ from, to, amount: amount.toFixed(2) });
          balances[from] += amount;
          balances[to] -= amount;
        }
      }
    });
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-indigo-900 to-blue-900">
      {/* Header always at the top */}
      <AuthHeader />

      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute left-4 top-4 bg-slate-700 text-white px-3 py-1 rounded-lg shadow hover:bg-slate-600 transition z-50"
        style={{ zIndex: 100 }}
      >
        ← Back
      </button>

      {/* Main content area, scrollable and never overlaps nav/header */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-4 overflow-y-auto">
        <div className="w-full max-w-md mx-auto bg-slate-800/90 rounded-2xl shadow-2xl p-6 flex flex-col gap-6 border border-blue-200/20">
          {/* Group Header */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">{group.emoji || "👥"}</span>
            <h2 className="text-xl font-bold text-blue-100">{group.name}</h2>
            <div className="flex gap-2 flex-wrap justify-center">
              {group.members.map((m, i) => (
                <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                  {m.email || m}
                </span>
              ))}
            </div>
          </div>

          {/* Invite */}
          <div className="flex flex-col items-center gap-2">
            <QRCodeCanvas value={`${window.location.origin}/groups/join/${group.id}`} size={80} />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/groups/join/${group.id}`);
                alert("Invite link copied!");
              }}
              className="mt-2"
            >
              Copy Invite Link
            </Button>
            <div className="text-xs break-all text-center text-slate-400">
              {`${window.location.origin}/groups/join/${group.id}`}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => setShowUploadModal(true)}>
              + Upload to Group
            </Button>
            <Button
              className="w-full"
              onClick={() => exportGroupReceiptsAsCSV(receipts, group)}
            >
              Export Receipts as CSV
            </Button>
          </div>

          {/* Stats */}
          <div className="bg-slate-900/80 rounded-xl p-4 flex flex-col gap-1 text-slate-100">
            <div>
              <span className="font-bold">Total this month:</span>{" "}
              <span className="text-blue-300">{totalThisMonth.toFixed(2)} €</span>
            </div>
            <div>
              <span className="font-bold">Top category:</span>{" "}
              <span className="text-green-300">{topCategory}</span>
            </div>
            <div>
              <span className="font-bold">Most active member:</span>{" "}
              <span className="text-yellow-300">{mostActiveMember}</span>
            </div>
          </div>

          {/* Settle Up */}
          <div className="bg-slate-900/80 rounded-xl p-4">
            <div className="font-semibold mb-2">Settle Up</div>
            {settleUp.length === 0 ? (
              <div className="text-slate-400">All settled up! 🎉</div>
            ) : (
              <ul className="text-slate-100">
                {settleUp.map((s, i) => (
                  <li key={i}>
                    <span className="font-bold">{s.from}</span> owes{" "}
                    <span className="font-bold">{s.to}</span>{" "}
                    <span className="text-blue-300">{s.amount} €</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Receipts Feed */}
          <div>
            <div className="font-semibold mb-2 text-slate-200">Receipts</div>
            {loading ? (
              <div>Loading receipts...</div>
            ) : receipts.length === 0 ? (
              <div className="text-slate-400">No receipts yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {receipts.map((r) => (
                  <div key={r.id} className="bg-slate-700 rounded-lg p-3 flex flex-col gap-1 shadow">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{r.merchant || "Receipt"}</span>
                      <span className="text-xs text-slate-300">
                        {new Date(
                          r.date ||
                            (r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt)
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">
                        Uploaded by: <span className="font-bold">{r.uploadedBy}</span>
                      </span>
                      <span className="font-bold text-blue-300">
                        {r.amount || r.total} €
                      </span>
                    </div>
                    {r.paidBy && r.splitWith && (
                      <div className="text-xs text-slate-400 mt-1">
                        Paid by <span className="font-bold">{r.paidBy}</span>
                        {" · "}
                        Split with: {r.splitWith.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Receipt Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg w-full bg-gradient-to-br from-slate-800 via-indigo-900 to-blue-900 rounded-2xl shadow-2xl border border-blue-200/20">
          <ReceiptUploader
            groupId={groupId}
            onTabChange={() => setShowUploadModal(false)}
            defaultStep="upload_options"
            uploadOnly
          />
        </DialogContent>
      </Dialog>

      {/* Nav bar always at the bottom */}
      <MobileNavBar />
    </div>
  );
} 