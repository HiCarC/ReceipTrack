import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";

// Round to cents using banker's rounding to minimize drift
function roundCents(value) {
  const scaled = value * 100;
  const floored = Math.floor(scaled);
  const fraction = scaled - floored;
  if (fraction > 0.5) return (floored + 1) / 100;
  if (fraction < 0.5) return floored / 100;
  return (floored % 2 === 0 ? floored : floored + 1) / 100;
}

// Normalize splits so their rounded sum equals the (rounded) total
function normalizeSplitsToTotal(rawSplits, total) {
  const entries = Object.entries(rawSplits).map(([uid, amt]) => [uid, parseFloat(amt) || 0]);
  if (entries.length === 0) return {};
  const rounded = entries.map(([uid, amt]) => [uid, roundCents(amt)]);
  const sum = rounded.reduce((s, [, v]) => s + v, 0);
  const target = roundCents(total);
  const diff = target - sum;
  if (Math.abs(diff) < 0.005) return Object.fromEntries(rounded);
  let maxIdx = 0;
  let maxAbs = Math.abs(rounded[0][1]);
  for (let i = 1; i < rounded.length; i++) {
    const v = Math.abs(rounded[i][1]);
    if (v > maxAbs) { maxAbs = v; maxIdx = i; }
  }
  rounded[maxIdx][1] = roundCents(rounded[maxIdx][1] + diff);
  return Object.fromEntries(rounded);
}

function normalizeSplitKeys(rawSplits, nameToUid) {
  const merged = {};
  Object.entries(rawSplits || {}).forEach(([key, amt]) => {
    const resolved = nameToUid[key] || key;
    const value = parseFloat(amt) || 0;
    merged[resolved] = (merged[resolved] || 0) + value;
  });
  return merged;
}

function resolveNameKey(key, nameToUid) {
  return nameToUid[key] || key;
}

function computeBalances(expenses, settlements, claimedBy) {
  const nameToUid = claimedBy || {};
  const uidToName = Object.fromEntries(
    Object.entries(nameToUid).map(([name, uid]) => [uid, name])
  );

  const allUids = new Set();
  Object.values(nameToUid).forEach(uid => allUids.add(uid));
  expenses.forEach(exp => {
    if (exp.paidBy) allUids.add(resolveNameKey(exp.paidBy, nameToUid));
    const normalizedSplits = normalizeSplitKeys(exp.splits || {}, nameToUid);
    Object.keys(normalizedSplits).forEach(uid => allUids.add(uid));
  });
  settlements.forEach(s => {
    if (s.from) allUids.add(resolveNameKey(s.from, nameToUid));
    if (s.to) allUids.add(resolveNameKey(s.to, nameToUid));
  });

  const working = {};
  allUids.forEach(uid => { working[uid] = 0; });

  for (const exp of expenses) {
    const total = roundCents(parseFloat(exp.amount) || 0);
    const paidBy = resolveNameKey(exp.paidBy, nameToUid);
    const splits = normalizeSplitsToTotal(
      normalizeSplitKeys(exp.splits || {}, nameToUid),
      total
    );
    Object.entries(splits).forEach(([uid, amount]) => {
      const amt = roundCents(parseFloat(amount) || 0);
      if (!isNaN(amt)) working[uid] = roundCents(working[uid] - amt);
    });
    if (paidBy) working[paidBy] = roundCents(working[paidBy] + total);
  }

  const reimbursementKeys = new Set();
  for (const exp of expenses) {
    if (exp.expenseType === 'reimbursement' && exp.paidBy && exp.splits) {
      const normalizedSplits = normalizeSplitKeys(exp.splits, nameToUid);
      const toUid = Object.keys(normalizedSplits)[0];
      const amt = parseFloat(exp.amount);
      const date = exp.date || '';
      reimbursementKeys.add(`${resolveNameKey(exp.paidBy, nameToUid)}_${toUid}_${amt}_${date}`);
    }
  }

  for (const s of settlements) {
    const { from, to, amount, settled, settledAt } = s;
    if (!settled || !from || !to || !amount) continue;
    const amt = parseFloat(amount);
    const resolvedFrom = resolveNameKey(from, nameToUid);
    const resolvedTo = resolveNameKey(to, nameToUid);
    let date = '';
    if (settledAt && settledAt.toDate) {
      date = settledAt.toDate().toISOString().slice(0,10);
    }
    if (reimbursementKeys.has(`${resolvedFrom}_${resolvedTo}_${amt}_${date}`)) continue;
    if (!isNaN(amt)) {
      working[resolvedFrom] = roundCents(working[resolvedFrom] + amt);
      working[resolvedTo] = roundCents(working[resolvedTo] - amt);
    }
  }

  const finalBalances = {};
  let sum = 0;
  allUids.forEach(uid => {
    const name = uidToName[uid] || uid;
    let value = roundCents(working[uid] || 0);
    if (Math.abs(value) < 0.005) value = 0.00;
    finalBalances[name] = value;
    sum += value;
  });

  if (Math.abs(sum) >= 0.005) {
    let maxKey = Object.keys(finalBalances)[0];
    let maxAbs = Math.abs(finalBalances[maxKey]);
    Object.entries(finalBalances).forEach(([k, v]) => {
      if (Math.abs(v) > maxAbs) { maxKey = k; maxAbs = Math.abs(v); }
    });
    finalBalances[maxKey] = roundCents(finalBalances[maxKey] - sum);
  }

  return finalBalances;
}

export default function useGroupBalances(groupId) {
  const { user } = useAuth();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !groupId) return;
    setLoading(true);
    setError(null);

    const groupRef = doc(db, "groups", groupId);
    const expensesRef = collection(db, "groups", groupId, "expenses");
    const settlementsRef = collection(db, "groups", groupId, "settlements");

    let unsubscribeExpenses = null;
    let unsubscribeSettlements = null;
    let currentExpenses = [];
    let currentSettlements = [];
    const recalcBalances = () => {
      setBalances(computeBalances(currentExpenses, currentSettlements, nameToUid));
      setLoading(false);
    };

    const loadData = async () => {
      try {
        const groupSnap = await getDoc(groupRef);
        if (!groupSnap.exists()) {
          setError("Group not found.");
          setLoading(false);
          return;
        }
        const groupData = groupSnap.data();
        nameToUid = groupData?.claimedBy || {};
        // Subscribe to expenses
        unsubscribeExpenses = onSnapshot(expensesRef, (expenseSnap) => {
          currentExpenses = expenseSnap.docs.map((doc) => doc.data());
          recalcBalances();
        });
        // Subscribe to settlements
        unsubscribeSettlements = onSnapshot(settlementsRef, (settleSnap) => {
          currentSettlements = settleSnap.docs.map((doc) => doc.data());
          recalcBalances();
        });
      } catch (err) {
        setError("Error loading balances.");
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribeExpenses) unsubscribeExpenses();
      if (unsubscribeSettlements) unsubscribeSettlements();
    };
  }, [user, groupId]);

  return { balances, loading, error };
}

export const _test = {
  roundCents,
  normalizeSplitsToTotal,
  normalizeSplitKeys,
  resolveNameKey,
  computeBalances,
};
