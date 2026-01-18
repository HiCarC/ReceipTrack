const GENERIC_TERMS = new Set([
  '',
  'spend',
  'spending',
  'total',
  'all',
  'overall',
  'everything',
]);

const normalizeTerm = (term) => {
  if (!term) return '';
  return term.toString().trim().toLowerCase();
};

const isGenericTerm = (normalizedTerm) => GENERIC_TERMS.has(normalizedTerm);

const parseDateInput = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalDate = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getReceiptDate = (receipt) => {
  const raw = receipt.transactionDate || receipt.date || receipt.createdAt;
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLocationField = (receipt, field) => {
  if (!receipt) return '';
  const parsed = receipt.addressParsed || receipt.addressComponents || {};
  const place = receipt.place || {};
  if (field === 'city') return parsed.city || parsed.town || parsed.village || '';
  if (field === 'country') return parsed.country || parsed.country_code || '';
  if (field === 'state') return parsed.state || parsed.region || '';
  if (field === 'display_name') return place.display_name || receipt.addressFromOCR || '';
  return '';
};

const resolveRange = (filters, now = new Date()) => {
  if (filters?.date_start || filters?.date_end) {
    const start = parseDateInput(filters.date_start);
    const end = parseDateInput(filters.date_end);
    if (start && end) {
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }

  if (filters?.year) {
    const year = Number(filters.year);
    if (Number.isFinite(year)) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
  }

  if (filters?.month) {
    const year = Number(filters.year) || now.getFullYear();
    const monthIndex = Number(filters.month) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) {
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
  }

  if (filters?.period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  if (filters?.period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  return null;
};

const parseArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const buildGroupKey = (receipt, groupBy) => {
  if (groupBy === 'category') return receipt.category || 'Uncategorized';
  if (groupBy === 'merchant') return receipt.merchant || 'Unknown';
  if (groupBy === 'payment_method') return receipt.paymentMethod || 'Unknown';
  if (groupBy === 'currency') return receipt.currency || 'Unknown';
  if (groupBy === 'city') return getLocationField(receipt, 'city') || 'Unknown';
  if (groupBy === 'country') return getLocationField(receipt, 'country') || 'Unknown';
  if (groupBy === 'state') return getLocationField(receipt, 'state') || 'Unknown';
  if (groupBy === 'weekday') {
    const date = getReceiptDate(receipt);
    return date ? date.toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown';
  }
  if (groupBy === 'month') {
    const date = getReceiptDate(receipt);
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'Unknown';
  }
  return 'Unknown';
};

const matchesTerm = (receipt, normalizedTerm) => {
  if (isGenericTerm(normalizedTerm)) return true;
  const merchant = receipt.merchant ? receipt.merchant.toString().toLowerCase() : '';
  const category = receipt.category ? receipt.category.toString().toLowerCase() : '';
  const note = receipt.note ? receipt.note.toString().toLowerCase() : '';
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const itemMatch = items.some((item) =>
    item?.name?.toString().toLowerCase().includes(normalizedTerm)
  );
  return (
    merchant.includes(normalizedTerm) ||
    category === normalizedTerm ||
    note.includes(normalizedTerm) ||
    itemMatch
  );
};

const applyMessageHints = (message, args, now = new Date()) => {
  const text = message.toLowerCase();
  const next = {
    ...(args || {}),
    filters: { ...(args?.filters || {}) },
  };

  if (text.includes('this year')) {
    next.filters.period = 'year';
    next.filters.year = now.getFullYear();
    delete next.filters.date_start;
    delete next.filters.date_end;
  } else if (text.includes('last year')) {
    next.filters.period = 'year';
    next.filters.year = now.getFullYear() - 1;
    delete next.filters.date_start;
    delete next.filters.date_end;
  } else if (text.includes('this month')) {
    next.filters.period = 'month';
    next.filters.year = now.getFullYear();
    next.filters.month = now.getMonth() + 1;
    delete next.filters.date_start;
    delete next.filters.date_end;
  } else if (text.includes('last month')) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    next.filters.period = 'month';
    next.filters.year = lastMonth.getFullYear();
    next.filters.month = lastMonth.getMonth() + 1;
    delete next.filters.date_start;
    delete next.filters.date_end;
  } else if (text.includes('this week')) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    next.filters.date_start = formatLocalDate(start);
    next.filters.date_end = formatLocalDate(end);
  }

  const groupBy = new Set(parseArray(next.group_by));
  const wantsLocation = text.includes('where') || text.includes('location') || text.includes('city') || text.includes('country');
  const wantsMost = text.includes('most') || text.includes('biggest') || text.includes('highest');
  if (text.includes('category') || text.includes('categories') || text.includes('breakdown') || text.includes('in what')) {
    groupBy.add('category');
  }
  if (text.includes('merchant') || text.includes('store')) {
    groupBy.add('merchant');
  }
  if (wantsLocation) {
    groupBy.add('city');
  }
  if ((wantsMost || text.includes('where')) && !wantsLocation) {
    groupBy.add('merchant');
  }

  if (groupBy.size) {
    next.group_by = Array.from(groupBy);
  }

  const metrics = new Set(parseArray(next.metrics));
  metrics.add('total');
  metrics.add('count');
  if (text.includes('tax')) metrics.add('tax_total');
  next.metrics = Array.from(metrics);

  if (!next.sort && next.group_by && next.group_by.length) {
    next.sort = { metric: 'total', direction: 'desc' };
  }
  if (!Number.isFinite(Number(next.limit)) && next.group_by && next.group_by.length) {
    next.limit = 5;
  }

  if (!next.filters.period && !next.filters.date_start && !next.filters.year && !next.filters.month) {
    next.filters.period = 'month';
  }

  return next;
};

const aggregateReceipts = ({ receipts, args, defaultCurrency }) => {
  const filters = args?.filters || {};
  const termInput = filters?.term || args?.term || 'spending';
  const normalizedTerm = normalizeTerm(termInput);
  const term = isGenericTerm(normalizedTerm) ? 'total spending' : termInput;
  const range = resolveRange(filters);

  const filterCategories = parseArray(filters?.category).map((value) => value.toString().toLowerCase());
  const filterMerchants = parseArray(filters?.merchant).map((value) => value.toString().toLowerCase());
  const filterPayment = parseArray(filters?.payment_method).map((value) => value.toString().toLowerCase());
  const filterCurrency = parseArray(filters?.currency).map((value) => value.toString().toUpperCase());
  const filterGroupId = filters?.group_id ? filters.group_id.toString() : null;
  const locationCity = filters?.location_city ? filters.location_city.toString().toLowerCase() : null;
  const locationCountry = filters?.location_country ? filters.location_country.toString().toLowerCase() : null;
  const locationState = filters?.location_state ? filters.location_state.toString().toLowerCase() : null;

  const minAmountFilter = Number.isFinite(Number(filters?.min_amount)) ? Number(filters.min_amount) : null;
  const maxAmountFilter = Number.isFinite(Number(filters?.max_amount)) ? Number(filters.max_amount) : null;

  const groupBy = parseArray(args?.group_by);
  const currencyTotals = {};
  const taxTotals = {};
  const groupTotals = {};
  let count = 0;
  let totalSum = 0;
  let minAmount = null;
  let maxAmount = null;
  let sinceDate = null;

  receipts.forEach((receipt) => {
    const receiptCurrency = (receipt.currency || defaultCurrency || 'EUR').toUpperCase();
    const amount = Math.abs(parseFloat(receipt.total) || 0);
    const taxAmount = Math.abs(parseFloat(receipt.tax) || 0);
    const date = getReceiptDate(receipt);

    if (date && !Number.isNaN(date.getTime())) {
      if (!sinceDate || date < sinceDate) sinceDate = date;
    }

    if (range && date) {
      if (date < range.start || date > range.end) return;
    }

    if (!matchesTerm(receipt, normalizedTerm)) return;
    if (filterCategories.length && !filterCategories.includes((receipt.category || '').toString().toLowerCase())) return;
    if (filterMerchants.length && !filterMerchants.some((value) => (receipt.merchant || '').toString().toLowerCase().includes(value))) return;
    if (filterPayment.length && !filterPayment.includes((receipt.paymentMethod || '').toString().toLowerCase())) return;
    if (filterCurrency.length && !filterCurrency.includes(receiptCurrency)) return;
    if (filterGroupId && receipt.groupId !== filterGroupId) return;
    if (filters?.is_group_expense !== undefined && !!receipt.isGroupExpense !== !!filters.is_group_expense) return;
    if (filters?.has_tax !== undefined) {
      const hasTax = taxAmount > 0;
      if (hasTax !== !!filters.has_tax) return;
    }
    if (minAmountFilter !== null && amount < minAmountFilter) return;
    if (maxAmountFilter !== null && amount > maxAmountFilter) return;
    if (locationCity) {
      const city = getLocationField(receipt, 'city').toString().toLowerCase();
      if (!city.includes(locationCity)) return;
    }
    if (locationCountry) {
      const country = getLocationField(receipt, 'country').toString().toLowerCase();
      if (!country.includes(locationCountry)) return;
    }
    if (locationState) {
      const state = getLocationField(receipt, 'state').toString().toLowerCase();
      if (!state.includes(locationState)) return;
    }

    count += 1;
    totalSum += amount;
    minAmount = minAmount === null ? amount : Math.min(minAmount, amount);
    maxAmount = maxAmount === null ? amount : Math.max(maxAmount, amount);

    currencyTotals[receiptCurrency] = (currencyTotals[receiptCurrency] || 0) + amount;
    taxTotals[receiptCurrency] = (taxTotals[receiptCurrency] || 0) + taxAmount;

    if (groupBy.length) {
      groupBy.forEach((group) => {
        const key = buildGroupKey(receipt, group);
        const mapKey = `${group}:${key}`;
        if (!groupTotals[mapKey]) {
          groupTotals[mapKey] = {
            group,
            key,
            total: 0,
            count: 0,
            tax_total: 0,
          };
        }
        groupTotals[mapKey].total += amount;
        groupTotals[mapKey].count += 1;
        groupTotals[mapKey].tax_total += taxAmount;
      });
    }
  });

  const groupings = Object.values(groupTotals).map((entry) => ({
    ...entry,
    avg: entry.count ? entry.total / entry.count : 0,
  }));

  const sortMetric = args?.sort?.metric || 'total';
  const sortDirection = args?.sort?.direction === 'asc' ? 'asc' : 'desc';
  groupings.sort((a, b) => {
    const delta = (a[sortMetric] || 0) - (b[sortMetric] || 0);
    return sortDirection === 'asc' ? delta : -delta;
  });

  const limit = Number.isFinite(Number(args?.limit)) ? Number(args.limit) : null;
  const limitedGroupings = limit ? groupings.slice(0, limit) : groupings;
  const currencies = Object.keys(currencyTotals);
  const multiCurrency = currencies.length > 1;
  const baseCurrencyTotal = currencyTotals[defaultCurrency] || 0;

  return {
    currency: defaultCurrency,
    summary: {
      total: multiCurrency ? baseCurrencyTotal : totalSum,
      count,
      avg: count ? totalSum / count : null,
      min: minAmount,
      max: maxAmount,
      tax_total: multiCurrency
        ? (taxTotals[defaultCurrency] || 0)
        : Object.values(taxTotals).reduce((sum, value) => sum + value, 0),
      multi_currency: multiCurrency,
    },
    currency_totals: currencyTotals,
    tax_totals: taxTotals,
    group_by: groupBy,
    groupings: limitedGroupings,
    since: formatLocalDate(sinceDate),
    term,
    range: range
      ? { start: formatLocalDate(range.start), end: formatLocalDate(range.end) }
      : null,
    filters: {
      ...filters,
      term,
    },
  };
};

const getCurrencySymbol = (code) => {
  switch (code) {
    case 'USD':
      return '$';
    default:
      return code ? `${code} ` : '';
  }
};

const formatMoney = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  return amount.toFixed(2);
};

const renderGroupings = (summary, message) => {
  if (!summary?.groupings?.length) return '';
  const group = summary.group_by?.[0] || 'category';
  const label =
    group === 'merchant'
      ? 'Top merchants'
      : group === 'city'
        ? 'Top cities'
        : group === 'country'
          ? 'Top countries'
          : group === 'payment_method'
            ? 'Top payment methods'
            : group === 'weekday'
              ? 'Top days'
              : group === 'month'
                ? 'Top months'
                : 'Top categories';
  const symbol = getCurrencySymbol(summary.currency);
  const top = summary.groupings.slice(0, 5).map((entry) => `${entry.key} ${symbol}${formatMoney(entry.total)}`);
  const joiner = top.length > 3 ? '; ' : ', ';
  return `${label}: ${top.join(joiner)}.`;
};

const buildResponseText = (summary, message = '') => {
  if (!summary) return 'I could not summarize your spend yet.';
  const symbol = getCurrencySymbol(summary.currency);
  const total = formatMoney(summary.summary?.total || 0);
  const count = summary.summary?.count || 0;
  const rangeText = summary.range
    ? `From ${summary.range.start} to ${summary.range.end}`
    : 'For the selected period';
  const baseLine = `${rangeText}, you spent ${symbol}${total} on ${summary.term} across ${count} receipts.`;
  const groupingLine = renderGroupings(summary, message);
  const taxLine =
    summary.summary?.tax_total && summary.summary.tax_total > 0
      ? `Estimated tax total: ${symbol}${formatMoney(summary.summary.tax_total)}.`
      : '';
  return [baseLine, groupingLine, taxLine].filter(Boolean).join(' ');
};

export {
  aggregateReceipts,
  applyMessageHints,
  buildResponseText,
  normalizeTerm,
  isGenericTerm,
  parseDateInput,
  resolveRange,
  getReceiptDate,
};
