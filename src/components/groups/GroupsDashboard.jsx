import React, { useEffect, useState } from "react";
import { db } from "../../firebase"; // adjust if your firebase.js is elsewhere
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import MobileNavBar from "../MobileNavBar";
import AuthHeader from "../AuthHeader";
import CreateGroupModal from "./CreateGroupModal";
import { useNavigate } from "react-router-dom";

export default function GroupsDashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    // Listen for groups where the user is a member
    const q = query(
      collection(db, "groups"),
      where("members", "array-contains", user.email)
    );
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((doc) => doc.data()));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <AuthHeader />

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-4">
        <div className="w-full max-w-md mx-auto bg-slate-800/90 rounded-2xl shadow-2xl p-6 flex flex-col gap-6 border border-blue-200/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-blue-100">Your Groups</h2>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-700 text-white px-4 py-2 rounded-lg shadow">
              + New Group
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="text-slate-300 text-center">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="text-slate-400 text-center py-8">You're not in any groups yet.</div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="bg-slate-900 rounded-xl p-4 flex items-center gap-4 shadow cursor-pointer hover:bg-slate-700 transition"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <span className="text-3xl">{group.emoji || "👥"}</span>
                  <div>
                    <div className="font-semibold text-lg text-blue-100">{group.name}</div>
                    <div className="text-xs text-slate-400">{group.members.length} members</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <MobileNavBar />

      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
} 