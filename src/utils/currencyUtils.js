// Major European currencies
export const SUPPORTED_CURRENCIES = {
  EUR: { name: 'Euro', symbol: '€', format: '1.234,56' },
  GBP: { name: 'British Pound', symbol: '£', format: '1,234.56' },
  CHF: { name: 'Swiss Franc', symbol: 'Fr', format: '1\'234.56' },
  SEK: { name: 'Swedish Krona', symbol: 'kr', format: '1 234,56' },
  NOK: { name: 'Norwegian Krone', symbol: 'kr', format: '1 234,56' },
  DKK: { name: 'Danish Krone', symbol: 'kr', format: '1.234,56' },
  PLN: { name: 'Polish Złoty', symbol: 'zł', format: '1 234,56' },
  CZK: { name: 'Czech Koruna', symbol: 'Kč', format: '1 234,56' },
  HUF: { name: 'Hungarian Forint', symbol: 'Ft', format: '1 234' },
  RON: { name: 'Romanian Leu', symbol: 'lei', format: '1.234,56' },
  BGN: { name: 'Bulgarian Lev', symbol: 'лв', format: '1 234,56' },
  HRK: { name: 'Croatian Kuna', symbol: 'kn', format: '1.234,56' },
};

// Cache for exchange rates
let ratesCache = {
  rates: null,
  timestamp: null,
  base: 'EUR'
};

// Fetch exchange rates from the API
export const fetchExchangeRates = async () => {
  // Check if we have valid cached rates (less than 1 hour old)
  const now = Date.now();
  if (ratesCache.rates && ratesCache.timestamp && (now - ratesCache.timestamp < 3600000)) {
    return ratesCache.rates;
  }

  try {
    // Using exchangerate-api.com free API
    const response = await fetch('https://open.er-api.com/v6/latest/EUR');
    const data = await response.json();

    if (data.result === 'success') {
      // Filter only supported currencies
      const filteredRates = Object.keys(data.rates)
        .filter(currency => SUPPORTED_CURRENCIES[currency])
        .reduce((acc, currency) => {
          acc[currency] = data.rates[currency];
          return acc;
        }, {});

      // Update cache
      ratesCache = {
        rates: filteredRates,
        timestamp: now,
        base: 'EUR'
      };

      return filteredRates;
    } else {
      throw new Error('Failed to fetch exchange rates');
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    // Return cached rates if available, otherwise throw error
    if (ratesCache.rates) {
      return ratesCache.rates;
    }
    throw error;
  }
};

// Convert amount from one currency to another
export const convertCurrency = (amount, fromCurrency, toCurrency = 'EUR') => {
  if (!amount || !fromCurrency || fromCurrency === toCurrency) return amount;
  
  const rate = ratesCache.rates?.[fromCurrency];
  if (!rate) return amount;

  return amount / rate;
};

// Format currency amount
export const formatCurrency = (amount, currencyCode = 'EUR') => {
  if (amount === null || amount === undefined) return '';
  
  const currency = SUPPORTED_CURRENCIES[currencyCode];
  if (!currency) return amount.toString();

  try {
    const formatter = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return amount.toString();
  }
};

// Get currency symbol
export const getCurrencySymbol = (currencyCode) => {
  return SUPPORTED_CURRENCIES[currencyCode]?.symbol || currencyCode;
};

// Initialize exchange rates
export const initializeExchangeRates = async () => {
  try {
    await fetchExchangeRates();
  } catch (error) {
    console.error('Failed to initialize exchange rates:', error);
  }
};

// Currency conversion rates (you would typically fetch these from an API)
const CURRENCY_RATES = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  PLN: 4.27,
  // Add more currencies as needed
};

export async function convertToBaseCurrency(amount, fromCurrency) {
  if (!amount || !fromCurrency) return amount;
  if (fromCurrency === 'EUR') return amount;
  
  const rate = CURRENCY_RATES[fromCurrency];
  if (!rate) {
    console.warn(`No conversion rate found for ${fromCurrency}`);
    return amount;
  }

  return amount / rate;
}

export function detectCurrency(text) {
  const currencySymbols = {
    '€': 'EUR',
    '$': 'USD',
    '£': 'GBP',
    'zł': 'PLN',
    // Add more currency symbols as needed
  };

  for (const [symbol, code] of Object.entries(currencySymbols)) {
    if (text.includes(symbol)) {
      return {
        symbol,
        code,
        format: getCurrencyFormat(code)
      };
    }
  }

  // Default to EUR if no currency symbol is found
  return {
    symbol: '€',
    code: 'EUR',
    format: getCurrencyFormat('EUR')
  };
}

function getCurrencyFormat(currency) {
  const formats = {
    EUR: '1.234,56',
    USD: '1,234.56',
    GBP: '1,234.56',
    PLN: '1 234,56',
    // Add more currency formats as needed
  };

  return formats[currency] || '1,234.56';
}

export function parseAmount(text, currency) {
  if (!text) return 0;

  // Remove currency symbols and other non-numeric characters except decimal separator
  const cleanText = text.replace(/[^\d.,]/g, '');

  // Handle different decimal separators
  const format = getCurrencyFormat(currency);
  const decimalSeparator = format.includes(',') ? ',' : '.';
  const thousandsSeparator = format.includes(',') ? '.' : ',';

  // Split by decimal separator
  const parts = cleanText.split(decimalSeparator);
  
  // Handle the whole number part
  let whole = parts[0].replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '');
  
  // Handle the decimal part
  let decimal = parts[1] || '00';
  if (decimal.length > 2) decimal = decimal.slice(0, 2);
  if (decimal.length < 2) decimal = decimal.padEnd(2, '0');

  // Combine and convert to number
  return parseFloat(`${whole}.${decimal}`);
} 