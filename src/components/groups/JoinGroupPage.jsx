import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";

export default function JoinGroupPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [joined, setJoined] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!groupId) return;
    getDoc(doc(db, "groups", groupId)).then((snap) => {
      if (snap.exists()) setGroup(snap.data());
    });
  }, [groupId]);

  const handleJoin = async () => {
    if (!user) return;
    const groupRef = doc(db, "groups", groupId);
    const snap = await getDoc(groupRef);
    if (snap.exists()) {
      const group = snap.data();
      if (!group.members.some(m => (m.email || m) === user.email)) {
        await updateDoc(groupRef, {
          members: [...group.members, { email: user.email, role: "member" }]
        });
      }
      setJoined(true);
      setTimeout(() => navigate(`/groups/${groupId}`), 1500);
    }
  };

  if (!group) return <div className="p-8 text-center">Loading group...</div>;
  if (joined) return <div className="p-8 text-center text-green-600">Joined! Redirecting...</div>;

  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">{group.emoji || "👥"} {group.name}</h2>
      <p className="mb-4">Join this group to share and track expenses together.</p>
      {user ? (
        <Button onClick={handleJoin}>Join Group</Button>
      ) : (
        <div>Please sign in to join this group.</div>
      )}
    </div>
  );
} 