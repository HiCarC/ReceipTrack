export const buildDaySections = (receipts, normalizeToLocalMidnight) => {
  const getDayLabel = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const sortedReceipts = [...receipts].sort((a, b) => {
    const dateA = normalizeToLocalMidnight(a.transactionDate || a.date);
    const dateB = normalizeToLocalMidnight(b.transactionDate || b.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });

  const receiptsByDay = {};
  const dayOrder = [];
  sortedReceipts.forEach((receipt) => {
    const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
    if (!date) return;
    const key = date.toDateString();
    if (!receiptsByDay[key]) {
      receiptsByDay[key] = { label: getDayLabel(date), receipts: [] };
      dayOrder.push(key);
    }
    receiptsByDay[key].receipts.push(receipt);
  });

  return dayOrder.map((key) => receiptsByDay[key]);
};

export const groupReceiptsByMonth = (receipts, normalizeToLocalMidnight) => {
  const sortedReceipts = [...receipts].sort((a, b) => {
    const dateA = normalizeToLocalMidnight(a.transactionDate || a.date);
    const dateB = normalizeToLocalMidnight(b.transactionDate || b.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });

  const groupedReceipts = sortedReceipts.reduce((groups, receipt) => {
    const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
    if (!date) return groups;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[monthKey]) {
      groups[monthKey] = {
        month: date.getMonth(),
        year: date.getFullYear(),
        receipts: [],
      };
    }
    groups[monthKey].receipts.push(receipt);
    return groups;
  }, {});

  const sortedMonths = Object.keys(groupedReceipts).sort((a, b) => b.localeCompare(a));
  return { groupedReceipts, sortedMonths };
};
