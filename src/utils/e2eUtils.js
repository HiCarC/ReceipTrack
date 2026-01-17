const STORE_KEY = 'e2e_store_v1';

const defaultStore = () => {
  const now = Date.now();
  return {
    receipts: [
      {
        id: 'e2e-receipt-1',
        userId: 'e2e-user',
        merchant: 'Sample Cafe',
        total: 12.5,
        subtotal: 12.5,
        tax: 0,
        paymentMethod: 'Card',
        currency: 'EUR',
        date: new Date(now).toISOString().slice(0, 10),
        transactionDate: new Date(now).toISOString(),
        category: 'Food & Dining',
        items: [],
        createdAtMs: now,
      },
    ],
    groups: [
      {
        id: 'e2e-group-1',
        name: 'E2E Dinner Club',
        currency: 'EUR',
        participants: ['E2E User', 'Alex'],
        claimedBy: { 'E2E User': 'e2e-user', Alex: 'e2e-alex' },
        createdBy: 'e2e-user',
        createdAtMs: now,
        memberUids: ['e2e-user'],
      },
    ],
    groupExpenses: {
      'e2e-group-1': [
        {
          id: 'e2e-expense-1',
          label: 'Welcome Dinner',
          amount: 32,
          paidBy: 'e2e-user',
          date: new Date(now).toISOString().slice(0, 10),
          createdBy: 'e2e-user',
          createdAtMs: now,
          expenseType: 'expense',
          currency: 'EUR',
          splitType: 'equally',
          splits: { 'e2e-user': 16, 'e2e-alex': 16 },
          shares: { 'e2e-user': 1, 'e2e-alex': 1 },
          splitEnabled: true,
          note: '',
          items: [],
        },
      ],
    },
  };
};

export const isE2E = () => import.meta.env.VITE_E2E === 'true';

export const getE2EUser = () => ({
  uid: 'e2e-user',
  displayName: 'E2E User',
  email: 'e2e@example.com',
  photoURL: '',
  settings: {
    appearance: 'dark',
    baseCurrency: 'EUR',
  },
});

const loadStore = () => {
  if (typeof window === 'undefined') {
    return defaultStore();
  }
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      const initial = defaultStore();
      window.localStorage.setItem(STORE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (error) {
    const fallback = defaultStore();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(fallback));
    }
    return fallback;
  }
};

const saveStore = (next) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
};

const withTimestamp = (record) => {
  if (!record || record.createdAtMs) return record;
  return { ...record, createdAtMs: Date.now() };
};

export const getE2EReceipts = (userId) => {
  const store = loadStore();
  return (store.receipts || [])
    .filter((receipt) => !userId || receipt.userId === userId)
    .map((receipt) => ({ ...receipt }));
};

export const setE2EReceipts = (nextReceipts) => {
  const store = loadStore();
  store.receipts = nextReceipts.map(withTimestamp);
  saveStore(store);
};

export const addE2EReceipt = (receipt) => {
  const store = loadStore();
  const next = { ...withTimestamp(receipt) };
  store.receipts = [...(store.receipts || []), next];
  saveStore(store);
  return next;
};

export const updateE2EReceipt = (receiptId, updates) => {
  const store = loadStore();
  store.receipts = (store.receipts || []).map((receipt) =>
    receipt.id === receiptId ? { ...receipt, ...updates } : receipt
  );
  saveStore(store);
};

export const deleteE2EReceipt = (receiptId) => {
  const store = loadStore();
  store.receipts = (store.receipts || []).filter((receipt) => receipt.id !== receiptId);
  saveStore(store);
};

export const getE2EGroups = () => {
  const store = loadStore();
  return (store.groups || []).map((group) => ({ ...group }));
};

export const addE2EGroup = (group) => {
  const store = loadStore();
  const next = { ...withTimestamp(group) };
  store.groups = [...(store.groups || []), next];
  saveStore(store);
  return next;
};

export const updateE2EGroup = (groupId, updates) => {
  const store = loadStore();
  store.groups = (store.groups || []).map((group) =>
    group.id === groupId ? { ...group, ...updates } : group
  );
  saveStore(store);
};

export const getE2EGroupExpenses = (groupId) => {
  const store = loadStore();
  return (store.groupExpenses?.[groupId] || []).map((expense) => ({ ...expense }));
};

export const addE2EGroupExpense = (groupId, expense) => {
  const store = loadStore();
  const next = { ...withTimestamp(expense) };
  const current = store.groupExpenses?.[groupId] || [];
  store.groupExpenses = { ...store.groupExpenses, [groupId]: [...current, next] };
  saveStore(store);
  return next;
};

export const updateE2EGroupExpense = (groupId, expenseId, updates) => {
  const store = loadStore();
  const current = store.groupExpenses?.[groupId] || [];
  store.groupExpenses = {
    ...store.groupExpenses,
    [groupId]: current.map((expense) =>
      expense.id === expenseId ? { ...expense, ...updates } : expense
    ),
  };
  saveStore(store);
};

export const deleteE2EGroupExpense = (groupId, expenseId) => {
  const store = loadStore();
  const current = store.groupExpenses?.[groupId] || [];
  store.groupExpenses = {
    ...store.groupExpenses,
    [groupId]: current.filter((expense) => expense.id !== expenseId),
  };
  saveStore(store);
};
