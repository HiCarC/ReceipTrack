// Supported currencies as an array of objects
export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€', format: '1.234,56' },
  { code: 'USD', name: 'US Dollar', symbol: '$', format: '1,234.56' },
  { code: 'GBP', name: 'British Pound', symbol: '£', format: '1,234.56' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', format: '1\'234.56' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', format: '1 234,56' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', format: '1 234,56' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', format: '1.234,56' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', format: '1 234,56' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', format: '1 234,56' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', format: '1 234' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', format: '1.234,56' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', format: '1 234,56' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', format: '1.234,56' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', format: '1,234' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', format: '1,234.56' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', format: '1,234.56' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', format: '1,234.56' },
];

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
    console.log("Returning cached exchange rates.");
    return ratesCache.rates;
  }

  try {
    console.log("Fetching new exchange rates...");
    const response = await fetch('https://open.er-api.com/v6/latest/EUR');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch exchange rates: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    console.log("Raw API response for exchange rates:", data);

    if (data.result === 'success') {
      // Filter only supported currencies
      const filteredRates = Object.keys(data.rates)
        .filter(currencyCode => SUPPORTED_CURRENCIES.some(c => c.code === currencyCode))
        .reduce((acc, currencyCode) => {
          acc[currencyCode] = data.rates[currencyCode];
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
export const formatCurrency = (amount, currencyCode = 'EUR', includeCurrencySymbol = true) => {
  if (amount === null || amount === undefined) return '';
  
  // Find the currency object in the array
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  if (!currency) return amount.toString();

  try {
    // Use a locale that matches the format, or a default for the currency code
    let locale = 'en-US'; // Default for currencies with dot as decimal
    if (currency.format.includes(',')) {
      locale = 'de-DE'; // Example for currencies with comma as decimal
    } else if (currency.code === 'HUF') {
      locale = 'hu-HU'; // Hungarian Forint has no decimal places
    }

    const formatter = new Intl.NumberFormat(locale, {
      style: includeCurrencySymbol ? 'currency' : 'decimal',
      currency: currencyCode,
      minimumFractionDigits: currency.code === 'HUF' ? 0 : 2, // No decimal for HUF
      maximumFractionDigits: currency.code === 'HUF' ? 0 : 2
    });
    return formatter.format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return amount.toString();
  }
};

// Get currency symbol (updated to work with array)
export const getCurrencySymbol = (currencyCode) => {
  return SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
};

// Initialize exchange rates
export const initializeExchangeRates = async () => {
  try {
    await fetchExchangeRates();
  } catch (error) {
    console.error('Failed to initialize exchange rates:', error);
  }
};

export async function convertToBaseCurrency(amount, fromCurrency) {
  if (!amount || !fromCurrency) return amount;
  if (fromCurrency === 'EUR') return amount;
  
  const rate = ratesCache.rates?.[fromCurrency];
  if (!rate) {
    console.warn(`No conversion rate found for ${fromCurrency}`);
    return amount;
  }

  return amount / rate;
}

// Detect currency (updated to use SUPPORTED_CURRENCIES array for formats)
export function detectCurrency(text) {
  // Iterate through SUPPORTED_CURRENCIES to find a match
  for (const curr of SUPPORTED_CURRENCIES) {
    if (text.includes(curr.symbol)) {
      return {
        symbol: curr.symbol,
        code: curr.code,
        format: curr.format
      };
    }
  }

  // Default to EUR if no currency symbol is found
  const defaultCurrency = SUPPORTED_CURRENCIES.find(c => c.code === 'EUR');
  return {
    symbol: defaultCurrency.symbol,
    code: defaultCurrency.code,
    format: defaultCurrency.format
  };
}

// Parse amount (updated to use currency object for format)
export function parseAmount(text, currency) {
  if (!text || !currency) return 0;

  // Remove currency symbols and other non-numeric characters except decimal separator
  const cleanText = text.replace(/[^\d.,]/g, '');

  // Get format from the currency object
  const format = currency.format;
  const decimalSeparator = format.includes(',') ? ',': '.';
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