import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, MoreVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from './ui/dialog';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, orderBy, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import useGroupBalances from '../hooks/useGroupBalances';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import QRCode from 'react-qr-code';

const EXPENSE_CATEGORIES = [
  { name: 'Groceries', emoji: '🛒' },
  { name: 'Dining', emoji: '🍽️' },
  { name: 'Transportation', emoji: '🚌' },
  { name: 'Shopping', emoji: '🛍️' },
  { name: 'Bills', emoji: '💡' },
  { name: 'Entertainment', emoji: '🎬' },
  { name: 'Health', emoji: '💊' },
  { name: 'Other', emoji: '💸' },
];

const TABS = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'photos', label: 'Photos' },
];

// Helper to map UID to name
function getMemberName(uid, group) {
  const idx = (group.members || []).indexOf(uid);
  return idx >= 0 ? (group.memberNames ? group.memberNames[idx] : uid) : uid;
}

// Helper to get the current user's claimed participant name
function getMyParticipantName(group, user) {
  if (!group || !user || !group.claimedBy) return null;
  return Object.keys(group.claimedBy).find(name => group.claimedBy[name] === user.uid) || null;
}
// Helper to get name from UID
function getNameByUid(group, uid) {
  if (!group || !group.claimedBy) return uid;
  const entry = Object.entries(group.claimedBy).find(([name, id]) => id === uid);
  return entry ? entry[0] : uid;
}

function getInitials(name) {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

// Expense Detail View Component
function ExpenseDetailView({ expense, group, onEdit, onDelete, onClose }) {
  if (!expense) return null;
  const paidByName = getNameByUid(group, expense.paidBy);
  const currency = expense.currency || group.currency || 'EUR';
  // Calculate participant shares
  let participants = [];
  if (expense.splits) {
    participants = Object.entries(expense.splits).map(([uid, amount]) => ({
      name: getNameByUid(group, uid),
      isMe: group.claimedBy && group.claimedBy[getNameByUid(group, uid)] === expense.paidBy,
      amount,
    }));
  }
  return (
    <div className="flex flex-col h-full bg-black/90 rounded-2xl relative">
      {/* Accessibility: DialogTitle and DialogDescription for world-class UX/UI */}
      <div className="flex items-center justify-between pt-6 pb-2 px-4">
        <DialogTitle asChild>
          <span className="text-2xl md:text-3xl font-bold text-white">{expense.label}</span>
        </DialogTitle>
        {/* Three-dots icon: always visible, opens edit window directly */}
        <button
          className="p-2 rounded-full hover:bg-slate-800 focus:outline-none ml-2"
          onClick={onEdit}
          aria-label="Edit expense"
        >
          <MoreVertical className="h-6 w-6 text-white" />
        </button>
      </div>
      <DialogDescription asChild>
        <div className="flex justify-start text-blue-200 text-base px-4 mb-2">{expense.date}</div>
      </DialogDescription>
      {/* Paid by section */}
      <div className="px-4 mt-4">
        <div className="uppercase text-xs font-semibold text-blue-200 mb-2 tracking-wide">PAID BY</div>
        <div className="flex items-center bg-[#23232a] rounded-2xl p-4 mb-6 shadow border border-slate-700/40">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl font-bold text-white mr-4">
            {getInitials(paidByName)}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-lg">{paidByName}</div>
            <div className="text-blue-300 text-xs">{expense.paidBy === group.claimedBy[paidByName] ? 'Me' : ''}</div>
          </div>
          <div className="font-bold text-2xl text-orange-400 ml-2">{expense.amount.toFixed(2)} <span className="text-lg">{currency}</span></div>
        </div>
      </div>
      {/* Participants section */}
      <div className="px-4">
        <div className="uppercase text-xs font-semibold text-blue-200 mb-2 tracking-wide">PARTICIPANTS</div>
        <div className="bg-[#23232a] rounded-2xl p-2 shadow border border-slate-700/40">
          {participants.map((p, idx) => (
            <div key={p.name} className={`flex items-center px-2 py-3 ${idx !== participants.length - 1 ? 'border-b border-slate-700/30' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mr-4 ${p.name === paidByName ? 'bg-slate-700 text-white' : 'bg-slate-600 text-blue-100'}`}>
                {getInitials(p.name)}
              </div>
              <div className="flex-1 text-white text-base font-medium">{p.name}{p.name === paidByName ? <span className="text-blue-300 text-xs ml-1">Me</span> : ''}</div>
              <div className="font-semibold text-lg text-blue-100">{p.amount.toFixed(2)} <span className="text-base">{currency}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <button className="m-4 mt-8 text-blue-400 underline text-base font-semibold" onClick={onClose}>Close</button>
    </div>
  );
}

// Helper to check if a balance is settled
function isSettled(settlements, fromUid, toUid) {
  return settlements.some(s => s.from === fromUid && s.to === toUid && s.settled);
}

// Helper to get unsettled owes (pairs) for the breakdown modal
function getUnsettledOwes(group, balances, settlements, myName, positive) {
  const owes = [];
  const claimedBy = group.claimedBy || {};
  // Find the exact key in balances that matches myName (to avoid skipping others with similar names)
  let myKey = Object.keys(balances).find(
    k => k.trim().toLowerCase() === myName.trim().toLowerCase()
  ) || myName;
  if (positive) {
    // They owe me
    Object.entries(balances).forEach(([name, bal]) => {
      if (name === myKey) return;
      // If the participant is missing from claimedBy, still show them
      const fromUid = claimedBy[name] || name;
      const toUid = claimedBy[myKey] || myKey;
      if (bal < 0 && (!isSettled(settlements, fromUid, toUid))) {
        owes.push([name, Math.abs(bal)]);
      }
    });
  } else {
    // I owe them
    Object.entries(balances).forEach(([name, bal]) => {
      if (name === myKey) return;
      const fromUid = claimedBy[myKey] || myKey;
      const toUid = claimedBy[name] || name;
      if (bal > 0 && (!isSettled(settlements, fromUid, toUid))) {
        owes.push([name, bal]);
      }
    });
  }
  console.log('claimedBy mapping:', claimedBy);
  console.log('Unsettled owes:', owes);
  return owes;
}

export default function GroupExpensesPage({ group, onBack, initialTab }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // const { groupId } = useParams();
  const groupId = group?.id;
  console.log('GroupExpensesPage groupId:', groupId);
  const myName = getMyParticipantName(group, user);
  // If user hasn't claimed a name, show a message and block actions
  if (!myName) {
    return (
      <div className="min-h-screen bg-black/90 flex flex-col items-center justify-center">
        <div className="text-white text-xl font-bold mb-4">You must claim your name to participate in this group.</div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg" onClick={onBack}>Back</button>
      </div>
    );
  }
  const [tab, setTab] = useState(() => {
    if (initialTab && ['expenses', 'balances', 'photos'].includes(initialTab)) return initialTab;
    return 'expenses';
  });
  const [tabFade, setTabFade] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(myName);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [editExpense, setEditExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Add new state for expense type, tag, photo, currency, split type, and per-member splits
  const EXPENSE_TYPES = [
    { key: 'expense', label: 'Expense' },
    { key: 'income', label: 'Income' },
    { key: 'transfer', label: 'Transfer...' },
  ];
  const SPLIT_TYPES = [
    { key: 'equally', label: 'Equally' },
    { key: 'shares', label: 'By Shares' },
    { key: 'amounts', label: 'By Amounts' },
  ];
  const [expenseType, setExpenseType] = useState('expense');
  const [tag, setTag] = useState('');
  const [photo, setPhoto] = useState(null);
  const [currency, setCurrency] = useState(group.currency || 'EUR');
  const [splitType, setSplitType] = useState('equally');
  const [split, setSplit] = useState(() => {
    const names = group.participants || [];
    return names.reduce((acc, n) => ({ ...acc, [n]: true }), {});
  });
  const [splitAmounts, setSplitAmounts] = useState(() => {
    const names = group.participants || [];
    return names.reduce((acc, n) => ({ ...acc, [n]: '' }), {});
  });
  const [splitShares, setSplitShares] = useState(() => {
    const names = group.participants || [];
    return names.reduce((acc, n) => ({ ...acc, [n]: 1 }), {});
  });

  // Add splitEnabled state for add modal
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [lastSplitType, setLastSplitType] = useState('equally');

  // Load expenses for this group from Firestore
  useEffect(() => {
    if (!group?.id) return;
    if (!group.claimedBy || !Object.values(group.claimedBy).includes(user?.uid)) {
      setError('You must claim your name to view expenses.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    // Use subcollection: groups/{groupId}/expenses
    const expensesCol = collection(db, 'groups', group.id, 'expenses');
    const q = query(
      expensesCol,
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setError(''); // Clear any previous error on successful snapshot
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, err => {
      setError('Failed to load expenses');
      setLoading(false);
    });
    return () => unsub();
  }, [group?.id, group?.claimedBy, user?.uid]);

  // Add expense
  const handleAddExpense = async e => {
    e.preventDefault();
    if (!user) return;
    setError('');
    if (!label.trim()) {
      setError('Title is required');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (!paidBy) {
      setError('Paid By is required');
      return;
    }
    if (!date) {
      setError('Date is required');
      return;
    }
    if (!group.id) {
      setError('Group ID is missing');
      return;
    }
    // Split validation
    const names = (group.participants || []).filter(n => split[n]);
    if (names.length === 0 && splitEnabled) {
      setError('Select at least one participant');
      return;
    }
    let splits = {};
    let shares = {};
    if (splitEnabled) {
      if (splitType === 'equally') {
        const share = parseFloat((parsedAmount / names.length).toFixed(2));
        names.forEach(n => {
          const uid = group.claimedBy[n];
          const key = uid || n;
          splits[key] = share;
          shares[key] = 1;
        });
      } else if (splitType === 'amounts') {
        let total = 0;
        for (const n of names) {
          const val = parseFloat(splitAmounts[n]);
          if (isNaN(val) || val < 0) {
            setError('Enter valid amounts for all selected');
            return;
          }
          total += val;
        }
        if (Math.abs(total - parsedAmount) > 0.01) {
          setError('Split amounts must sum to total');
          return;
        }
        names.forEach(n => {
          const uid = group.claimedBy[n];
          const key = uid || n;
          splits[key] = parseFloat(splitAmounts[n]);
          shares[key] = 1;
        });
      } else if (splitType === 'shares') {
        let totalShares = 0;
        for (const n of names) {
          const val = parseInt(splitShares[n]) || 0;
          if (isNaN(val) || val <= 0) {
            setError('Enter valid shares for all selected');
            return;
          }
          totalShares += val;
        }
        names.forEach(n => {
          const uid = group.claimedBy[n];
          const key = uid || n;
          const sharesCount = parseInt(splitShares[n]) || 0;
          splits[key] = parseFloat(((parsedAmount * sharesCount) / totalShares).toFixed(2));
          shares[key] = sharesCount;
        });
      }
    }
    try {
      // Use subcollection: groups/{groupId}/expenses
      await addDoc(collection(db, 'groups', group.id, 'expenses'), {
        label: label.trim(),
        tag,
        amount: parsedAmount,
        paidBy: group.claimedBy[paidBy],
        date,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expenseType,
        currency,
        splitType,
        splits,
        shares, // Save shares mapping
        photo: photo || '',
        splitEnabled, // Save splitEnabled state
      });
      setShowAdd(false);
      setLabel('');
      setAmount('');
      setPaidBy(myName);
      setDate(new Date().toISOString().slice(0,10));
      setTag('');
      setPhoto(null);
      setSplitType('equally');
      setSplit(() => (group.participants || []).reduce((acc, n) => ({ ...acc, [n]: true }), {}));
      setSplitAmounts(() => (group.participants || []).reduce((acc, n) => ({ ...acc, [n]: '' }), {}));
      setSplitShares(() => (group.participants || []).reduce((acc, n) => ({ ...acc, [n]: 1 }), {}));
    } catch (err) {
      setError('Failed to add expense');
    }
  };

  // Edit expense
  const handleEditExpense = async e => {
    e.preventDefault();
    if (!user || !editExpense) return;
    if (!group?.id) {
      setError('Group ID is missing');
      return;
    }
    setError('');
    try {
      // Use subcollection: groups/{groupId}/expenses
      await updateDoc(doc(db, 'groups', group.id, 'expenses', editExpense.id), {
        label: editExpense.label,
        amount: parseFloat(editExpense.amount),
        paidBy: editExpense.paidBy,
        date: editExpense.date,
      });
      setEditExpense(null);
    } catch (err) {
      setError('Failed to update expense');
    }
  };

  // Delete expense
  const handleDelete = async id => {
    if (!group?.id) {
      setError('Group ID is missing');
      return;
    }
    try {
      // Use subcollection: groups/{groupId}/expenses
      await deleteDoc(doc(db, 'groups', group.id, 'expenses', id));
    } catch (err) {
      setError('Failed to delete expense');
    }
  };

  // Animated tab transitions
  const handleTabChange = (newTab) => {
    if (tab === newTab) return;
    setTabFade(false);
    setTimeout(() => {
      setTab(newTab);
      setTabFade(true);
    }, 180); // match transition duration
  };

  // Update URL and document title/meta when tab changes
  useEffect(() => {
    if (groupId) {
      navigate(`/group/${groupId}/${tab}`); // push to history
    }
    let tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
    document.title = `${group.name} – ${tabLabel} | ReceipTrack`;
    // SEO: set meta description and canonical
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', `${group.name} – ${tabLabel} tab in ReceipTrack group expenses app.`);
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', window.location.href);
  }, [tab, groupId, group.name, navigate]);

  // Add these handlers for edit dialog
  const handleEditSave = async (updated) => {
    if (!group?.id) {
      setError('Group ID is missing');
      return;
    }
    setError('');
    try {
      // Log the data before sending to Firestore
      // Use subcollection: groups/{groupId}/expenses
      // Ensure all required fields are present for update
      const original = editExpense;
      await updateDoc(doc(db, 'groups', group.id, 'expenses', editExpense.id), {
        label: updated.label,
        tag: updated.tag || '',
        amount: updated.amount,
        paidBy: updated.paidBy,
        date: updated.date,
        createdBy: original.createdBy || user.uid,
        createdAt: original.createdAt || serverTimestamp(),
        expenseType: updated.expenseType || original.expenseType || 'expense',
        currency: updated.currency || original.currency || group.currency || 'EUR',
        splitType: updated.splitType || original.splitType || 'equally',
        splits: updated.splits, // Always update splits (for all split types)
        shares: updated.shares, // Always update shares (for all split types)
        photo: updated.photo || '',
        splitEnabled: updated.splitEnabled !== undefined ? updated.splitEnabled : (original.splitEnabled !== undefined ? original.splitEnabled : true),
      });
      setEditExpense(null);
    } catch (err) {
      setError('Failed to update expense');
      console.error('Failed to update expense:', err);
    }
  };

  const handleEditDelete = async () => {
    if (!group?.id) {
      setError('Group ID is missing');
      return;
    }
    try {
      await deleteDoc(doc(db, 'groups', group.id, 'expenses', editExpense.id));
      setEditExpense(null);
    } catch (err) {
      setError('Failed to delete expense');
    }
  };

  const [showBreakdown, setShowBreakdown] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(null); // {name, amount} or null

  // Share handler
  function handleRemind(name, amount) {
    // Find the most recent relevant expense label (if any)
    let recentExpense = null;
    if (Array.isArray(expenses)) {
      recentExpense = expenses
        .filter(exp => {
          // Owed person is in splits, and current user is paidBy
          const paidByName = getNameByUid(group, exp.paidBy);
          return paidByName === getMyParticipantName(group, user) && exp.splits && Object.keys(exp.splits).some(uid => getNameByUid(group, uid) === name);
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    }
    const expenseLabel = recentExpense ? ` for "${recentExpense.label}"` : '';
    const message = `Hi ${name},

You owe me ${amount.toFixed(2)} ${group.currency || '€'} in the group "${group.name}"${expenseLabel}.

Please settle up when you can. Thank you!`;
    if (navigator.share) {
      navigator.share({ title: 'Payment Reminder', text: message });
    } else {
      navigator.clipboard.writeText(message);
      alert('Copied reminder to clipboard!');
    }
  }

  async function handleMarkAsPaid({ name, amount }) {
    if (!group || !user) return;
    if (!group?.id) {
      alert('Group ID is missing. Please try again.');
      return;
    }
    const myName = getMyParticipantName(group, user);
    let fromUid, toUid;
    // If my balance is negative, I am paying (I owe)
    if (myBalance < 0) {
      fromUid = group.claimedBy[myName] || myName;
      toUid = group.claimedBy[name] || name;
    } else {
      // If my balance is positive, I am being paid (they owe me)
      fromUid = group.claimedBy[name] || name;
      toUid = group.claimedBy[myName] || myName;
    }
    if (!fromUid || !toUid) {
      alert('Could not find user ID for settlement.');
      return;
    }
    try {
      const settlementId = `${fromUid}_${toUid}`;
      await setDoc(doc(db, 'groups', group.id, 'settlements', settlementId), {
        from: fromUid,
        to: toUid,
        amount,
        settled: true,
        settledAt: serverTimestamp(),
      });
      setConfirmMarkPaid(null);
      setShowBreakdown(false);
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Error marking as paid. Please try again.');
    }
  }

  const [settlements, setSettlements] = useState([]);
  // Listen to settlements in real-time
  useEffect(() => {
    if (!group?.id) return;
    const settlementsCol = collection(db, 'groups', group.id, 'settlements');
    const unsub = onSnapshot(settlementsCol, (snapshot) => {
      setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [group?.id]);

  // Use the new hook for balances
  const { balances, loading: balancesLoading, error: balancesError } = useGroupBalances(groupId);

  // Before rendering the breakdown modal, define myBalance in the same scope
  const myBalance = balances[myName] || 0;

  // Add state for modals/dialogs at the top of the component
  const [showShareGroup, setShowShareGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // In the component, add state for editing group fields
  const [editGroupName, setEditGroupName] = useState(group.name);
  const [editGroupCurrency, setEditGroupCurrency] = useState(group.currency);
  const [editParticipants, setEditParticipants] = useState(group.participants || []);
  const [editParticipantInput, setEditParticipantInput] = useState("");
  const [editGroupLoading, setEditGroupLoading] = useState(false);
  const [editGroupError, setEditGroupError] = useState("");

  // In the Group Insights modal, compute insights from expenses and balances
  const totalSpent = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const payerTotals = {};
  expenses.forEach(exp => { if (exp.paidBy) payerTotals[exp.paidBy] = (payerTotals[exp.paidBy] || 0) + (parseFloat(exp.amount) || 0); });
  const topPayerUid = Object.entries(payerTotals).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topPayerName = topPayerUid ? getNameByUid(group, topPayerUid) : '-';
  const topPayerAmount = topPayerUid ? payerTotals[topPayerUid] : 0;
  const spenderTotals = {};
  Object.entries(balances).forEach(([name, bal]) => { spenderTotals[name] = bal; });
  const topSpender = Object.entries(spenderTotals).sort((a, b) => a[1] - b[1])[0];
  const topSpenderName = topSpender ? topSpender[0] : '-';
  const topSpenderAmount = topSpender ? topSpender[1] : 0;
  const participantCounts = {};
  expenses.forEach(exp => { Object.keys(exp.splits || {}).forEach(uid => { participantCounts[uid] = (participantCounts[uid] || 0) + 1; }); });
  const mostFrequentUid = Object.entries(participantCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostFrequentName = mostFrequentUid ? getNameByUid(group, mostFrequentUid) : '-';
  const mostFrequentCount = mostFrequentUid ? participantCounts[mostFrequentUid] : 0;
  const largestExpense = expenses.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0];

  // Add helper to check if user is group creator
  function isGroupCreator(group, user) {
    return group && user && group.createdBy === user.uid;
  }

  const [showNotOwnerDelete, setShowNotOwnerDelete] = useState(false);

  return (
    <>
      <Helmet>
        <title>{group.name} – {tab.charAt(0).toUpperCase() + tab.slice(1)} | ReceipTrack</title>
        <meta name="description" content={`${group.name} – ${tab.charAt(0).toUpperCase() + tab.slice(1)} tab in ReceipTrack group expenses app.`} />
        <link rel="canonical" href={window.location.href} />
      </Helmet>
      <div className="min-h-screen bg-black/90 flex flex-col">
        {/* Mobile-first header */}
        <div className="flex items-center gap-2 p-4 pt-20">
          <button className="text-blue-300 hover:text-white p-2" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-lg md:text-2xl font-bold text-white flex-1 truncate">{group.name}</span>
          {/* Three-dots menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="p-2 rounded-full hover:bg-slate-800 focus:outline-none" aria-label="Group options">
                <MoreVertical className="h-6 w-6 text-white" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="z-50 min-w-[180px] bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700/40 py-2 px-1">
              <DropdownMenu.Item className="px-4 py-2 rounded hover:bg-blue-700/30 cursor-pointer" onClick={() => setShowShareGroup(true)}>Share group</DropdownMenu.Item>
              <DropdownMenu.Item className="px-4 py-2 rounded hover:bg-blue-700/30 cursor-pointer" onClick={() => setShowEditGroup(true)}>Edit group</DropdownMenu.Item>
              <DropdownMenu.Item className="px-4 py-2 rounded hover:bg-blue-700/30 cursor-pointer" onClick={() => setShowInsights(true)}>Insights</DropdownMenu.Item>
              <DropdownMenu.Item className="px-4 py-2 rounded hover:bg-blue-700/30 cursor-pointer" onClick={() => setShowArchiveConfirm(true)}>Archive group</DropdownMenu.Item>
              <DropdownMenu.Item className="px-4 py-2 rounded hover:bg-red-700/30 text-red-400 cursor-pointer" onClick={() => {
                if (isGroupCreator(group, user)) {
                  setShowDeleteConfirm(true);
                } else {
                  setShowNotOwnerDelete(true);
                }
              }}>Delete group</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
        
        {/* Mobile-optimized tabs */}
        <div className="flex justify-center gap-1 md:gap-2 mb-4 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`px-3 md:px-4 py-2 rounded-full font-semibold text-sm md:text-base transition-all duration-150 flex-1 max-w-32 ${tab === t.key ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-blue-200 hover:bg-blue-700 hover:text-white'}`}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        
        {/* Content area with mobile padding */}
        <div className={`flex-1 transition-opacity duration-200 px-4 pb-24 ${tabFade ? 'opacity-100' : 'opacity-0'}`}>
          {loading ? (
            <div className="text-center text-blue-200/70 mt-12 text-lg">Loading expenses...</div>
          ) : error ? (
            <div className="text-center text-red-400 mt-12 text-lg">{error}</div>
          ) : tab === 'expenses' && expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-8">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#888" strokeWidth="2"/></svg>
              <div className="text-white text-lg font-semibold mt-4">No expenses yet</div>
              <div className="text-blue-200 text-center mt-2 px-4">Add an expense by tapping the "+" button to start tracking and splitting your group expenses.</div>
            </div>
          ) : tab === 'expenses' && expenses.length > 0 && (
            <div className="w-full max-w-md mx-auto flex flex-col gap-3">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center bg-slate-800 rounded-xl p-4 shadow border border-blue-700/20 gap-3 cursor-pointer hover:bg-slate-700 transition" onClick={() => setEditExpense(exp)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-base truncate">{exp.label}</div>
                    <div className="text-blue-200 text-sm truncate">{getNameByUid(group, exp.paidBy)} • {exp.date}</div>
                  </div>
                  <div className="font-bold text-lg text-blue-300 flex-shrink-0">{exp.amount.toFixed(2)} {group.currency}</div>
                </div>
              ))}
            </div>
          )}
          {/* BALANCES TAB */}
          {tab === 'balances' && (
            <div className="w-full max-w-md mx-auto flex flex-col gap-4">
              {(() => {
                if (balancesLoading) return <div className="text-center text-blue-200/70 mt-12 text-lg">Loading balances...</div>;
                if (balancesError) return <div className="text-center text-red-400 mt-12 text-lg">{balancesError}</div>;
                const myBalance = balances[myName] || 0;
                const allZero = Object.values(balances).every(b => Math.abs(b) < 0.01);
                let faceIcon = '🤔';
                let summary = '';
                if (allZero) {
                  faceIcon = '🕊️';
                  summary = `All settled up!`;
                } else if (myBalance > 0) {
                  faceIcon = '😃';
                  summary = `You are owed ${Math.abs(myBalance).toFixed(2)} ${group.currency || '€'}`;
                } else if (myBalance < 0) {
                  faceIcon = '😢';
                  summary = `You owe ${Math.abs(myBalance).toFixed(2)} ${group.currency || '€'}`;
                } else {
                  faceIcon = '🤔';
                  summary = `You owe 0.00 ${group.currency || '€'}`;
                }
                return <>
                  <button type="button" onClick={() => setShowBreakdown(true)} className="bg-[#23232a] rounded-2xl p-4 flex items-center gap-4 shadow border border-slate-700/40 mt-2 w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <span className="text-3xl">{faceIcon}</span>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-white">{summary}</div>
                      <div className="text-blue-200 text-sm">
                        {myBalance > 0 && 'See who needs to pay you'}
                        {myBalance < 0 && 'See who you need to pay'}
                        {allZero && 'No one owes anyone.'}
                        {myBalance === 0 && !allZero && 'No debts.'}
                      </div>
                    </div>
                  </button>
                  <div className="mt-2">
                    <div className="uppercase text-xs font-semibold text-blue-200 mb-2 tracking-wide">BALANCES</div>
                    <div className="bg-[#23232a] rounded-2xl p-2 shadow border border-slate-700/40">
                      {Object.entries(balances).sort((a, b) => b[1] - a[1]).map(([name, bal], idx, arr) => (
                        <div key={name} className={`flex items-center px-2 py-3 ${idx !== arr.length - 1 ? 'border-b border-slate-700/30' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mr-4 ${name === myName ? 'bg-slate-700 text-white' : 'bg-slate-600 text-blue-100'}`}>{getInitials(name)}</div>
                          <div className="flex-1 text-white text-base font-medium">{name}{name === myName ? <span className="text-blue-300 text-xs ml-1">Me</span> : ''}</div>
                          <div className={`font-semibold text-lg ${bal > 0 ? 'text-green-400' : bal < 0 ? 'text-red-400' : 'text-blue-100'}`}>{bal > 0 ? '+' : ''}{(typeof bal !== 'number' || isNaN(bal) ? '0.00' : bal.toFixed(2))} {group.currency || '€'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>;
              })()}
            </div>
          )}
          {/* TODO: Photos tab */}
        </div>
      </div>
      <button
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 md:w-16 md:h-16 flex items-center justify-center shadow-2xl border-4 border-blue-900 transition-all duration-300 ease-in-out active:scale-95 text-2xl md:text-3xl"
        onClick={() => setShowAdd(true)}
      >
        <Plus className="h-8 w-8 md:h-10 md:w-10" />
      </button>
      {/* Add Expense Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw] p-0 flex flex-col h-[90vh] max-h-[90dvh]">
          {/* Sticky header */}
          <DialogHeader className="px-4 md:px-6 pt-6 pb-2 bg-slate-900 z-10 sticky top-0">
            <DialogTitle className="text-2xl font-bold mb-1">Add Expense</DialogTitle>
            <DialogDescription>Fill in the details below to add a new expense.</DialogDescription>
          </DialogHeader>
          {/* Scrollable form content */}
          <div className="flex-1 overflow-y-auto px-0" style={{ maxHeight: '60vh' }}>
            <form onSubmit={handleAddExpense} className="flex flex-col gap-4 px-4 md:px-6 pb-6">
              <div className="flex gap-2 mb-2">
                {EXPENSE_TYPES.map(t => (
                  <button
                    key={t.key}
                    className={`flex-1 px-3 md:px-4 py-3 md:py-2 rounded-xl md:rounded-lg text-sm md:text-base font-semibold border transition-all duration-200 ${expenseType === t.key ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-800 text-blue-200 border-slate-700 hover:bg-slate-700'}`}
                    onClick={e => { e.preventDefault(); setExpenseType(t.key); }}
                    type="button"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {error && <div className="text-red-400 text-sm mb-2 px-2">{error}</div>}
              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                  placeholder="E.g. Drinks"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  required
                />
                <button type="button" className="bg-slate-800 rounded-xl md:rounded-lg p-3 md:p-2 ml-1 hover:bg-slate-700 transition-colors" title="Tag" onClick={() => setShowCategoryDialog(true)}>
                  <span role="img" aria-label="tag" className="text-lg">{tag ? tag.split(' ')[0] : '🏷️'}</span>
                </button>
                <button type="button" className="bg-slate-800 rounded-xl md:rounded-lg p-3 md:p-2 ml-1 hover:bg-slate-700 transition-colors" title="Photo" onClick={() => setPhoto(photo ? null : 'photo')}>
                  <span role="img" aria-label="photo" className="text-lg">📷</span>
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
                <select
                  className="rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-3 md:px-2 py-4 md:py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                >
                  <option value="EUR">€</option>
                  <option value="USD">$</option>
                  <option value="GBP">£</option>
                  <option value="JPY">¥</option>
                </select>
              </div>
              <div className="flex flex-col md:flex-row gap-2">
                <select
                  className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value)}
                >
                  {(group.participants || []).map((name, idx) => (
                    <option key={name} value={name}>{name}{name === myName ? ' (me)' : ''}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-3 mb-3 p-3 bg-slate-800/50 rounded-xl">
                <input
                  type="checkbox"
                  checked={splitEnabled}
                                  onChange={e => {
                  setSplitEnabled(e.target.checked);
                  if (e.target.checked) {
                    setSplitType(lastSplitType);
                    // Only select the current user by default
                    const defaultSplit = {};
                    defaultSplit[myName] = true;
                    setSplit(defaultSplit);
                    // Reset shares and amounts for other users
                    const defaultShares = {};
                    const defaultAmounts = {};
                    if (lastSplitType === 'shares') {
                      defaultShares[myName] = 1;
                    } else if (lastSplitType === 'amounts') {
                      defaultAmounts[myName] = '';
                    }
                    setSplitShares(defaultShares);
                    setSplitAmounts(defaultAmounts);
                  } else {
                    setLastSplitType(splitType);
                    setSplit({});
                    setSplitShares({});
                    setSplitAmounts({});
                  }
                }}
                  className="accent-blue-600 h-6 w-6 md:h-5 md:w-5"
                  id="split-toggle"
                />
                <label htmlFor="split-toggle" className="text-white font-semibold text-base">Split</label>
                {splitEnabled && (
                  <select
                    className="ml-auto rounded-lg bg-slate-900 border border-blue-700/40 px-3 md:px-2 py-2 md:py-1 text-white text-sm md:text-base"
                    value={splitType}
                    onChange={e => { setSplitType(e.target.value); setLastSplitType(e.target.value); }}
                  >
                    {SPLIT_TYPES.map(t => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                )}
              </div>
              {splitEnabled && (
                <div className="flex flex-col gap-2 mt-2">
                  {(group.participants || []).sort((a, b) => {
                  if (a === myName) return -1;
                  if (b === myName) return 1;
                  return a.localeCompare(b);
                }).map(name => {
                    const checked = !!split[name];
                    const shares = splitType === 'shares' ? (parseInt(splitShares[name]) || 0) : 1;
                    const effectiveShares = splitType === 'shares' ? (checked ? shares : 0) : (checked ? 1 : 0);
                    const totalShares = splitType === 'shares' ? (group.participants || []).reduce((sum, n) => sum + (split[n] ? (parseInt(splitShares[n]) || 0) : 0), 0) : 1;
                    const parsedAmount = parseFloat(amount) || 0;
                    const calculatedAmount = splitType === 'shares' && totalShares > 0
                      ? (parsedAmount * effectiveShares / totalShares)
                      : (splitType === 'equally' && checked ? parsedAmount / (group.participants || []).filter(n => split[n]).length : (splitType === 'amounts' && checked ? parseFloat(splitAmounts[name]) || 0 : 0));
                    return (
                      <div key={name} className="flex items-center gap-3 bg-slate-800 rounded-xl p-4 md:p-3 mb-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (splitType === 'shares') {
                              if (e.target.checked) {
                                setSplit(s => ({ ...s, [name]: true }));
                                setSplitShares(s => ({ ...s, [name]: Math.max(1, parseInt(s[name]) || 1) }));
                              } else {
                                setSplit(s => ({ ...s, [name]: false }));
                                setSplitShares(s => ({ ...s, [name]: 0 }));
                              }
                            } else {
                              setSplit(s => ({ ...s, [name]: e.target.checked }));
                              if (!e.target.checked && splitType === 'amounts') {
                                setSplitAmounts(a => ({ ...a, [name]: '' }));
                              }
                            }
                          }}
                          className="accent-blue-600 h-6 w-6 md:h-5 md:w-5"
                        />
                        <span className="flex-1 text-white text-base font-medium">{name}{name === myName ? ' (me)' : ''}</span>
                        {/* Equally */}
                        {splitType === 'equally' && checked && (
                          <span className="text-blue-200 text-sm md:text-base font-semibold">{amount && split[name] ? `${(parsedAmount / (group.participants || []).filter(n => split[n]).length).toFixed(2)} ${currency}` : `0.00 ${currency}`}</span>
                        )}
                        {/* By Shares */}
                        {splitType === 'shares' && (
                          <>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="px-3 md:px-2 py-2 md:py-1 rounded-lg bg-slate-900 border border-blue-700/40 text-white text-xl md:text-lg disabled:opacity-50 hover:bg-slate-700 transition-colors"
                                onClick={() => {
                                  if (!checked) return;
                                  if ((parseInt(splitShares[name]) || 0) === 1) {
                                    setSplit(s => ({ ...s, [name]: false }));
                                    setSplitShares(s => ({ ...s, [name]: 0 }));
                                  } else {
                                    setSplitShares(s => ({ ...s, [name]: Math.max(1, (parseInt(s[name]) || 1) - 1) }));
                                  }
                                }}
                                disabled={!checked || (parseInt(splitShares[name]) || 0) <= 0}
                              >–</button>
                              <span className="w-8 md:w-6 text-center text-white text-base font-semibold">{checked ? ((parseInt(splitShares[name]) || 1) + 'x') : '0x'}</span>
                              <button
                                type="button"
                                className="px-3 md:px-2 py-2 md:py-1 rounded-lg bg-slate-900 border border-blue-700/40 text-white text-xl md:text-lg hover:bg-slate-700 transition-colors"
                                onClick={() => {
                                  if (!checked) {
                                    setSplit(s => ({ ...s, [name]: true }));
                                    setSplitShares(s => ({ ...s, [name]: 1 }));
                                  } else {
                                    setSplitShares(s => ({ ...s, [name]: (parseInt(s[name]) || 1) + 1 }));
                                  }
                                }}
                              >+</button>
                            </div>
                            <span className="text-blue-200 text-sm md:text-base font-semibold w-24 md:w-20 text-right">{checked && effectiveShares > 0 && totalShares > 0 ? calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} {currency}</span>
                          </>
                        )}
                        {/* By Amounts */}
                        {splitType === 'amounts' && checked && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28 md:w-24 rounded-lg bg-slate-900 border border-blue-700/40 px-3 md:px-2 py-2 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                            placeholder="0.00"
                            value={splitAmounts[name]}
                            onChange={e => setSplitAmounts(a => ({ ...a, [name]: e.target.value }))}
                          />
                        )}
                        {splitType === 'amounts' && checked && (
                          <span className="text-blue-200 text-sm md:text-base font-semibold">{splitAmounts[name] ? `${parseFloat(splitAmounts[name]).toFixed(2)} ${currency}` : `0.00 ${currency}`}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <DialogFooter className="mt-6 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 md:py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
                >
                  Add
                </button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Expense Modal */}
      <Dialog open={!!editExpense} onOpenChange={v => { if (!v) setEditExpense(null); }}>
        <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw] p-0 flex flex-col h-[90vh] max-h-[90dvh]">
          {/* Show detail view or edit form */}
          {!editExpense?.editMode ? (
            <ExpenseDetailView
              expense={editExpense}
              group={group}
              onEdit={() => setEditExpense({ ...editExpense, editMode: true })}
              onDelete={() => { handleEditDelete(); setEditExpense(null); }}
              onClose={() => setEditExpense(null)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-0" style={{ height: '100%', maxHeight: '80vh', minHeight: '300px' }}>
              <EditExpenseForm
                editExpense={editExpense}
                group={group}
                user={user}
                onSave={handleEditSave}
                onDelete={handleEditDelete}
                onCancel={() => setEditExpense(null)}
              />
          </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Mark as Paid Confirmation Dialog */}
      <UIDialog open={!!confirmMarkPaid} onOpenChange={v => { if (!v) setConfirmMarkPaid(null); }}>
        <UIDialogContent className="bg-[#23232a] text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
          <UIDialogTitle asChild>
            <span className="text-base font-bold text-white mt-4">Confirm reimbursement</span>
          </UIDialogTitle>
          <UIDialogDescription asChild>
            <span className="sr-only">A reimbursement will be added to the group to mark this as paid.</span>
          </UIDialogDescription>
          <div className="p-4 text-center text-base">
            {confirmMarkPaid && (
              <>
                <div className="text-lg mb-2 font-semibold">{confirmMarkPaid.amount.toFixed(2)} {group.currency || '€'}</div>
                <div className="text-blue-200 mb-2">
                  {myBalance < 0
                    ? `You are paying ${confirmMarkPaid.name}. Your balance will decrease by this amount.`
                    : `You are being paid by ${confirmMarkPaid.name}. Your balance will increase by this amount.`}
                </div>
              </>
            )}
            <div className="flex gap-2 w-full mt-2">
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl mb-2 mt-1 text-base shadow-xl"
                onClick={() => { setConfirmMarkPaid(null); handleMarkAsPaid(confirmMarkPaid); }}
              >
                Confirm
              </button>
              <button
                className="flex-1 text-blue-400 underline text-base mb-2 mt-1"
                onClick={() => setConfirmMarkPaid(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>
      {/* After the balances list rendering, add the breakdown modal */}
      <UIDialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <UIDialogContent className="bg-black text-white border-none rounded-2xl shadow-2xl max-w-sm w-[98vw] p-0 flex flex-col">
          <UIDialogTitle asChild>
            <div className="flex flex-col items-center gap-2 pt-4 pb-2">
              <span className="text-base font-bold text-white mb-1">{myBalance > 0 ? 'They owe you' : myBalance < 0 ? 'You owe' : 'All settled up!'}</span>
              <span className={`text-xl font-bold px-3 py-1 rounded-full ${myBalance > 0 ? 'bg-green-500/90 text-white' : myBalance < 0 ? 'bg-red-500/90 text-white' : 'bg-slate-700 text-white'}`}>{Math.abs(myBalance).toFixed(2)} {group.currency || '€'}</span>
            </div>
          </UIDialogTitle>
          <UIDialogDescription asChild>
            <span className="sr-only">Detailed breakdown of group balances and actions</span>
          </UIDialogDescription>
          {/* Section title for owes list */}
          <div className="w-full text-center text-blue-200 text-xs font-semibold mt-2 mb-1 uppercase tracking-wide">{myBalance > 0 ? 'People who owe you' : myBalance < 0 ? 'People you owe' : 'No debts'}</div>
          {/* Owes list, always scrollable and mobile-first */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }} className="flex flex-col gap-3 px-2 pb-6">
            {getUnsettledOwes(group, balances, settlements, myName, myBalance > 0).map(([name, bal]) => (
              <div key={name} className="bg-[#23232a] rounded-xl p-3 flex flex-col items-center shadow border border-slate-700/40">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white text-base">{myBalance > 0 ? `${name} owes you` : `You owe ${name}`}</span>
                </div>
                <div className="font-bold text-lg mb-2">{Math.abs(bal).toFixed(2)} {group.currency || '€'}</div>
                <div className="flex gap-2 w-full">
                  <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow transition-all text-sm" onClick={() => setConfirmMarkPaid({ name, amount: Math.abs(bal) })}>Mark as paid</button>
                  <button className="flex-1 bg-white text-blue-700 font-semibold py-2 rounded-lg shadow border border-blue-600 transition-all text-sm" onClick={() => handleRemind(name, Math.abs(bal))}>Remind</button>
                </div>
              </div>
            ))}
            {getUnsettledOwes(group, balances, settlements, myName, myBalance > 0).length === 0 && (
              <div className="text-blue-200 text-center mt-4">All settled up!</div>
            )}
          </div>
        </UIDialogContent>
      </UIDialog>
      {showShareGroup && (
        <Dialog open onOpenChange={setShowShareGroup}>
          <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-2xl font-bold text-center mt-4 mb-2">Share this group</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">Invite others to join your group using the link or QR code below.</DialogDescription>
            <div className="w-full flex flex-col items-center p-4 pt-0">
              {group?.id ? (
                <>
                  <div className="mb-2 text-blue-200 text-center break-all">{`${window.location.origin}/join/${group.id}`}</div>
                  <QRCode value={`${window.location.origin}/join/${group.id}`} size={180} bgColor="#fff" fgColor="#222" />
                </>
              ) : (
                <div className="text-red-400 text-center">Error: Group not found</div>
              )}
            </div>
            <div className="flex gap-2 w-full px-4 mb-4">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow" disabled={!group?.id} onClick={async () => { 
                if (group?.id) {
                  await navigator.clipboard.writeText(`${window.location.origin}/join/${group.id}`); 
                  alert('Link copied!'); 
                }
              }}>Copy Link</button>
              <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg shadow" disabled={!group?.id} onClick={async () => { 
                if (group?.id) {
                  if (navigator.share) { 
                    await navigator.share({ title: 'Join my group', url: `${window.location.origin}/join/${group.id}` }); 
                  } else { 
                    await navigator.clipboard.writeText(`${window.location.origin}/join/${group.id}`); 
                    alert('Link copied!'); 
                  } 
                }
              }}>Share</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showEditGroup && (
        <Dialog open onOpenChange={setShowEditGroup}>
          <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-2xl font-bold text-center mt-4 mb-2">Edit Group</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">Update group details below.</DialogDescription>
            <form className="w-full flex flex-col gap-3 p-4" onSubmit={async e => {
              e.preventDefault();
              if (!group?.id) {
                setEditGroupError('Group ID is missing. Please try again.');
                return;
              }
              setEditGroupLoading(true);
              setEditGroupError("");
              try {
                await updateDoc(doc(db, 'groups', group.id), {
                  name: editGroupName.trim(),
                  currency: editGroupCurrency,
                  participants: editParticipants,
                });
                // Update local state so UI reflects changes immediately
                setEditGroupName(editGroupName.trim());
                setEditGroupCurrency(editGroupCurrency);
                setEditParticipants([...editParticipants]);
                if (typeof onGroupUpdate === 'function') {
                  onGroupUpdate({ ...group, name: editGroupName.trim(), currency: editGroupCurrency, participants: [...editParticipants] });
                }
                setShowEditGroup(false);
              } catch (err) {
                setEditGroupError('Failed to update group.');
              } finally {
                setEditGroupLoading(false);
              }
            }}>
              <label className="flex flex-col gap-1">
                <span className="text-blue-200">Group name</span>
                <input className="rounded-lg bg-slate-800 px-4 py-3 text-white" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-blue-200">Currency</span>
                <select className="rounded-lg bg-slate-800 px-4 py-3 text-white" value={editGroupCurrency} onChange={e => setEditGroupCurrency(e.target.value)}>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="GBP">British Pound (£)</option>
                  <option value="JPY">Japanese Yen (¥)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-blue-200">Participants</span>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-white" value={editParticipantInput} onChange={e => setEditParticipantInput(e.target.value)} placeholder="Add a participant name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (editParticipantInput.trim() && !editParticipants.includes(editParticipantInput.trim())) { setEditParticipants([...editParticipants, editParticipantInput.trim()]); setEditParticipantInput(""); } } }} />
                  <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow" onClick={() => { if (editParticipantInput.trim() && !editParticipants.includes(editParticipantInput.trim())) { setEditParticipants([...editParticipants, editParticipantInput.trim()]); setEditParticipantInput(""); } }}>Add</button>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {editParticipants.map((p, idx) => (
                    <li key={p} className="bg-slate-800 px-3 py-1 rounded-lg flex items-center gap-2">
                      <span>{p}</span>
                      <button type="button" className="text-red-400 hover:text-red-600 text-xs font-bold" onClick={() => setEditParticipants(editParticipants.filter(x => x !== p))} aria-label={`Remove ${p}`}>×</button>
                    </li>
                  ))}
                </ul>
              </label>
              {editGroupError && <div className="text-red-400 text-sm mb-2">{editGroupError}</div>}
              <div className="flex gap-2 w-full mt-2">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow" disabled={editGroupLoading}>{editGroupLoading ? 'Saving...' : 'Save'}</button>
                <button type="button" className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow" onClick={() => setShowEditGroup(false)} disabled={editGroupLoading}>Cancel</button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {showInsights && (
        <Dialog open onOpenChange={setShowInsights}>
          <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-2xl font-bold text-center mt-4 mb-2">Group Insights</DialogTitle>
            <DialogDescription className="text-blue-300 text-center mb-4">Key stats for your group.</DialogDescription>
            <div className="w-full flex flex-col gap-5 p-4 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-semibold text-blue-200">Total spent</span>
                <span className="text-3xl font-extrabold text-green-400">{totalSpent.toFixed(2)} {group.currency || '€'}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-semibold text-blue-200">Expenses</span>
                <span className="text-2xl font-bold text-blue-400">{expenses.length}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-semibold text-blue-200">Top payer</span>
                <span className="text-xl font-bold text-yellow-400">{topPayerName}</span>
                <span className="text-blue-200 text-base">{topPayerAmount.toFixed(2)} {group.currency || '€'}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-semibold text-blue-200">Largest expense</span>
                <span className="text-xl font-bold text-orange-400">{largestExpense ? largestExpense.label : '-'}</span>
                <span className="text-blue-200 text-base">{largestExpense ? (parseFloat(largestExpense.amount) || 0).toFixed(2) : '-'} {group.currency || '€'}</span>
              </div>
            </div>
            <div className="flex gap-2 w-full px-4 mb-4 mt-2">
              <button className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow" onClick={() => setShowInsights(false)}>Close</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showArchiveConfirm && (
        <Dialog open onOpenChange={setShowArchiveConfirm}>
          <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-xl font-bold text-center mt-4 mb-2">Archive Group?</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">Are you sure you want to archive this group? You can restore it later.</DialogDescription>
            <div className="flex gap-2 w-full px-4 mb-4 mt-4">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow" onClick={async () => {
                if (!group?.id) {
                  console.error('Group ID is undefined, cannot archive');
                  alert('Error: Group not found. Please try again.');
                  return;
                }
                console.log('Attempting to archive group (confirm):', { groupId: group.id, userId: user.uid, currentArchivedBy: group.archivedBy });
                try {
                  const groupRef = doc(db, 'groups', group.id);
                  const newArchivedBy = Array.from(new Set([...(group.archivedBy || []), user.uid]));
                  console.log('New archivedBy array (confirm):', newArchivedBy);
                  await updateDoc(groupRef, {
                    archivedBy: newArchivedBy
                  });
                  console.log('Successfully archived group (confirm)');
                  setShowArchiveConfirm(false);
                  navigate('/');
                } catch (error) {
                  console.error('Error archiving group (confirm):', error);
                  console.error('Error details (confirm):', {
                    code: error.code,
                    message: error.message,
                    groupId: group.id,
                    userId: user.uid
                  });
                  alert(`Error archiving group: ${error.message || 'Unknown error'}`);
                }
              }}>Archive</button>
              <button className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow" onClick={() => setShowArchiveConfirm(false)}>Cancel</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showDeleteConfirm && (
        <Dialog open onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-xl font-bold text-center mt-4 mb-2">Delete Group?</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">This action cannot be undone. Are you sure you want to delete this group?</DialogDescription>
            <div className="flex gap-2 w-full px-4 mb-4 mt-4">
              <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg shadow" onClick={async () => { 
              if (!group?.id) {
                console.error('Group ID is undefined, cannot delete');
                alert('Error: Group not found. Please try again.');
                return;
              }
              try {
                await deleteDoc(doc(db, 'groups', group.id)); 
                setShowDeleteConfirm(false); 
                navigate('/'); 
              } catch (error) {
                console.error('Error deleting group:', error);
                alert('Error deleting group. Please try again.');
              }
            }}>Delete</button>
              <button className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showNotOwnerDelete && (
        <Dialog open onOpenChange={setShowNotOwnerDelete}>
          <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-xs w-[95vw] p-0 flex flex-col items-center">
            <DialogTitle className="text-xl font-bold text-center mt-4 mb-2">Cannot Delete Group</DialogTitle>
            <DialogDescription className="text-blue-300 text-center">You are not the owner. Only the group creator can delete this group. You can archive it to hide it from your list.</DialogDescription>
            <div className="flex gap-2 w-full px-4 mb-4 mt-4">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow" onClick={async () => {
                // Archive for this user by adding their UID to archivedBy array
                if (!group?.id) {
                  console.error('Group ID is undefined, cannot archive');
                  alert('Error: Group not found. Please try again.');
                  return;
                }
                console.log('Attempting to archive group:', { groupId: group.id, userId: user.uid, currentArchivedBy: group.archivedBy });
                try {
                  const groupRef = doc(db, 'groups', group.id);
                  const newArchivedBy = Array.from(new Set([...(group.archivedBy || []), user.uid]));
                  console.log('New archivedBy array:', newArchivedBy);
                  await updateDoc(groupRef, {
                    archivedBy: newArchivedBy
                  });
                  console.log('Successfully archived group');
                  setShowNotOwnerDelete(false);
                  navigate('/');
                } catch (error) {
                  console.error('Error archiving group:', error);
                  console.error('Error details:', {
                    code: error.code,
                    message: error.message,
                    groupId: group.id,
                    userId: user.uid
                  });
                  alert(`Error archiving group: ${error.message || 'Unknown error'}`);
                }
              }}>Archive</button>
              <button className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg shadow" onClick={() => setShowNotOwnerDelete(false)}>Cancel</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function EditExpenseForm({ editExpense, group, user, onSave, onDelete, onCancel }) {
  const EXPENSE_TYPES = [
    { key: 'expense', label: 'Expense' },
    { key: 'income', label: 'Income' },
    { key: 'transfer', label: 'Transfer...' },
  ];
  const SPLIT_TYPES = [
    { key: 'equally', label: 'Equally' },
    { key: 'shares', label: 'By Shares' },
    { key: 'amounts', label: 'By Amounts' },
  ];
  const members = group.participants || [];
  // --- Refactored state initialization ---
  const [expenseType, setExpenseType] = useState(editExpense.expenseType || 'expense');
  const [label, setLabel] = useState(editExpense.label || '');
  const [tag, setTag] = useState(editExpense.tag || '');
  const [photo, setPhoto] = useState(editExpense.photo || null);
  const [amount, setAmount] = useState(editExpense.amount?.toString() || '');
  const [currency, setCurrency] = useState(editExpense.currency || group.currency || 'EUR');
  const [paidBy, setPaidBy] = useState(editExpense.paidBy || members[0] || '');
  const [date, setDate] = useState(editExpense.date || new Date().toISOString().slice(0,10));
  const [splitType, setSplitType] = useState(editExpense.splitType || 'equally');
  // --- Always initialize split states from saved data, using correct splitType ---
  const getInitialSplit = (splitType, splits, shares) => {
    if (!splits && !shares) return members.reduce((acc, m) => ({ ...acc, [m]: true }), {});
    if (splitType === 'equally' || splitType === 'amounts') {
      return members.reduce((acc, m) => {
        const uid = group.claimedBy[m];
        // Check both splits[uid] and splits[m]
        return { ...acc, [m]: ((uid && splits && splits[uid] !== undefined && splits[uid] !== null) || (splits && splits[m] !== undefined && splits[m] !== null)) };
      }, {});
    } else if (splitType === 'shares') {
      return members.reduce((acc, m) => {
        const uid = group.claimedBy[m];
        const share = (uid && shares) ? shares[uid] : (shares ? shares[m] : 0);
        return { ...acc, [m]: share > 0 };
      }, {});
    }
    return members.reduce((acc, m) => ({ ...acc, [m]: true }), {});
  };
  const getInitialSplitAmounts = (splitType, splits) => {
    if (splitType === 'amounts' && splits) {
      return members.reduce((acc, m) => {
        const uid = group.claimedBy[m];
        // Check both splits[uid] and splits[m]
        return { ...acc, [m]: splits[uid] !== undefined ? splits[uid].toString() : (splits[m] !== undefined ? splits[m].toString() : '') };
      }, {});
    }
    return members.reduce((acc, m) => ({ ...acc, [m]: '' }), {});
  };
  const getInitialSplitShares = (splitType, shares, splits) => {
    if (splitType === 'shares' && shares) {
      return members.reduce((acc, m) => {
        const uid = group.claimedBy[m];
        // Check both shares[uid] and shares[m]
        const share = (uid && shares) ? shares[uid] : (shares ? shares[m] : 0);
        return { ...acc, [m]: share !== undefined ? share : 0 };
      }, {});
    }
    if (splitType === 'shares' && splits) {
      return members.reduce((acc, m) => {
        const uid = group.claimedBy[m];
        return { ...acc, [m]: (splits[uid] !== undefined || splits[m] !== undefined) ? 1 : 0 };
      }, {});
    }
    return members.reduce((acc, m) => ({ ...acc, [m]: 1 }), {});
  };
  const [split, setSplit] = useState(() => getInitialSplit(splitType, editExpense.splits, editExpense.shares));
  const [splitAmounts, setSplitAmounts] = useState(() => getInitialSplitAmounts(splitType, editExpense.splits));
  const [splitShares, setSplitShares] = useState(() => getInitialSplitShares(splitType, editExpense.shares, editExpense.splits));
  const [formError, setFormError] = useState('');
  const [splitEnabled, setSplitEnabled] = useState(() => {
    if (editExpense.splitEnabled !== undefined) return editExpense.splitEnabled;
    if (editExpense.splits) return Object.values(editExpense.splits).some(v => v !== undefined);
    return true;
  });

  // --- useEffect: always update all split states when editExpense or splitType changes ---
  React.useEffect(() => {
    setExpenseType(editExpense.expenseType || 'expense');
    setLabel(editExpense.label || '');
    setTag(editExpense.tag || '');
    setPhoto(editExpense.photo || null);
    setAmount(editExpense.amount?.toString() || '');
    setCurrency(editExpense.currency || group.currency || 'EUR');
    setPaidBy(editExpense.paidBy || members[0] || '');
    setDate(editExpense.date || new Date().toISOString().slice(0,10));
    setSplitType(editExpense.splitType || 'equally');
    setSplit(getInitialSplit(editExpense.splitType || 'equally', editExpense.splits, editExpense.shares));
    setSplitAmounts(getInitialSplitAmounts(editExpense.splitType || 'equally', editExpense.splits));
    setSplitShares(getInitialSplitShares(editExpense.splitType || 'equally', editExpense.shares, editExpense.splits));
    if (editExpense.splitEnabled !== undefined) {
      setSplitEnabled(editExpense.splitEnabled);
    } else if (editExpense.splits) {
      setSplitEnabled(Object.values(editExpense.splits).some(v => v !== undefined));
    } else {
      setSplitEnabled(true);
    }
  }, [editExpense, members]);
  // When splitType changes (by user), reset relevant states
  const handleSplitTypeChange = (e) => {
    const newType = e.target.value;
    setSplitType(newType);
    if (newType === 'equally') {
      setSplit(members.reduce((acc, m) => ({ ...acc, [m]: true }), {}));
    } else if (newType === 'amounts') {
      setSplit(members.reduce((acc, m) => ({ ...acc, [m]: true }), {}));
      setSplitAmounts(members.reduce((acc, m) => ({ ...acc, [m]: '' }), {}));
    } else if (newType === 'shares') {
      setSplit(members.reduce((acc, m) => ({ ...acc, [m]: true }), {}));
      setSplitShares(members.reduce((acc, m) => ({ ...acc, [m]: 1 }), {}));
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    setFormError('');
    console.log('EditExpenseForm handleSubmit values:', {
      label, tag, amount, paidBy, date, expenseType, currency, splitType, split, splitAmounts, splitShares, splitEnabled, group, editExpense
    });
    if (!label.trim()) {
      setFormError('Title is required');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Amount must be a positive number');
      return;
    }
    if (!paidBy) {
      setFormError('Paid By is required');
      return;
    }
    if (!date) {
      setFormError('Date is required');
      return;
    }
    // Split validation
    const selected = members.filter(m => split[m]);
    if (selected.length === 0 && splitEnabled) {
      setFormError('Select at least one participant');
      return;
    }
    let splits = {};
    let shares = {};
    if (splitEnabled) {
      if (splitType === 'equally') {
        const share = parseFloat((parsedAmount / selected.length).toFixed(2));
        selected.forEach(m => {
          const uid = group.claimedBy[m];
          const key = uid || m;
          splits[key] = share;
          shares[key] = 1;
        });
      } else if (splitType === 'amounts') {
        let total = 0;
        for (const m of selected) {
          const val = parseFloat(splitAmounts[m]);
          if (isNaN(val) || val < 0) {
            setFormError('Enter valid amounts for all selected');
            return;
          }
          total += val;
        }
        if (Math.abs(total - parsedAmount) > 0.01) {
          setFormError('Split amounts must sum to total');
          return;
        }
        selected.forEach(m => {
          const uid = group.claimedBy[m];
          const key = uid || m;
          splits[key] = parseFloat(splitAmounts[m]);
          shares[key] = 1;
        });
      } else if (splitType === 'shares') {
        let totalShares = 0;
        for (const m of selected) {
          const val = parseInt(splitShares[m]) || 0;
          if (isNaN(val) || val <= 0) {
            setFormError('Enter valid shares for all selected');
            return;
          }
          totalShares += val;
        }
        selected.forEach(m => {
          const uid = group.claimedBy[m];
          const key = uid || m;
          const sharesCount = parseInt(splitShares[m]) || 0;
          splits[key] = parseFloat(((parsedAmount * sharesCount) / totalShares).toFixed(2));
          shares[key] = sharesCount;
        });
      }
    }
    const updatedData = {
      label: label.trim(),
      tag,
      amount: parsedAmount,
      paidBy: group.claimedBy[paidBy] || paidBy,
      date,
      expenseType,
      currency,
      splitType,
      splits,
      shares, // Save shares mapping
      photo: photo || '',
      splitEnabled,
    };
    console.log('EditExpenseForm onSave updatedData:', updatedData);
    onSave(updatedData);
  };

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 md:px-6 pb-6">
      {/* Mobile-optimized expense type buttons */}
      <div className="flex gap-2 mb-2">
        {EXPENSE_TYPES.map(t => (
          <button
            key={t.key}
            className={`flex-1 px-3 md:px-4 py-3 md:py-2 rounded-xl md:rounded-lg text-sm md:text-base font-semibold border transition-all duration-200 ${expenseType === t.key ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-800 text-blue-200 border-slate-700 hover:bg-slate-700'}`}
            onClick={e => { e.preventDefault(); setExpenseType(t.key); }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      
      {formError && <div className="text-red-400 text-sm mb-2 px-2">{formError}</div>}
      
      {/* Mobile-optimized input row with better spacing */}
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
          placeholder="E.g. Drinks"
          value={label}
          onChange={e => setLabel(e.target.value)}
          required
        />
        <button type="button" className="bg-slate-800 rounded-xl md:rounded-lg p-3 md:p-2 ml-1 hover:bg-slate-700 transition-colors" title="Tag" onClick={() => setShowCategoryDialog(true)}>
          <span role="img" aria-label="tag" className="text-lg">{tag ? tag.split(' ')[0] : '🏷️'}</span>
        </button>
        <button type="button" className="bg-slate-800 rounded-xl md:rounded-lg p-3 md:p-2 ml-1 hover:bg-slate-700 transition-colors" title="Photo" onClick={() => setPhoto(photo ? null : 'photo')}>
          <span role="img" aria-label="photo" className="text-lg">📷</span>
        </button>
      </div>
      
      {/* Mobile-optimized amount and currency row */}
      <div className="flex gap-2 items-center">
        <input
          type="number"
          step="0.01"
          min="0"
          className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <select
          className="rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-3 md:px-2 py-4 md:py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
        >
          <option value="EUR">€</option>
          <option value="USD">$</option>
          <option value="GBP">£</option>
          <option value="JPY">¥</option>
        </select>
      </div>
      
      {/* Mobile-optimized paid by and date row */}
      <div className="flex flex-col md:flex-row gap-2">
        <select
          className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
          value={paidBy}
          onChange={e => setPaidBy(e.target.value)}
        >
          {members.map(p => (
            <option key={p} value={p}>{getNameByUid(group, group.claimedBy[p])}</option>
          ))}
        </select>
        <input
          type="date"
          className="flex-1 rounded-xl md:rounded-lg bg-slate-800 border border-blue-700/40 px-4 py-4 md:py-3 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />
      </div>
      
      {/* Mobile-optimized split controls */}
      <div className="flex items-center gap-3 mb-3 p-3 bg-slate-800/50 rounded-xl">
        <input
          type="checkbox"
          checked={splitEnabled}
          onChange={e => {
            setSplitEnabled(e.target.checked);
            if (e.target.checked) {
              setSplit(members.reduce((acc, m) => ({ ...acc, [m]: true }), {}));
            } else {
              setSplit(members.reduce((acc, m) => ({ ...acc, [m]: false }), {}));
            }
          }}
          className="accent-blue-600 h-6 w-6 md:h-5 md:w-5"
        />
        <span className="text-white font-semibold text-base">Split Expense</span>
        <select
          className="ml-auto rounded-lg bg-slate-900 border border-blue-700/40 px-3 md:px-2 py-2 md:py-1 text-white text-sm md:text-base"
          value={splitType}
          onChange={handleSplitTypeChange}
          disabled={!splitEnabled}
        >
          {SPLIT_TYPES.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>
      
      {/* Mobile-optimized split participants */}
      <div className="flex flex-col gap-2 mt-2">
        {splitEnabled && members.map(m => {
          const checked = !!split[m];
          const shares = splitType === 'shares' ? (parseInt(splitShares[m]) || 0) : 1;
          const effectiveShares = splitType === 'shares' ? (checked ? shares : 0) : (checked ? 1 : 0);
          const totalShares = splitType === 'shares' ? members.reduce((sum, n) => sum + (split[n] ? (parseInt(splitShares[n]) || 0) : 0), 0) : 1;
          const parsedAmount = parseFloat(amount) || 0;
          const calculatedAmount = splitType === 'shares' && totalShares > 0
            ? (parsedAmount * effectiveShares / totalShares)
            : (splitType === 'equally' && checked ? parsedAmount / members.filter(n => split[n]).length : (splitType === 'amounts' && checked ? parseFloat(splitAmounts[m]) || 0 : 0));
          return (
            <div key={m} className="flex items-center gap-3 bg-slate-800 rounded-xl p-4 md:p-3 mb-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={e => {
                  if (splitType === 'shares') {
                    if (e.target.checked) {
                      setSplit(s => ({ ...s, [m]: true }));
                      setSplitShares(s => ({ ...s, [m]: Math.max(1, parseInt(s[m]) || 1) }));
                    } else {
                      setSplit(s => ({ ...s, [m]: false }));
                      setSplitShares(s => ({ ...s, [m]: 0 }));
                    }
                  } else {
                    setSplit(s => ({ ...s, [m]: e.target.checked }));
                    if (!e.target.checked && splitType === 'amounts') {
                      setSplitAmounts(a => ({ ...a, [m]: '' }));
                    }
                  }
                }}
                className="accent-blue-600 h-6 w-6 md:h-5 md:w-5"
              />
              <span className="flex-1 text-white text-base font-medium">{m}</span>
              
              {/* Equally */}
              {splitType === 'equally' && checked && (
                <span className="text-blue-200 text-sm md:text-base font-semibold">{amount && split[m] ? `${(parsedAmount / members.filter(n => split[n]).length).toFixed(2)} ${currency}` : `0.00 ${currency}`}</span>
              )}
              
              {/* By Shares */}
              {splitType === 'shares' && (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 md:px-2 py-2 md:py-1 rounded-lg bg-slate-900 border border-blue-700/40 text-white text-xl md:text-lg disabled:opacity-50 hover:bg-slate-700 transition-colors"
                      onClick={() => {
                        if (!checked) return;
                        if ((parseInt(splitShares[m]) || 0) === 1) {
                          setSplit(s => ({ ...s, [m]: false }));
                          setSplitShares(s => ({ ...s, [m]: 0 }));
                        } else {
                          setSplitShares(s => ({ ...s, [m]: Math.max(1, (parseInt(s[m]) || 1) - 1) }));
                        }
                      }}
                      disabled={!checked || (parseInt(splitShares[m]) || 0) <= 0}
                    >–</button>
                    <span className="w-8 md:w-6 text-center text-white text-base font-semibold">{checked ? ((parseInt(splitShares[m]) || 1) + 'x') : '0x'}</span>
                    <button
                      type="button"
                      className="px-3 md:px-2 py-2 md:py-1 rounded-lg bg-slate-900 border border-blue-700/40 text-white text-xl md:text-lg hover:bg-slate-700 transition-colors"
                      onClick={() => {
                        if (!checked) {
                          setSplit(s => ({ ...s, [m]: true }));
                          setSplitShares(s => ({ ...s, [m]: 1 }));
                        } else {
                          setSplitShares(s => ({ ...s, [m]: (parseInt(s[m]) || 1) + 1 }));
                        }
                      }}
                    >+</button>
                  </div>
                  <span className="text-blue-200 text-sm md:text-base font-semibold w-24 md:w-20 text-right">{checked && effectiveShares > 0 && totalShares > 0 ? calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} {currency}</span>
                </>
              )}
              
              {/* By Amounts */}
              {splitType === 'amounts' && checked && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28 md:w-24 rounded-lg bg-slate-900 border border-blue-700/40 px-3 md:px-2 py-2 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none text-base"
                  placeholder="0.00"
                  value={splitAmounts[m]}
                  onChange={e => setSplitAmounts(a => ({ ...a, [m]: e.target.value }))}
                />
              )}
              {splitType === 'amounts' && checked && (
                <span className="text-blue-200 text-sm md:text-base font-semibold">{splitAmounts[m] ? `${parseFloat(splitAmounts[m]).toFixed(2)} ${currency}` : `0.00 ${currency}`}</span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Mobile-optimized action buttons */}
      <DialogFooter className="mt-6 flex flex-col gap-3">
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 md:py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
        >
          Save Changes
        </button>
        <button
          type="button"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 md:py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
          onClick={onDelete}
        >
          Delete Expense
        </button>
        <button
          type="button"
          className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-4 md:py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out text-lg"
          onClick={onCancel}
        >
          Cancel
        </button>
      </DialogFooter>
      {/* Category Picker Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="bg-slate-900 text-white border-none rounded-2xl shadow-2xl max-w-md w-[95vw] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl font-bold mb-2">Choose Category</DialogTitle>
            <DialogDescription>Select a category for this expense.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 px-6 pb-6">
            {EXPENSE_CATEGORIES.map(cat => (
              <button
                key={cat.name}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800 hover:bg-blue-800 text-lg font-medium transition-colors"
                onClick={() => {
                  setTag(cat.name);
                  setShowCategoryDialog(false);
                }}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
            <div className="mt-2">
              <input
                className="w-full rounded-lg bg-slate-700 border border-blue-700/40 px-4 py-2 text-white placeholder-blue-200/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 outline-none"
                placeholder="Add custom category"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
              />
              <button
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow transition-all"
                onClick={() => {
                  if (customCategory.trim()) {
                    setTag(customCategory.trim());
                    setShowCategoryDialog(false);
                    setCustomCategory('');
                  }
                }}
              >Add Custom Category</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
} 