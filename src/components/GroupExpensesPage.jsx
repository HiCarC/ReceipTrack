import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

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

export default function GroupExpensesPage({ group, onBack, initialTab }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { groupId } = useParams();
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
    try {
      await deleteDoc(doc(db, 'groups', group.id, 'expenses', editExpense.id));
      setEditExpense(null);
    } catch (err) {
      setError('Failed to delete expense');
    }
  };

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
          {/* TODO: Balances and Photos tabs */}
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
          {/* Sticky header */}
          <DialogHeader className="px-4 md:px-6 pt-6 pb-2 bg-slate-900 z-10 sticky top-0">
            <DialogTitle className="text-2xl font-bold mb-1">Edit Expense</DialogTitle>
            <DialogDescription>Edit the details below and save your changes.</DialogDescription>
          </DialogHeader>
          {/* Scrollable form content */}
          <div className="flex-1 overflow-y-auto px-0" style={{ maxHeight: '60vh' }}>
            {editExpense ? (
              <EditExpenseForm
                editExpense={editExpense}
                group={group}
                user={user}
                onSave={handleEditSave}
                onDelete={handleEditDelete}
                onCancel={() => setEditExpense(null)}
              />
            ) : null}
          </div>
          {/* Sticky footer for actions (handled inside EditExpenseForm) */}
        </DialogContent>
      </Dialog>
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