import React, { useState } from 'react';
import { Plus, Users, Link2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';

const CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

export default function GroupHomeScreen({ onTabChange }) {
  const [showAction, setShowAction] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [participants, setParticipants] = useState(['']);
  const [inviteLink, setInviteLink] = useState('https://yourapp.com/invite/abc123');
  const [qrUrl, setQrUrl] = useState('https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://yourapp.com/invite/abc123');
  // Add state for QR modal
  const [showQR, setShowQR] = useState(false);

  // Add participant
  const addParticipant = () => setParticipants([...participants, '']);
  // Remove participant
  const removeParticipant = idx => setParticipants(participants.filter((_, i) => i !== idx));
  // Update participant name
  const updateParticipant = (idx, val) => setParticipants(participants.map((p, i) => i === idx ? val : p));

  // Handle create group
  const handleCreateGroup = e => {
    e.preventDefault();
    setShowCreate(false);
    setShowSuccess(true);
    // TODO: Actually create group and generate real invite link/QR
  };

  return (
    <div className="flex flex-col min-h-screen bg-black/90 relative pb-32">
      <div className="text-3xl font-bold text-white text-center pt-8 pb-4 tracking-tight">Groups</div>
      <div className="flex-1 flex flex-col gap-2 px-4">
        <div className="text-center text-blue-200/70 mt-12 text-lg">No groups yet. Tap + to create or join a group.</div>
      </div>
      {/* Centered Plus Button, no bounce */}
      <button
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-20 h-20 flex items-center justify-center shadow-2xl border-4 border-blue-900 transition-all duration-300 ease-in-out active:scale-95"
        onClick={() => setShowAction(v => !v)}
        aria-label="Add group"
        style={{ fontSize: 36 }}
      >
        <Plus className="h-12 w-12" />
      </button>
      {/* Action Sheet */}
      {showAction && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm bg-slate-900/95 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-fade-in-up border border-blue-400/20">
          <button
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-800/80 hover:bg-blue-700 text-white font-semibold text-lg transition-all duration-150"
            onClick={() => { setShowAction(false); setShowCreate(true); }}
          >
            <Plus className="h-6 w-6" />
            Start a new group
          </button>
          <button
            className="flex items-center gap-3 p-4 rounded-xl bg-green-700/80 hover:bg-green-600 text-white font-semibold text-lg transition-all duration-150"
            onClick={() => { setShowAction(false); /* TODO: trigger join group flow */ }}
          >
            <Link2 className="h-6 w-6" />
            Join an existing group
          </button>
        </div>
      )}
      {/* Create Group Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-2">Create a Group</DialogTitle>
            <DialogDescription className="text-blue-200/80 mb-4">Set a name, currency, and add participants.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
            <div>
              <label className="block text-blue-200 mb-1">Group Name</label>
              <input
                className="w-full rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-3 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none"
                placeholder="e.g. Urban Trip"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-blue-200 mb-1">Currency</label>
              <select
                className="w-full rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-blue-200 mb-1">Participants</label>
              <div className="flex flex-col gap-2">
                {participants.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-3 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none"
                      placeholder={idx === 0 ? 'Your name' : 'Add participant'}
                      value={p}
                      onChange={e => updateParticipant(idx, e.target.value)}
                      required={idx === 0}
                    />
                    {participants.length > 1 && (
                      <button type="button" onClick={() => removeParticipant(idx)} className="text-red-400 hover:text-red-600"><X className="h-5 w-5" /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addParticipant} className="text-blue-400 hover:text-blue-300 text-sm mt-1">+ Add participant</button>
              </div>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out"
              >
                Create Group
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Success Modal */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw]">
          <DialogHeader>
            <div className="flex flex-col items-center justify-center mb-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <DialogTitle className="text-2xl font-bold mb-2 text-center">Your group is ready!</DialogTitle>
            <DialogDescription className="text-blue-200/80 mb-4 text-center">Invite participants by sending them a message with the invite link or showing a QR code.</DialogDescription>
          </DialogHeader>
          <div className="mb-4">
            <div className="text-blue-100 font-semibold mb-2">Invitees</div>
            <ul className="bg-slate-800 rounded-lg p-3 mb-4">
              {participants.filter(Boolean).map((p, i) => (
                <li key={i} className="text-white/90 py-1">{p}</li>
              ))}
            </ul>
            <div className="flex flex-row gap-4 mb-4 justify-center">
              <button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-lg font-semibold shadow-md"
                aria-label="Share via WhatsApp"
                title="Share via WhatsApp"
                onClick={() => {
                  const text = `Join my group: ${inviteLink}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#25D366"/><path d="M16 6C10.477 6 6 10.477 6 16c0 2.021.606 3.898 1.65 5.47L6 26l4.66-1.62A9.94 9.94 0 0016 26c5.523 0 10-4.477 10-10S21.523 6 16 6zm0 18c-1.7 0-3.29-.5-4.63-1.36l-.33-.21-2.76.96.94-2.7-.22-.34A7.96 7.96 0 018 16c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8zm4.07-5.25c-.22-.11-1.3-.64-1.5-.71-.2-.07-.34-.11-.48.11-.14.22-.55.71-.67.85-.12.14-.25.16-.47.05-.22-.11-.93-.34-1.77-1.09-.66-.59-1.1-1.32-1.23-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.14-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.54-1.29-.74-1.77-.2-.48-.4-.41-.55-.42-.14-.01-.31-.01-.48-.01-.17 0-.45.06-.68.31-.23.25-.87.81-.87 1.98 0 1.17.85 2.3.97 2.46.12.16 1.67 2.55 4.04 3.48.57.2 1.01.32 1.36.41.57.13 1.09.12 1.5.07.46-.07 1.41-.56 1.61-1.1.2-.54.2-1 .14-1.1-.06-.1-.22-.16-.46-.28z" fill="#fff"/></svg>
                <span className="text-base mt-1">WhatsApp</span>
              </button>
              <button
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-lg font-semibold shadow-md"
                aria-label="Share link"
                title="Share link"
                onClick={async () => {
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: 'Join my group', text: 'Join my group:', url: inviteLink });
                    } catch (e) {}
                  } else {
                    await navigator.clipboard.writeText(inviteLink);
                    alert('Link copied to clipboard!');
                  }
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#2563eb"/><path d="M22 10v2a6 6 0 01-6 6H8m0 0l3-3m-3 3l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-base mt-1">Share</span>
              </button>
              <button
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-lg font-semibold shadow-md"
                aria-label="Show QR code"
                title="Show QR code"
                onClick={() => setShowQR(true)}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#334155"/><rect x="8" y="8" width="6" height="6" rx="1" fill="#fff"/><rect x="18" y="8" width="6" height="6" rx="1" fill="#fff"/><rect x="8" y="18" width="6" height="6" rx="1" fill="#fff"/><rect x="18" y="18" width="2" height="2" rx="1" fill="#fff"/></svg>
                <span className="text-base mt-1">QR</span>
              </button>
            </div>
            <div className="flex justify-center mt-2">
              <button className="text-blue-400 hover:text-blue-300 text-base underline" onClick={() => setShowSuccess(false)}>Invite later</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* QR Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-xs w-[90vw] flex flex-col items-center justify-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold mb-2 text-center">Scan to Join</DialogTitle>
            <DialogDescription className="text-blue-200/80 mb-2 text-center">Scan this QR code to join the group.</DialogDescription>
          </DialogHeader>
          <img src={qrUrl} alt="QR Code" className="rounded-lg bg-white p-2 mb-4" />
          <div className="text-blue-200 text-center text-sm break-all">{inviteLink}</div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out mt-4">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 