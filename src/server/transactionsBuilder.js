const normalizeDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  return null;
};

const normalizeAmount = (value) => {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return null;
  return Math.abs(num);
};

const normalizeCategory = (value) => {
  if (!value) return 'uncategorized';
  return value.toString().trim().toLowerCase() || 'uncategorized';
};

const buildTransactionsFromReceipt = (receiptData, receiptId, uid) => {
  const dateValue =
    normalizeDateValue(receiptData?.transactionDate) ||
    normalizeDateValue(receiptData?.date) ||
    normalizeDateValue(receiptData?.createdAt) ||
    new Date();
  const merchant = receiptData?.merchant || 'Unknown';
  const category = normalizeCategory(receiptData?.category);
  const currency = receiptData?.currency || 'EUR';
  const items = Array.isArray(receiptData?.items) ? receiptData.items : [];

  const itemTransactions = items
    .filter((item) => item && item.name && Number.isFinite(parseFloat(item.price)))
    .map((item) => ({
      uid,
      receiptId,
      date: dateValue,
      merchant,
      category,
      amount: normalizeAmount(item.price) || 0,
      currency,
      itemName: item.name,
    }));

  if (itemTransactions.length > 0) {
    return itemTransactions;
  }

  return [
    {
      uid,
      receiptId,
      date: dateValue,
      merchant,
      category,
      amount: normalizeAmount(receiptData?.total) || 0,
      currency,
      itemName: null,
    },
  ];
};

export { buildTransactionsFromReceipt };
