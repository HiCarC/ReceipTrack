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
  }
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
  const d = new Date(date);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return dateFormat
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

// Calculate tax amount
export function calculateTax(amount, taxRate) {
  if (!amount || !taxRate) return 0;
  return amount * taxRate;
}

// Get category color
export function getCategoryColor(category) {
  const colors = {
    'Food & Dining': '#FF6B6B',
    'Transportation': '#4ECDC4',
    'Shopping': '#FFD93D',
    'Entertainment': '#95E1D3',
    'Bills & Utilities': '#6C5CE7',
    'Health & Medical': '#FF8B94',
    'Travel': '#A8E6CF',
    'Education': '#FFB6B9',
    'Personal Care': '#FFD3B6',
    'Other': '#B8B8B8'
  };
  
  return colors[category] || '#B8B8B8';
} 