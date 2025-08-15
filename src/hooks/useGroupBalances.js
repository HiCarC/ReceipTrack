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
    let nameToUid = {};
    let uidToName = {};

    const recalcBalances = () => {
      // Collect all UIDs from claimedBy, expenses, and settlements
      const allUids = new Set();
      Object.values(nameToUid).forEach(uid => allUids.add(uid));
      currentExpenses.forEach(exp => {
        if (exp.paidBy) allUids.add(exp.paidBy);
        if (exp.splits) Object.keys(exp.splits).forEach(uid => allUids.add(uid));
      });
      currentSettlements.forEach(s => {
        if (s.from) allUids.add(s.from);
        if (s.to) allUids.add(s.to);
      });
      // Initialize balances
      const working = {};
      allUids.forEach(uid => { working[uid] = 0; });
      // Process expenses (Tricount/ledger logic: payer + (total - their share), each participant -share)
      for (const exp of currentExpenses) {
        const total = roundCents(parseFloat(exp.amount) || 0);
        const paidBy = exp.paidBy;
        const splits = normalizeSplitsToTotal(exp.splits || {}, total);
        Object.entries(splits).forEach(([uid, amount]) => {
          const amt = roundCents(parseFloat(amount) || 0);
          if (!isNaN(amt)) working[uid] = roundCents(working[uid] - amt);
        });
        if (paidBy) working[paidBy] = roundCents(working[paidBy] + total);
      }
      // Process settlements, but ignore those that have a matching reimbursement expense
      // Build a set of reimbursement keys: `${from}_${to}_${amount}_${date}`
      const reimbursementKeys = new Set();
      for (const exp of currentExpenses) {
        if (exp.expenseType === 'reimbursement' && exp.paidBy && exp.splits) {
          const toUid = Object.keys(exp.splits)[0];
          const amt = parseFloat(exp.amount);
          const date = exp.date || '';
          reimbursementKeys.add(`${exp.paidBy}_${toUid}_${amt}_${date}`);
        }
      }
      for (const s of currentSettlements) {
        const { from, to, amount, settled, settledAt } = s;
        if (!settled || !from || !to || !amount) continue;
        const amt = parseFloat(amount);
        // Try to match by from, to, amount, and date (if available)
        let date = '';
        if (settledAt && settledAt.toDate) {
          // Firestore Timestamp
          date = settledAt.toDate().toISOString().slice(0,10);
        }
        // If a reimbursement expense exists for this settlement, skip it
        if (reimbursementKeys.has(`${from}_${to}_${amt}_${date}`)) continue;
        if (!isNaN(amt)) {
          working[from] = roundCents(working[from] + amt);
          working[to] = roundCents(working[to] - amt);
        }
      }
      // Map to names, always include all UIDs
      const finalBalances = {};
      let sum = 0;
      allUids.forEach(uid => {
        const name = uidToName[uid] || uid;
        let value = roundCents(working[uid] || 0);
        if (Math.abs(value) < 0.005) value = 0.00;
        finalBalances[name] = value;
        sum += value;
      });
      // Ensure exact zero sum by adjusting the largest absolute balance
      if (Math.abs(sum) >= 0.005) {
        let maxKey = Object.keys(finalBalances)[0];
        let maxAbs = Math.abs(finalBalances[maxKey]);
        Object.entries(finalBalances).forEach(([k, v]) => {
          if (Math.abs(v) > maxAbs) { maxKey = k; maxAbs = Math.abs(v); }
        });
        finalBalances[maxKey] = roundCents(finalBalances[maxKey] - sum);
      }
      setBalances(finalBalances);
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
        uidToName = Object.fromEntries(
          Object.entries(nameToUid).map(([name, uid]) => [uid, name])
        );
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