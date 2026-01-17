const COUNTRY_RATES = {
  AD: { standard: 0.045, reduced: 0.01, dining: 0.045 },
  AE: { standard: 0.05, reduced: 0.0, dining: 0.05 },
  AL: { standard: 0.20, reduced: 0.06, dining: 0.20 },
  AM: { standard: 0.20, reduced: 0.10, dining: 0.20 },
  AR: { standard: 0.21, reduced: 0.105, dining: 0.21 },
  AT: { standard: 0.20, reduced: 0.10, dining: 0.10 },
  AU: { standard: 0.10, reduced: 0.0, dining: 0.10 },
  AZ: { standard: 0.18, reduced: 0.10, dining: 0.18 },
  BA: { standard: 0.17, reduced: 0.0, dining: 0.17 },
  BD: { standard: 0.15, reduced: 0.05, dining: 0.15 },
  BE: { standard: 0.21, reduced: 0.06, dining: 0.12 },
  BG: { standard: 0.20, reduced: 0.09, dining: 0.20 },
  BH: { standard: 0.10, reduced: 0.0, dining: 0.10 },
  BN: { standard: 0.0, reduced: 0.0, dining: 0.0 },
  BO: { standard: 0.13, reduced: 0.0, dining: 0.13 },
  BR: { standard: 0.12, reduced: 0.07, dining: 0.12 },
  BY: { standard: 0.20, reduced: 0.10, dining: 0.20 },
  CA: { standard: 0.05, reduced: 0.0, dining: 0.05 },
  CH: { standard: 0.081, reduced: 0.026, dining: 0.038 },
  CL: { standard: 0.19, reduced: 0.0, dining: 0.19 },
  CN: { standard: 0.13, reduced: 0.09, dining: 0.13 },
  CO: { standard: 0.19, reduced: 0.05, dining: 0.19 },
  CR: { standard: 0.13, reduced: 0.04, dining: 0.13 },
  CY: { standard: 0.19, reduced: 0.09, dining: 0.09 },
  CZ: { standard: 0.21, reduced: 0.12, dining: 0.12 },
  DE: { standard: 0.19, reduced: 0.07, dining: 0.19 },
  DK: { standard: 0.25, reduced: 0.25, dining: 0.25 },
  DO: { standard: 0.18, reduced: 0.0, dining: 0.18 },
  DZ: { standard: 0.19, reduced: 0.09, dining: 0.19 },
  EC: { standard: 0.12, reduced: 0.0, dining: 0.12 },
  EE: { standard: 0.22, reduced: 0.09, dining: 0.09 },
  EG: { standard: 0.14, reduced: 0.0, dining: 0.14 },
  ES: { standard: 0.21, reduced: 0.10, dining: 0.10 },
  FI: { standard: 0.24, reduced: 0.14, dining: 0.14 },
  FR: { standard: 0.20, reduced: 0.055, dining: 0.10 },
  GB: { standard: 0.20, reduced: 0.05, dining: 0.20 },
  GE: { standard: 0.18, reduced: 0.0, dining: 0.18 },
  GH: { standard: 0.15, reduced: 0.0, dining: 0.15 },
  GR: { standard: 0.24, reduced: 0.13, dining: 0.13 },
  GT: { standard: 0.12, reduced: 0.0, dining: 0.12 },
  HK: { standard: 0.0, reduced: 0.0, dining: 0.0 },
  HR: { standard: 0.25, reduced: 0.13, dining: 0.13 },
  HU: { standard: 0.27, reduced: 0.05, dining: 0.18 },
  ID: { standard: 0.11, reduced: 0.0, dining: 0.11 },
  IE: { standard: 0.23, reduced: 0.13, dining: 0.13 },
  IL: { standard: 0.17, reduced: 0.0, dining: 0.17 },
  IN: { standard: 0.18, reduced: 0.05, dining: 0.05 },
  IS: { standard: 0.24, reduced: 0.11, dining: 0.11 },
  IT: { standard: 0.22, reduced: 0.10, dining: 0.10 },
  JP: { standard: 0.10, reduced: 0.08, dining: 0.10 },
  KE: { standard: 0.16, reduced: 0.0, dining: 0.16 },
  KR: { standard: 0.10, reduced: 0.0, dining: 0.10 },
  KZ: { standard: 0.12, reduced: 0.0, dining: 0.12 },
  LB: { standard: 0.11, reduced: 0.0, dining: 0.11 },
  LK: { standard: 0.15, reduced: 0.0, dining: 0.15 },
  LT: { standard: 0.21, reduced: 0.09, dining: 0.09 },
  LU: { standard: 0.17, reduced: 0.08, dining: 0.08 },
  LV: { standard: 0.21, reduced: 0.12, dining: 0.12 },
  MA: { standard: 0.20, reduced: 0.10, dining: 0.10 },
  MD: { standard: 0.20, reduced: 0.08, dining: 0.20 },
  MK: { standard: 0.18, reduced: 0.05, dining: 0.18 },
  MT: { standard: 0.18, reduced: 0.07, dining: 0.07 },
  MX: { standard: 0.16, reduced: 0.0, dining: 0.16 },
  MY: { standard: 0.10, reduced: 0.0, dining: 0.10 },
  NG: { standard: 0.075, reduced: 0.0, dining: 0.075 },
  NI: { standard: 0.15, reduced: 0.0, dining: 0.15 },
  NL: { standard: 0.21, reduced: 0.09, dining: 0.09 },
  NO: { standard: 0.25, reduced: 0.15, dining: 0.15 },
  NZ: { standard: 0.15, reduced: 0.0, dining: 0.15 },
  OM: { standard: 0.05, reduced: 0.0, dining: 0.05 },
  PA: { standard: 0.07, reduced: 0.0, dining: 0.07 },
  PE: { standard: 0.18, reduced: 0.0, dining: 0.18 },
  PH: { standard: 0.12, reduced: 0.0, dining: 0.12 },
  PK: { standard: 0.17, reduced: 0.0, dining: 0.17 },
  PL: { standard: 0.23, reduced: 0.08, dining: 0.08 },
  PT: { standard: 0.23, reduced: 0.06, dining: 0.13 },
  QA: { standard: 0.05, reduced: 0.0, dining: 0.05 },
  RO: { standard: 0.19, reduced: 0.09, dining: 0.09 },
  RS: { standard: 0.20, reduced: 0.10, dining: 0.20 },
  RU: { standard: 0.20, reduced: 0.10, dining: 0.20 },
  SA: { standard: 0.15, reduced: 0.0, dining: 0.15 },
  SE: { standard: 0.25, reduced: 0.12, dining: 0.12 },
  SG: { standard: 0.08, reduced: 0.0, dining: 0.08 },
  SI: { standard: 0.22, reduced: 0.095, dining: 0.095 },
  SK: { standard: 0.20, reduced: 0.10, dining: 0.10 },
  TH: { standard: 0.07, reduced: 0.0, dining: 0.07 },
  TN: { standard: 0.19, reduced: 0.13, dining: 0.19 },
  TR: { standard: 0.20, reduced: 0.08, dining: 0.08 },
  TW: { standard: 0.05, reduced: 0.0, dining: 0.05 },
  UA: { standard: 0.20, reduced: 0.07, dining: 0.20 },
  UK: { standard: 0.20, reduced: 0.05, dining: 0.20 },
  UY: { standard: 0.22, reduced: 0.10, dining: 0.22 },
  VN: { standard: 0.10, reduced: 0.05, dining: 0.10 },
  ZA: { standard: 0.15, reduced: 0.0, dining: 0.15 },
};

const US_STATE_RATES = {
  CA: 0.0725,
  NY: 0.04,
  TX: 0.0625,
  FL: 0.06,
  IL: 0.0625,
};

const FOOD_KEYWORDS = [
  'bread',
  'milk',
  'egg',
  'eggs',
  'cheese',
  'butter',
  'yogurt',
  'fruit',
  'vegetable',
  'grocery',
  'groceries',
  'bakery',
];

const DINING_KEYWORDS = [
  'restaurant',
  'cafe',
  'coffee',
  'bar',
  'diner',
  'bistro',
  'pizza',
  'burger',
  'food',
];

const normalizeText = (value) => (value || '').toLowerCase();

const inferCountryCode = (receipt) => {
  const cc = receipt?.addressParsed?.country_code;
  if (cc) return cc.toUpperCase();
  const displayName = receipt?.place?.display_name || receipt?.addressRaw || '';
  const text = normalizeText(displayName);
  if (text.includes('france')) return 'FR';
  if (text.includes('germany')) return 'DE';
  if (text.includes('spain')) return 'ES';
  if (text.includes('italy')) return 'IT';
  if (text.includes('portugal')) return 'PT';
  if (text.includes('netherlands') || text.includes('holland')) return 'NL';
  if (text.includes('belgium')) return 'BE';
  if (text.includes('austria')) return 'AT';
  if (text.includes('ireland')) return 'IE';
  if (text.includes('united kingdom') || text.includes('england') || text.includes('scotland')) return 'UK';
  if (text.includes('united states') || text.includes('usa')) return 'US';
  return null;
};

const inferStateCode = (receipt) => {
  const state = receipt?.addressParsed?.state;
  if (state && US_STATE_RATES[state.toUpperCase()]) return state.toUpperCase();
  const displayName = receipt?.place?.display_name || receipt?.addressRaw || '';
  const match = displayName.match(/\b([A-Z]{2})\b/);
  if (match && US_STATE_RATES[match[1]]) return match[1];
  return null;
};

const inferCategoryType = (receipt) => {
  const category = normalizeText(receipt?.category);
  if (category.includes('grocery') || category.includes('groceries') || category.includes('market')) {
    return 'reduced';
  }
  if (category.includes('dining') || category.includes('restaurant') || category.includes('cafe')) {
    return 'dining';
  }
  return 'standard';
};

const itemsSuggestReduced = (receipt) => {
  const items = Array.isArray(receipt?.items) ? receipt.items : [];
  const names = items.map((item) => normalizeText(item?.name));
  return names.some((name) => FOOD_KEYWORDS.some((keyword) => name.includes(keyword)));
};

const itemsSuggestDining = (receipt) => {
  const items = Array.isArray(receipt?.items) ? receipt.items : [];
  const names = items.map((item) => normalizeText(item?.name));
  return names.some((name) => DINING_KEYWORDS.some((keyword) => name.includes(keyword)));
};

export const estimateTaxForReceipt = (receipt, settings) => {
  const directTax = parseFloat(receipt?.tax) || 0;
  if (directTax > 0) {
    return { amount: directTax, isEstimated: false, rateUsed: null };
  }

  const subtotal = parseFloat(receipt?.subtotal) || 0;
  const total = parseFloat(receipt?.total) || 0;
  if (subtotal > 0 && total > subtotal) {
    return { amount: total - subtotal, isEstimated: false, rateUsed: null };
  }

  const baseAmount = subtotal > 0 ? subtotal : total;
  if (!baseAmount) return { amount: 0, isEstimated: false, rateUsed: null };

  const countryCode = inferCountryCode(receipt);
  const categoryType = itemsSuggestDining(receipt)
    ? 'dining'
    : itemsSuggestReduced(receipt)
      ? 'reduced'
      : inferCategoryType(receipt);

  let rate = null;

  if (countryCode === 'US') {
    const stateCode = inferStateCode(receipt);
    if (stateCode) {
      rate = US_STATE_RATES[stateCode] || 0;
    } else {
      rate = 0;
    }
  } else if (countryCode && COUNTRY_RATES[countryCode]) {
    rate = COUNTRY_RATES[countryCode][categoryType] ?? COUNTRY_RATES[countryCode].standard;
  }

  if (rate === null) {
    rate = settings?.taxRates?.standard ?? 0.1;
  }

  const estimatedTax = subtotal > 0 ? baseAmount * rate : (baseAmount * rate) / (1 + rate);
  return { amount: estimatedTax, isEstimated: true, rateUsed: rate };
};
