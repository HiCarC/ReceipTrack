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

// Import Firestore for potential future use (currently disabled)
import { db } from '@/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';

// Local cache for current session with enhanced structure
let sessionCache = {
  rates: new Map(), // Map<date_currency, rate>
  timestamp: null,
  base: 'EUR',
  conversionCache: new Map(), // Map<amount_currency_date, convertedAmount> for memoization
  lastLogTime: 0 // Rate limiting for logs
};

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached rates
const LOG_THROTTLE_MS = 5000; // Only log once every 5 seconds

// Retry configuration
let retryCount = 0;
const MAX_RETRIES = 1; // Reduced to 1 since we only need daily precision
const RETRY_DELAY = 1000; // 1 second delay

// Firestore is completely disabled to prevent 400 errors
const FIRESTORE_ENABLED = false;

// Daily cache tracking
let dailyCacheStatus = new Map(); // Track which currencies we've fetched today

// Rate limiting for API calls
let lastApiCall = 0;
const API_RATE_LIMIT_MS = 1000; // Minimum 1 second between API calls

/**
 * Check if Firestore should be used (always false for now)
 */
const shouldUseFirestore = () => {
  return FIRESTORE_ENABLED;
};

/**
 * Handle Firestore connection errors gracefully
 */
const handleFirestoreError = (error) => {
  // Silently ignore Firestore errors since it's disabled
  return;
};

/**
 * Reset Firestore connection status (no-op since disabled)
 */
const resetFirestoreConnection = () => {
  // No-op since Firestore is disabled
};

/**
 * Check if we've already fetched this currency today
 */
const hasFetchedToday = (currency, date) => {
  const today = new Date().toISOString().split('T')[0];
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  // If it's not today, we haven't fetched it today
  if (dateStr !== today) {
    return false;
  }
  
  return dailyCacheStatus.has(currency);
};

/**
 * Mark currency as fetched today
 */
const markFetchedToday = (currency) => {
  dailyCacheStatus.set(currency, true);
  
  // Clean up old entries (keep only today's)
  const today = new Date().toISOString().split('T')[0];
  for (const [key, value] of dailyCacheStatus.entries()) {
    if (value !== today) {
      dailyCacheStatus.delete(key);
    }
  }
};

/**
 * Reset daily cache status (call this at midnight)
 */
const resetDailyCache = () => {
  dailyCacheStatus.clear();
};

// Reset daily cache at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    resetDailyCache();
  }
}, 60000); // Check every minute

/**
 * Sleep function for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reset retry count
 */
const resetRetryCount = () => {
  retryCount = 0;
};

/**
 * Rate-limited logging to prevent console spam
 */
const logRateSource = (currency, rate, source, date) => {
  const now = Date.now();
  if (now - sessionCache.lastLogTime > LOG_THROTTLE_MS) {
    const baseCurrency = getBaseCurrency();
    console.log(`💱 FX Rate [${currency}]: ${rate} (1 ${baseCurrency} = ${rate} ${currency}) | Source: ${source} | Date: ${date}`);
    sessionCache.lastLogTime = now;
  }
};

/**
 * Generate a cache key for a specific date and currency
 */
const getCacheKey = (date, currency) => {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  return `${dateStr}_${currency}`;
};

/**
 * Generate a conversion cache key
 */
const getConversionCacheKey = (amount, currency, date) => {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  return `${amount}_${currency}_${dateStr}`;
};

/**
 * Get settings to determine base currency
 */
const getBaseCurrency = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('expenseAppSettings') || '{}');
    return settings.baseCurrency || 'EUR';
  } catch (error) {
    return 'EUR';
  }
};

/**
 * Get cached rate from session cache
 */
const getCachedRate = async (date, currency) => {
  const baseCurrency = getBaseCurrency();
  
  // If currency is the same as base currency, return 1
  if (currency === baseCurrency) {
    return 1;
  }
  
  const cacheKey = getCacheKey(date, currency);
  const cached = sessionCache.rates.get(cacheKey);
  
  if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.rate;
  }
  
  return null;
};

/**
 * Set cached rate in session cache
 */
const setCachedRate = (date, currency, rate) => {
  const cacheKey = getCacheKey(date, currency);
  sessionCache.rates.set(cacheKey, {
    rate: rate,
    timestamp: Date.now()
  });
  
  // Clean up cache if it gets too large
  if (sessionCache.rates.size > MAX_CACHE_SIZE) {
    const entries = Array.from(sessionCache.rates.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2));
    toDelete.forEach(([key]) => sessionCache.rates.delete(key));
  }
};

/**
 * Get cached conversion result
 */
const getCachedConversion = (amount, currency, date) => {
  const cacheKey = getConversionCacheKey(amount, currency, date);
  return sessionCache.conversionCache.get(cacheKey);
};

/**
 * Set cached conversion result
 */
const setCachedConversion = (amount, currency, date, result) => {
  const cacheKey = getConversionCacheKey(amount, currency, date);
  sessionCache.conversionCache.set(cacheKey, {
    result: result,
    timestamp: Date.now()
  });
  
  // Clean up conversion cache if it gets too large
  if (sessionCache.conversionCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(sessionCache.conversionCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2));
    toDelete.forEach(([key]) => sessionCache.conversionCache.delete(key));
  }
};

/**
 * Get cached rate from Firestore (disabled)
 */
const getCachedRateFromFirestore = async (date, currency) => {
  return null; // Firestore is disabled
};

/**
 * Cache rate in Firestore (disabled)
 */
const cacheRateInFirestore = async (date, currency, rate) => {
  // Firestore is disabled - no-op
};

/**
 * Get most recent rate from Firestore (disabled)
 */
const getMostRecentRateFromFirestore = async (currency) => {
  return null; // Firestore is disabled
};

/**
 * Fetch historical rate from API with rate limiting and enhanced error handling
 */
const fetchHistoricalRate = async (date, currency) => {
  const baseCurrency = getBaseCurrency();
  
  if (currency === baseCurrency) {
    return 1;
  }
  
  // Rate limiting for API calls
  const now = Date.now();
  if (now - lastApiCall < API_RATE_LIMIT_MS) {
    await sleep(API_RATE_LIMIT_MS - (now - lastApiCall));
  }
  lastApiCall = Date.now();
  
  // Check if we've already fetched this currency today
  if (hasFetchedToday(currency, date)) {
    const cachedRate = await getCachedRate(date, currency);
    if (cachedRate !== null) {
      return cachedRate;
    }
  }

  try {
    // Use a reliable free API with retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
        if (response.ok) break;
        attempts++;
        if (attempts < maxAttempts) {
          await sleep(RETRY_DELAY * attempts);
        }
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          await sleep(RETRY_DELAY * attempts);
        } else {
          throw error;
        }
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response?.status}`);
    }

    const data = await response.json();
    
    if (data.rates && data.rates[currency]) {
      const rate = data.rates[currency];
      
      // Cache the rate
      setCachedRate(date, currency, rate);
      markFetchedToday(currency);
      
      logRateSource(currency, rate, 'API Fetch (Daily)', date);
      return rate;
    } else {
      throw new Error(`Currency ${currency} not found in API response`);
    }
  } catch (error) {
    // Last resort: use fallback rate
    const fallbackRate = getFallbackRate(currency);
    setCachedRate(date, currency, fallbackRate);
    logRateSource(currency, fallbackRate, 'Fallback Rate', date);
    return fallbackRate;
  }
};

/**
 * Get fallback rate for a currency
 */
const getFallbackRate = (currency) => {
  const fallbackRates = {
    'USD': 1.1,  // 1 EUR ≈ 1.1 USD
    'CZK': 25,   // 1 EUR ≈ 25 CZK
    'PLN': 4.3,  // 1 EUR ≈ 4.3 PLN
    'GBP': 0.86, // 1 EUR ≈ 0.86 GBP
    'JPY': 160,  // 1 EUR ≈ 160 JPY
    'CAD': 1.5,  // 1 EUR ≈ 1.5 CAD
    'AUD': 1.65, // 1 EUR ≈ 1.65 AUD
    'CHF': 0.95, // 1 EUR ≈ 0.95 CHF
    'SEK': 11.2, // 1 EUR ≈ 11.2 SEK
    'NOK': 11.5, // 1 EUR ≈ 11.5 NOK
    'DKK': 7.45, // 1 EUR ≈ 7.45 DKK
    'HUF': 380   // 1 EUR ≈ 380 HUF
  };
  
  return fallbackRates[currency] || 1;
};

/**
 * Get exchange rate with enhanced caching and error handling
 */
export const getExchangeRate = async (date, currency) => {
  const baseCurrency = getBaseCurrency();
  
  if (!date || !currency || currency === baseCurrency) {
    return 1; // Same currency is always 1
  }

  try {
    // 1. Try session cache first (fastest)
    const cachedRate = await getCachedRate(date, currency);
    if (cachedRate !== null) {
      return cachedRate;
    }

    // 2. Fetch from API and cache
    const rate = await fetchHistoricalRate(date, currency);
    return rate;
  } catch (error) {
    // 3. Last resort: return 1 (no conversion)
    return 1;
  }
};

/**
 * Convert amount from one currency to base currency using historical rates with memoization
 */
export const convertToBaseCurrency = async (amount, fromCurrency, date) => {
  // Validate inputs
  if (!amount || isNaN(parseFloat(amount))) {
    return 0;
  }
  
  const baseCurrency = getBaseCurrency();
  if (fromCurrency === baseCurrency) return parseFloat(amount);
  
  // Check conversion cache first
  const cachedConversion = getCachedConversion(amount, fromCurrency, date);
  if (cachedConversion && (Date.now() - cachedConversion.timestamp) < CACHE_DURATION) {
    return cachedConversion.result;
  }
  
  try {
    const rate = await getExchangeRate(date, fromCurrency);
    
    // Validate rate
    if (!rate || isNaN(rate) || rate <= 0) {
      const result = parseFloat(amount);
      setCachedConversion(amount, fromCurrency, date, result);
      return result;
    }
    
    // API returns rate as 1 base currency = X foreign currency
    // So to convert from foreign to base: amount / rate
    const convertedAmount = parseFloat((parseFloat(amount) / rate).toFixed(2));
    
    // Validate result
    if (isNaN(convertedAmount) || convertedAmount < 0) {
      const result = parseFloat(amount);
      setCachedConversion(amount, fromCurrency, date, result);
      return result;
    }
    
    // Cache the result
    setCachedConversion(amount, fromCurrency, date, convertedAmount);
    return convertedAmount;
  } catch (error) {
    const result = parseFloat(amount);
    setCachedConversion(amount, fromCurrency, date, result);
    return result;
  }
};

/**
 * Convert amount from base currency to target currency using historical rates
 */
export const convertFromBaseCurrency = async (amount, toCurrency, date) => {
  if (!amount || isNaN(parseFloat(amount))) return 0;
  
  const baseCurrency = getBaseCurrency();
  if (toCurrency === baseCurrency) return parseFloat(amount);
  
  try {
    const rate = await getExchangeRate(date, toCurrency);
    // API returns rate as 1 base currency = X target currency
    // So to convert from base to target: amount * rate
    return parseFloat((parseFloat(amount) * rate).toFixed(2));
  } catch (error) {
    return parseFloat(amount); // Return original amount as fallback
  }
};

/**
 * Convert amount from one currency to another using historical rates
 */
export const convertCurrency = async (amount, fromCurrency, toCurrency, date) => {
  if (!amount || isNaN(parseFloat(amount))) return 0;
  if (fromCurrency === toCurrency) return parseFloat(amount);
  
  const baseCurrency = getBaseCurrency();
  
  try {
    if (fromCurrency === baseCurrency) {
      return await convertFromBaseCurrency(amount, toCurrency, date);
    } else if (toCurrency === baseCurrency) {
      return await convertToBaseCurrency(amount, fromCurrency, date);
    } else {
      // Convert to base currency first, then to target currency
      const baseAmount = await convertToBaseCurrency(amount, fromCurrency, date);
      return await convertFromBaseCurrency(baseAmount, toCurrency, date);
    }
  } catch (error) {
    return parseFloat(amount); // Return original amount as fallback
  }
};

// Legacy function for backward compatibility - now converts to base currency
export const convertToEUR = async (amount, fromCurrency, date) => {
  return await convertToBaseCurrency(amount, fromCurrency, date);
};

/**
 * Initialize exchange rates for current date with enhanced error handling
 */
export const initializeExchangeRates = async () => {
  try {
    const baseCurrency = getBaseCurrency();
    const today = new Date().toISOString().split('T')[0];
    
    // Use a reliable free API
    const response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.rates) {
      // Only cache essential currencies to respect daily limits
      const essentialCurrencies = ['USD', 'CZK', 'PLN', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'HUF'];
      
      // Cache essential rates for today
      essentialCurrencies.forEach(currency => {
        if (data.rates[currency]) {
          // Always cache in session (fastest)
          setCachedRate(today, currency, data.rates[currency]);
          markFetchedToday(currency);
        }
      });
      
      logRateSource('INIT', Object.keys(data.rates).length, 'Essential Currencies Cached', today);
      return data.rates;
    }
  } catch (error) {
    // Return fallback rates if API fails
    const fallbackRates = {
      'USD': 1.1,  // 1 EUR ≈ 1.1 USD
      'CZK': 25,   // 1 EUR ≈ 25 CZK
      'PLN': 4.3,  // 1 EUR ≈ 4.3 PLN
      'GBP': 0.86, // 1 EUR ≈ 0.86 GBP
      'JPY': 160,  // 1 EUR ≈ 160 JPY
      'CAD': 1.5,  // 1 EUR ≈ 1.5 CAD
      'AUD': 1.65, // 1 EUR ≈ 1.65 AUD
      'CHF': 0.95, // 1 EUR ≈ 0.95 CHF
      'SEK': 11.2, // 1 EUR ≈ 11.2 SEK
      'NOK': 11.5, // 1 EUR ≈ 11.5 NOK
      'DKK': 7.45, // 1 EUR ≈ 7.45 DKK
      'HUF': 380   // 1 EUR ≈ 380 HUF
    };
    
    // Cache fallback rates in session only
    Object.entries(fallbackRates).forEach(([currency, rate]) => {
      setCachedRate(today, currency, rate);
    });
    
    logRateSource('INIT', Object.keys(fallbackRates).length, 'Fallback Rates Cached', today);
    return fallbackRates;
  }
  
  return null;
};

/**
 * Get current exchange rates from cache
 */
export const getCurrentExchangeRates = () => {
  const baseCurrency = getBaseCurrency();
  const today = new Date().toISOString().split('T')[0];
  const rates = {};
  
  // Get rates from session cache
  SUPPORTED_CURRENCIES.forEach(currency => {
    if (currency.code !== baseCurrency) {
      const cachedRate = sessionCache.rates.get(`${today}_${currency.code}`);
      if (cachedRate) {
        rates[currency.code] = cachedRate.rate;
      }
    }
  });
  
  return Object.keys(rates).length > 0 ? rates : null;
};

/**
 * Fetch current exchange rates from API
 */
export const fetchExchangeRates = async () => {
  return await initializeExchangeRates();
};

/**
 * Preload exchange rates for a date range
 */
export const preloadExchangeRates = async (startDate, endDate, currencies) => {
  const baseCurrency = getBaseCurrency();
  const essentialCurrencies = currencies || ['USD', 'CZK', 'PLN', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'HUF'];
  
  try {
    // Use current rates API for recent dates
    const response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.rates) {
        const today = new Date().toISOString().split('T')[0];
        
        // Cache essential rates for today
        essentialCurrencies.forEach(currency => {
          if (data.rates[currency] && currency !== baseCurrency) {
            setCachedRate(today, currency, data.rates[currency]);
            markFetchedToday(currency);
          }
        });
        
        return data.rates;
      }
    }
  } catch (error) {
    // Silently handle preload errors
  }
  
  return null;
};

/**
 * Format currency amount with proper locale and symbol
 */
export const formatCurrency = (amount, currencyCode = null, includeCurrencySymbol = true) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00';
  }
  
  const baseCurrency = getBaseCurrency();
  const currency = currencyCode || baseCurrency;
  
  try {
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
    if (!currencyInfo) {
      return `${parseFloat(amount).toFixed(2)} ${currency}`;
    }
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: includeCurrencySymbol ? 'currency' : 'decimal',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return formatter.format(amount);
  } catch (error) {
    // Fallback formatting
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  }
};

/**
 * Detect currency from text
 */
export function detectCurrency(text) {
  if (!text) return 'EUR';
  
  const currencyPatterns = {
    'EUR': /€|EUR|euro/i,
    'USD': /\$|USD|dollar/i,
    'GBP': /£|GBP|pound/i,
    'CHF': /CHF|franc/i,
    'SEK': /SEK|krona/i,
    'NOK': /NOK|krone/i,
    'DKK': /DKK|krone/i,
    'PLN': /PLN|złoty|zloty/i,
    'CZK': /CZK|koruna/i,
    'HUF': /HUF|forint/i,
    'RON': /RON|leu/i,
    'BGN': /BGN|lev/i,
    'HRK': /HRK|kuna/i,
    'JPY': /¥|JPY|yen/i,
    'CAD': /CAD|C\$|canadian dollar/i,
    'AUD': /AUD|A\$|australian dollar/i,
    'CNY': /CNY|¥|yuan/i
  };
  
  for (const [currency, pattern] of Object.entries(currencyPatterns)) {
    if (pattern.test(text)) {
      return currency;
    }
  }
  
  return 'EUR'; // Default to EUR
}

/**
 * Test exchange rate conversion (for debugging)
 */
export const testExchangeRate = async () => {
  const testAmount = 365;
  const testCurrency = 'CZK';
  const testDate = new Date('2025-07-12');
  const baseCurrency = getBaseCurrency();
  
  console.log(`🧪 Testing exchange rate conversion:`);
  console.log(`Amount: ${testAmount} ${testCurrency}`);
  console.log(`Date: ${testDate.toISOString().split('T')[0]}`);
  console.log(`Base Currency: ${baseCurrency}`);
  
  try {
    const rate = await getExchangeRate(testDate, testCurrency);
    console.log(`Exchange Rate: 1 ${baseCurrency} = ${rate} ${testCurrency}`);
    
    const converted = await convertToBaseCurrency(testAmount, testCurrency, testDate);
    console.log(`Converted Amount: ${converted} ${baseCurrency}`);
    
    return { rate, converted };
  } catch (error) {
    console.error('Test failed:', error);
    return null;
  }
};

/**
 * Parse amount from text with currency detection
 */
export function parseAmount(text, currency) {
  if (!text) return 0;
  
  // Remove currency symbols and extra spaces
  let cleanedText = text.replace(/[€$£¥₽₹₩₪₦₡₢₣₤₥₦₧₨₩₪₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿]/g, '');
  cleanedText = cleanedText.replace(/[^\d.,]/g, '');
  
  // Handle different decimal separators
  if (cleanedText.includes(',') && cleanedText.includes('.')) {
    // Both comma and dot present - assume comma is thousands separator
    cleanedText = cleanedText.replace(/,/g, '');
  } else if (cleanedText.includes(',')) {
    // Only comma present - check if it's decimal or thousands separator
    const parts = cleanedText.split(',');
    if (parts[parts.length - 1].length <= 2) {
      // Last part has 1-2 digits, likely decimal separator
      cleanedText = cleanedText.replace(',', '.');
    } else {
      // Last part has more digits, likely thousands separator
      cleanedText = cleanedText.replace(/,/g, '');
    }
  }
  
  const amount = parseFloat(cleanedText);
  return isNaN(amount) ? 0 : amount;
}

// Global test function for debugging
window.testExchangeRate = testExchangeRate; 