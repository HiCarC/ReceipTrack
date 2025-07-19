import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";

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
      const balances = {};
      allUids.forEach(uid => { balances[uid] = 0; });
      // Process expenses
      for (const exp of currentExpenses) {
        const total = parseFloat(exp.amount) || 0;
        const paidBy = exp.paidBy;
        const splits = exp.splits || {};
        if (paidBy) balances[paidBy] += total;
        Object.entries(splits).forEach(([uid, amount]) => {
          const amt = parseFloat(amount || 0);
          if (!isNaN(amt)) balances[uid] -= amt;
        });
      }
      // Process settlements
      for (const s of currentSettlements) {
        const { from, to, amount, settled } = s;
        if (!settled || !from || !to || !amount) continue;
        const amt = parseFloat(amount);
        if (!isNaN(amt)) {
          balances[from] += amt;
          balances[to] -= amt;
        }
      }
      // Map to names, always include all UIDs
      const finalBalances = {};
      let sum = 0;
      allUids.forEach(uid => {
        const name = uidToName[uid] || uid;
        let value = balances[uid];
        if (typeof value !== 'number' || isNaN(value)) value = 0.00;
        // Fix floating point precision: treat near-zero as zero
        value = Math.abs(value) < 0.01 ? 0.00 : Math.round((value + Number.EPSILON) * 100) / 100;
        finalBalances[name] = value;
        sum += value;
      });
      // If the sum is near zero, distribute the error to the largest (absolute) balance
      if (Math.abs(sum) < 0.01 && Object.keys(finalBalances).length > 0) {
        // Find the key with the largest absolute value
        let maxKey = Object.keys(finalBalances)[0];
        let maxAbs = Math.abs(finalBalances[maxKey]);
        Object.entries(finalBalances).forEach(([k, v]) => {
          if (Math.abs(v) > maxAbs) {
            maxKey = k;
            maxAbs = Math.abs(v);
          }
        });
        finalBalances[maxKey] = Math.round((finalBalances[maxKey] - sum + Number.EPSILON) * 100) / 100;
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