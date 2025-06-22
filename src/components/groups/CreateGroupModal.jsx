import React, { useState } from "react";
import { createGroup } from "../../firebase/groups";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { getAuth, sendSignInLinkToEmail, fetchSignInMethodsForEmail } from "firebase/auth";
import { useToast } from "../ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const EMOJI_OPTIONS = [
  "👥", "🦄", "🎉", "💼", "🍕", "🏖️", "🚗", "🏠", "🛒", "🎓", "💡", "🧳", "🧑‍💻", "🧑‍🎤", "🧑‍🚀"
];

// Check if user exists in Firebase Auth
async function checkUserExistsByEmail(email) {
  const auth = getAuth();
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch (e) {
    // If email enumeration protection is enabled, always return false (always send invite)
    return false;
  }
}

// Send Firebase Auth email link invite with correct production domain
async function sendInviteEmailWithFirebase(email, groupName, inviterName) {
  const auth = getAuth();
  const actionCodeSettings = {
    url: `https://receip-track.vercel.app/register?groupInvite=1&groupName=${encodeURIComponent(groupName)}`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
}

export default function CreateGroupModal({ onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [emails, setEmails] = useState(user ? [user.email] : []);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleAddEmail = async () => {
    if (!newEmail || emails.includes(newEmail)) return;
    const exists = await checkUserExistsByEmail(newEmail);
    if (exists) {
      setEmails([...emails, newEmail]);
      setNewEmail("");
    } else {
      await sendInviteEmailWithFirebase(
        newEmail,
        name || "a group",
        user.displayName || user.email
      );
      toast({
        title: "🎉 Invite Sent!",
        description: (
          <span>
            <b>{newEmail}</b> will receive a magic link to join <b>{name || "a group"}</b>.<br />
            <span className="text-blue-400">You're building your crew! 🚀</span>
          </span>
        ),
        variant: "success",
        duration: 6000,
        style: {
          background: "linear-gradient(90deg, #38ef7d 0%, #11998e 100%)",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "1.1rem",
          boxShadow: "0 4px 24px 0 rgba(56,239,125,0.15)"
        }
      });
      setNewEmail("");
    }
  };

  const handleRemoveEmail = (email) => {
    setEmails(emails.filter(e => e !== email));
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createGroup({
        name,
        emoji,
        createdBy: user.uid,
        members: emails,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create group.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 via-indigo-900 to-blue-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-auto border border-blue-200/20 relative animate-fade-in max-h-[90vh] overflow-y-auto flex flex-col">
        <button
          className="absolute top-3 right-4 text-slate-400 hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Close"
        >&times;</button>
        <h2 className="text-2xl font-extrabold text-blue-100 mb-6 text-center">Create Group</h2>
        <div className="mb-4">
          <label className="block mb-1 font-semibold text-blue-200">Group Name</label>
          <input
            className="w-full rounded-lg bg-slate-900/80 text-white px-4 py-2 border border-blue-700 focus:ring-2 focus:ring-blue-400 outline-none transition"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter group name"
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-semibold text-blue-200">Emoji/Icon</label>
          <input
            className="w-full rounded-lg bg-slate-900/80 text-white px-4 py-2 border border-blue-700 focus:ring-2 focus:ring-blue-400 outline-none transition cursor-pointer"
            value={emoji}
            readOnly
            onClick={() => setShowEmojiPicker(v => !v)}
            placeholder="e.g. 👥"
            style={{ background: "#1e293b" }}
          />
          {showEmojiPicker && (
            <div className="mt-2 bg-slate-800 border border-blue-700 rounded-xl shadow-lg p-3 grid grid-cols-5 gap-2 z-50">
              {EMOJI_OPTIONS.map(opt => (
                <button
                  key={opt}
                  className="text-2xl hover:scale-125 transition"
                  onClick={() => {
                    setEmoji(opt);
                    setShowEmojiPicker(false);
                  }}
                  type="button"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-semibold text-blue-200">Members</label>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 rounded-lg bg-slate-900/80 text-white px-4 py-2 border border-blue-700 focus:ring-2 focus:ring-blue-400 outline-none transition"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Add member email"
              onKeyDown={e => e.key === "Enter" && handleAddEmail()}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow transition"
              onClick={handleAddEmail}
            >Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {emails.map((email) => (
                <motion.div
                  key={email}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.8 }}
                  transition={{ duration: 0.25 }}
                  className="member-chip bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-xs font-semibold"
                >
                  {email}
                  {email !== user.email && (
                    <button
                      className="ml-1 text-red-500"
                      onClick={() => handleRemoveEmail(email)}
                      title="Remove"
                    >×</button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <button
          className={`w-full mt-4 py-3 rounded-lg font-bold text-lg shadow-lg transition ${
            !name ? "bg-slate-600 text-slate-300 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
          }`}
          onClick={handleCreate}
          disabled={!name || loading}
        >
          {loading ? "Creating..." : "Create Group"}
        </button>
      </div>
    </div>
  );
} 