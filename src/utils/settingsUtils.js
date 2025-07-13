// Default settings
const DEFAULT_SETTINGS = {
  baseCurrency: 'EUR',
  displayCurrency: 'EUR',
  showOriginalAmounts: true,
  showConvertedAmounts: true,
  numberFormat: {
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2
  },
  dateFormat: 'YYYY-MM-DD',
  categories: [
    'Food & Dining',
    'Transportation',
    'Shopping',
    'Entertainment',
    'Bills & Utilities',
    'Health & Medical',
    'Travel',
    'Education',
    'Personal Care',
    'Other'
  ],
  taxRates: {
    standard: 0.23,
    reduced: 0.08,
    superReduced: 0.05
  },
  budget: {
    monthly: 0,
    startDay: 1,
    notifyOnExceed: true
  },
  export: {
    defaultFormat: 'csv',
    includeOriginalAmounts: true,
    includeConvertedAmounts: true
  },
  weekStartsOn: 'monday' // 'monday' or 'sunday'
};

// Load settings from localStorage
export function loadSettings() {
  try {
    const savedSettings = localStorage.getItem('expenseAppSettings');
    return savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Save settings to localStorage
export function saveSettings(settings) {
  try {
    localStorage.setItem('expenseAppSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Update settings
export function updateSettings(newSettings) {
  const currentSettings = loadSettings();
  const updatedSettings = { ...currentSettings, ...newSettings };
  saveSettings(updatedSettings);
  return updatedSettings;
}

// Format amount based on settings
export function formatAmount(amount, currency, settings) {
  if (!amount) return '0.00';
  
  const { numberFormat } = settings;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: numberFormat.decimalPlaces,
    maximumFractionDigits: numberFormat.decimalPlaces
  });

  return formatter.format(amount);
}

// Format date based on settings
export function formatDate(date, settings) {
  if (!date) return '';
  
  const { dateFormat } = settings;
  
  // Handle Firestore Timestamps
  let d;
  if (date && typeof date === 'object' && date.toDate) {
    // This is a Firestore Timestamp
    d = date.toDate();
  } else {
    // This is a regular date string or Date object
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) {
    return ''; // Return empty string if invalid date
  }

  let formattedDate;

  switch (dateFormat) {
    case 'YYYY-MM-DD':
      formattedDate = d.toISOString().split('T')[0];
      break;
    case 'DD MMM YYYY':
      // Example: 23 May 2023
      formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
      break;
    case 'DD MMM':
      // Example: 23 May
      formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d);
      break;
    // Add more cases for other desired formats if needed
    default:
      // Fallback to existing logic if dateFormat is not recognized or is custom
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      formattedDate = dateFormat
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
      break;
  }
  return formattedDate;
}

// Calculate tax amount
export function calculateTax(amount, taxRate) {
  if (!amount || !taxRate) return 0;
  return amount * taxRate;
}

// Get category color - using unified color scheme
export function getCategoryColor(category) {
  const colors = {
    'Groceries': '#3b82f6',
    'Dining': '#f472b6',
    'Transportation': '#a78bfa',
    'Shopping': '#818cf8',
    'Bills': '#60a5fa',
    'Entertainment': '#fbbf24',
    'Health': '#10b981',
    'Other': '#f59e42',
    'Uncategorized': '#9ca3af',
    // Legacy category names for backward compatibility
    'Food & Dining': '#f472b6',
    'Bills & Utilities': '#60a5fa',
    'Health & Medical': '#10b981',
    'Travel': '#a78bfa',
    'Education': '#f59e42',
    'Personal Care': '#f472b6'
  };
  
  return colors[category] || '#9ca3af';
} 