import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import {
  fetchExchangeRates,
  convertToBaseCurrency as convertToBaseCurrencyUtil,
  initializeExchangeRates,
  getCurrentExchangeRates,
  convertToEUR as convertToEURHistorical,
  preloadExchangeRates,
  testExchangeRate
} from '@/utils/currencyUtils';
import { loadSettings, formatDate } from '@/utils/settingsUtils'; // Corrected import for formatDate
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Filler, BarElement } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import useReceiptOcr from '@/hooks/useReceiptOcr';
import { buildDaySections } from '@/utils/receiptGrouping';
import ReceiptFormModal from '@/components/receipts/ReceiptFormModal';
import ReceiptFullScreenPreview from '@/components/receipts/ReceiptFullScreenPreview';
import ReceiptCameraDialog from '@/components/receipts/ReceiptCameraDialog';
import ReceiptDeleteDialog from '@/components/receipts/ReceiptDeleteDialog';
import CategoryDetailsModal from '@/components/receipts/CategoryDetailsModal';
import ExpensesDashboard from '@/components/expenses/ExpensesDashboard';
import InsightsSection from '@/components/expenses/InsightsSection';
import ReceiptCard from '@/components/receipts/ReceiptCard';
import SwipeHintTooltip from '@/components/receipts/SwipeHintTooltip';
import AsyncCurrencyConversionComponent from '@/components/receipts/AsyncCurrencyConversion';
import ReceiptSuccessOverlay from '@/components/receipts/ReceiptSuccessOverlay';
import ReceiptLoadingOverlay from '@/components/receipts/ReceiptLoadingOverlay';
import UploadMethodCard from '@/components/receipts/UploadMethodCard';
import ReceiptsListLayout from '@/components/receipts/ReceiptsListLayout';
import UploadCameraView from '@/components/receipts/UploadCameraView';
import useReceiptFormHandlers from '@/hooks/useReceiptFormHandlers';
import ReceiptsTabView from '@/components/receipts/ReceiptsTabView';
import ExpensesTabView from '@/components/expenses/ExpensesTabView';
import useReceiptAnalytics from '@/hooks/useReceiptAnalytics';
import useReceiptCamera from '@/hooks/useReceiptCamera';
import useReceiptData from '@/hooks/useReceiptData';
import useReceiptPreview from '@/hooks/useReceiptPreview';
import useReceiptGroups from '@/hooks/useReceiptGroups';
import { estimateTaxForReceipt } from '@/utils/taxEstimator';
Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Filler, BarElement, annotationPlugin);

// Define supported currencies
const DEBUG = false;

const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: 'EUR', name: 'Euro' },
  { code: 'USD', symbol: 'USD', name: 'US Dollar' },
  { code: 'GBP', symbol: 'GBP', name: 'British Pound' },
  { code: 'JPY', symbol: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: 'CNY', name: 'Chinese Yuan' },
  { code: 'PLN', symbol: 'PLN', name: 'Polish Zloty' }
];

// Add currency conversion rates (you would typically fetch these from an API)
const CURRENCY_RATES = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  JPY: 161.62,
  CAD: 1.47,
  AUD: 1.65,
  CHF: 0.95,
  CNY: 7.83,
  PLN: 4.32
};

const SCANNER_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBCrcbdCsKHr7Ja_Y_S-nJ0N9xNzs-OsamoRLR8XZ6eOjfPfMALYyWR8XbuTFfi3fnXhtvQ2RZNndU4q_nH9oImydLbUAh5Bi71dYcx_dhVl6qI43rZFY0w5i2FpiMe_m56CcoJBjisWFqgEiOBXcAqNW71gENd6KNmBjeltokUljh7GpKXg_NbN8LBmbY3XdsUOKnOWKYz3JuI27Xlg5DYOO-x2IeRs4TSDD5B8vtnqld-XIEwv6PGWi_p-uURicx8-cGNOecEs_B3";

// Helper function to normalize date format
const normalizeDate = (input) => {
  if (!input) return '';
  
  // If input is already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  
  try {
    // Try to parse the date
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Date normalization error:', error);
    return '';
  }
};

// Add at the top-level of the file (outside the component):
const missingMessages = {
  merchant: [
    "Whoops! We need to know where you spent your hard-earned cash. Please enter the merchant name.",
    "The merchant is a mystery... for now. Fill it in.",
    "No merchant? No memory! Please tell us where you shopped."
  ],
  total: [
    "How much did you spend? The universe (and your budget) needs to know.",
    "Total amount missing! Your wallet is confused.",
    "No total, no tally! Please enter the amount."
  ],
  date: [
    "When did this happen? Time travel is hard without a date.",
    "Date missing! Was it yesterday, today, or in a galaxy far, far away?",
    "No date, no story! Please pick a day."
  ],
  items: [
    "What did you buy? At least one item, please.",
    "No items? No fun! Add something to your receipt.",
    "Your receipt is hungry for items. Feed it."
  ]
};

const getFunnyMissingMessage = (missing) => {
  if (missing.length === 1) {
    const key = missing[0];
    const options = missingMessages[key];
    return options[Math.floor(Math.random() * options.length)];
  } else if (missing.length > 1) {
    // Combine messages for multiple missing fields
    return (
      missing.map(key => {
        const options = missingMessages[key];
        return options[Math.floor(Math.random() * options.length)];
      }).join(' ')
    );
  }
  return "Something's missing, but we're not sure what!";
};

// Unified category colors - use hex colors for consistency across all components
const categoryColors = {
  'Groceries': '#3b82f6',
  'Dining': '#f472b6',
  'Transportation': '#a78bfa',
  'Shopping': '#818cf8',
  'Bills': '#60a5fa',
  'Entertainment': '#fbbf24',
  'Health': '#10b981',
  'Other': '#f59e42',
  'Uncategorized': '#9ca3af'
};

// Helper function to get category color
const getCategoryColor = (cat) => categoryColors[cat] || categoryColors['Uncategorized'];

// Helper function to get Tailwind border class for receipt cards
const getCategoryBorderClass = (cat) => {
  const colorMap = {
    'Groceries': 'border-blue-400',
    'Dining': 'border-pink-400',
    'Transportation': 'border-purple-400',
    'Shopping': 'border-indigo-400',
    'Bills': 'border-blue-400',
    'Entertainment': 'border-yellow-400',
    'Health': 'border-emerald-400',
    'Other': 'border-orange-400',
    'Uncategorized': 'border-gray-400'
  };
  return colorMap[cat] || colorMap['Uncategorized'];
};


export default function ReceiptUploader({ className, showOnly, onTabChange, onNeedsFixCountChange, onRequestExport, captureTrigger }) {
  const { toast } = useToast();
  const authContext = useAuth();
  const user = authContext ? authContext.user : null;
  const { isLoading, setIsLoading } = useLoading();
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [items, setItems] = useState([]);
  const [receipts, setReceipts] = useState([]);

  const [expandedMonths, setExpandedMonths] = useState({}); // monthKey -> expanded

  const isMonthExpanded = (key, groupObj) => {
    const val = expandedMonths[key];
    if (val === undefined) {
      const now = new Date();
      return groupObj.year === now.getFullYear() && groupObj.month === now.getMonth();
    }
    return !!val;
  };
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [isFirestoreLoading, setIsFirestoreLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const updateRatesTimeout = useRef(null);
  const conversionCacheRef = useRef(new Map());
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [editForm, setEditForm] = useState({
    merchant: '',
    amount: '',
    date: '',
    category: '',
    subtotal: '',
    payment_method: '',
    currency: 'EUR',
    items: []
  });
  const [newItem, setNewItem] = useState({ name: '', price: '' });
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [scanMode, setScanMode] = useState('single');
  const [captureSource, setCaptureSource] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const {
    canvasRef,
    videoRef,
    isCameraOpen,
    setIsCameraOpen,
    isCameraReady,
    isFlashOn,
    handleOpenCamera,
    handleToggleFlash,
    capturePhoto,
    stopCamera,
  } = useReceiptCamera({
    toast,
    setCaptureSource,
    setFile,
    setPreviewImageSrc,
    setShowFullScreenPreview,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState('upload_options'); // Changed initial state
  const [processingStage, setProcessingStage] = useState(null); // 'detecting_edges' | 'enhancing' | 'reading_text' | 'parsed'

  // New states for the "Edit Receipt Form" section's item management
  const [currentReceipt, setCurrentReceipt] = useState(null); // Holds the receipt being edited
  const [currentNewItem, setCurrentNewItem] = useState({ name: '', price: '' }); // For adding/editing items in the edit form
  const [currentEditingItemIndex, setCurrentEditingItemIndex] = useState(null); // Index for editing items in the edit form
  const [expandedReceiptId, setExpandedReceiptId] = useState(null); // New state to manage expanded receipt
  const [expandedInCategoryModalId, setExpandedInCategoryModalId] = useState(null);
  const [returnToCategory, setReturnToCategory] = useState(null);
  const {
    recentGroups,
    setRecentGroups,
    selectedGroupId,
    setSelectedGroupId,
    groups,
    setGroups,
    groupFilter,
    setGroupFilter,
    groupSwitcherOpen,
    setGroupSwitcherOpen,
  } = useReceiptGroups({ user, receipts });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // State for form data
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Set today's date as default
    merchant: '',
    total: '',
    tax: '',
    subtotal: '',
    paymentMethod: '',
    currency: 'EUR',
    items: [],
    category: '',
    isBusiness: true,
    note: ''
  });
  const merchantInputRef = useRef(null);

  // State for UI
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentFunnyMessage, setCurrentFunnyMessage] = useState('');
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState('month');
  const [customRange, setCustomRange] = useState(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - 29);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [showAnalyticsReport, setShowAnalyticsReport] = useState(false);

  // Combine isLoading and isFirestoreLoading for a global busy state
  const isBusyGlobal = isFirestoreLoading;

  const {
    fetchReceipts,
    createReceipt,
    updateReceipt,
    deleteReceipt,
  } = useReceiptData({
    user,
    toast,
    receipts,
    setReceipts,
    setIsFirestoreLoading,
    setFirestoreError,
  });

  const onTabChangeForSave = showOnly === 'receipts' ? null : onTabChange;
  const {
    handleManualEntry,
    handleFormInputChange,
    handleItemInputChange,
    handleAddItemField,
    handleRemoveItemField,
    handleSaveReceiptSubmit,
    handleCloseReceiptForm,
  } = useReceiptFormHandlers({
    user,
    toast,
    editingReceipt,
    editForm,
    formData,
    setEditForm,
    setFormData,
    setCurrentReceipt,
    setFormErrors,
    setIsBusy,
    setEditingReceipt,
    setIsEditing,
    setNewItem,
    setFile,
    setPreviewImageSrc,
    setCurrentStep,
    createReceipt,
    updateReceipt,
    fetchReceipts,
    onTabChange: onTabChangeForSave,
    normalizeDate,
    getFunnyMissingMessage,
    setSelectedCategory,
    setModalOpen,
    returnToCategory,
    setReturnToCategory,
    merchantInputRef,
  });

  // Array of funny loading messages
  const funnyMessages = [
    "Teaching receipts to read...",
    "Counting pixels and dollars...",
    "Wrangling numbers into submission...",
    "Decoding receipt hieroglyphics...",
    "Making receipts talk...",
    "Converting paper to pixels...",
    "Teaching AI to read receipts...",
    "Calculating the meaning of life, the universe, and your receipt...",
    "Hold tight, magic is happening.",
    "Scanning for hidden discounts...",
    "Teaching receipts to dance...",
    "Brewing coffee for the receipt scanner...",
    "Polishing the pixels...",
    "Feeding the receipt scanner...",
    "Teaching receipts to do yoga...",
    "Counting all the zeros...",
    "Making the receipt scanner happy...",
    "Teaching receipts to sing...",
    "Polishing the digital lens...",
    "Feeding the AI some numbers..."
  ];

  const getRandomFunnyMessage = () => {
    return funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
  };

  const categories = [
    "Groceries",
    "Dining",
    "Transportation",
    "Shopping",
    "Bills",
    "Entertainment",
    "Health",
    "Other"
  ];

  const { processOCR } = useReceiptOcr({
    user,
    toast,
    setIsBusy,
    setIsLoading,
    setIsOcrProcessing,
    setOcrError,
    setShowSuccessState,
    setFile,
    setPreviewImageSrc,
    setCurrentStep,
    createReceipt,
    fetchReceipts,
    onTabChange,
    previewImageSrc,
    selectedGroupId,
    setRecentGroups,
    normalizeDate,
    receipts,
  });

  const {
    handleImageChange,
    handleConfirmPreview,
    handleRetakePreview,
  } = useReceiptPreview({
    file,
    setFile,
    previewImageSrc,
    setPreviewImageSrc,
    setShowFullScreenPreview,
    setProcessingStage,
    captureSource,
    setCaptureSource,
    setIsCameraOpen,
    stopCamera,
    setCurrentStep,
    handleOpenCamera,
    processOCR,
    toast,
    onTabChange,
  });

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Recompute needs-fix count when receipts change
  useEffect(() => {
    if (typeof onNeedsFixCountChange === 'function') {
      const needsFix = receipts.filter(r => !(r.merchant && r.total && (r.transactionDate || r.date))).length;
      onNeedsFixCountChange(needsFix);
    }
  }, [receipts, onNeedsFixCountChange]);

  // Allow external trigger to open camera (for future routing/event use)
  useEffect(() => {
    if (captureTrigger) {
      handleOpenCamera();
    }
  }, [captureTrigger]);

  useEffect(() => {
    if (showOnly !== 'upload') {
      if (isCameraOpen) {
        stopCamera();
      }
      return;
    }
    handleOpenCamera();
    return () => stopCamera();
  }, [showOnly]);

  useEffect(() => {
    // Compute isBusy directly from its state dependencies inside the effect
    const isComponentBusy = isLoading || isFirestoreLoading;
    if (isComponentBusy) {
      const randomIndex = Math.floor(Math.random() * funnyMessages.length);
      setCurrentFunnyMessage(funnyMessages[randomIndex]);
    } else {
      setCurrentFunnyMessage(''); // Clear message when not busy
    }
  }, [isLoading, isFirestoreLoading]); // Depend on the raw state variables

  const [convertedAmount, setConvertedAmount] = useState(null);
  const [convertedSubtotal, setConvertedSubtotal] = useState(null);
  const [convertedItems, setConvertedItems] = useState([]);
  const [baseAmountsById, setBaseAmountsById] = useState(new Map());
  const [exchangeRates, setExchangeRates] = useState(null);
  const [isInitializingRates, setIsInitializingRates] = useState(false);

  // Initialize exchange rates and preload historical rates on component mount
  useEffect(() => {
    let isMounted = true;
    
    const initRates = async () => {
      // Prevent multiple simultaneous initialization attempts
      if (isInitializingRates) {
        return;
      }
      
      setIsInitializingRates(true);
      
      try {
        const rates = await initializeExchangeRates();
        if (isMounted && rates) {
      setExchangeRates(rates);
        }
        
        // Test exchange rate calculation
        if (isMounted) {
          await testExchangeRate();
        }
        
        // Preload exchange rates for the last 3 months if we have receipts
        if (isMounted && receipts.length > 0) {
          const today = new Date();
          const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
          
          // Get unique currencies from receipts
          const currencies = [...new Set(receipts.map(r => r.currency).filter(c => c && c !== 'EUR'))];
          
          if (currencies.length > 0) {
            await preloadExchangeRates(threeMonthsAgo, today, currencies);
          }
        }
      } catch (error) {
        // Try to get cached rates as fallback
        if (isMounted) {
          const cachedRates = getCurrentExchangeRates();
          if (cachedRates) {
            setExchangeRates(cachedRates);
          }
        }
      } finally {
        if (isMounted) {
          setIsInitializingRates(false);
        }
      }
    };
    
    initRates();
    
    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount, not when receipts change

  // Update exchange rates periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const rates = await fetchExchangeRates();
        if (rates) {
        setExchangeRates(rates);
        }
      } catch (error) {
        // Silently handle periodic update errors
      }
    }, 3600000); // Update every hour

    return () => clearInterval(interval);
  }, []);

  const fileInputRef = useRef(null); // Ref for the file input element

  // Correct and robust settings initialization
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = loadSettings();
      // Ensure savedSettings is an object, or use a default if it's null/undefined/invalid JSON
      return savedSettings || {
        dateFormat: 'YYYY-MM-DD',
        baseCurrency: 'EUR',
        showOriginalAmounts: true,
        showConvertedAmounts: true
      };
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
      // Fallback to default settings if there's any error in loading/parsing
      return {
        dateFormat: 'YYYY-MM-DD',
        baseCurrency: 'EUR',
        showOriginalAmounts: true,
        showConvertedAmounts: true
      };
    }
  });

  // Update settings when they change (e.g., from other components via localStorage event)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const newSettings = loadSettings();
        if (newSettings) {
          setSettings(newSettings);
        }
      } catch (error) {
        console.error('Error updating settings from storage event:', error);
      }
    };

    const handleSettingsUpdated = (e) => {
      setSettings(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settings-updated', handleSettingsUpdated);
    };
  }, []);

  // Force recalculation when base currency changes with debouncing
  useEffect(() => {
    if (receipts.length > 0 && settings?.baseCurrency) {
      // Clear exchange rates to force recalculation
      setExchangeRates(null);
      
      // Clear any existing timeout
      if (updateRatesTimeout.current) {
        clearTimeout(updateRatesTimeout.current);
      }
      
      // Debounce the rate update to prevent excessive API calls
      updateRatesTimeout.current = setTimeout(async () => {
        try {
          const rates = await initializeExchangeRates();
          if (rates) {
            setExchangeRates(rates);
          }
        } catch (error) {
          // Silently handle currency change errors
        }
      }, 1000); // 1 second debounce
    }
    
    // Cleanup function
    return () => {
      if (updateRatesTimeout.current) {
        clearTimeout(updateRatesTimeout.current);
      }
    };
  }, [settings?.baseCurrency]); // Only depend on base currency, not receipts.length

  // Settings loaded successfully

  // Helper function to format date safely
  const formatDateSafely = (dateString, formatOverride = null) => {
    try {
      // Ensure settings and dateFormat are available before calling formatDate
      // Provide a fallback settings object if the component's settings state is not yet ready
      const currentSettings = settings || { dateFormat: 'YYYY-MM-DD', baseCurrency: 'EUR' }; // Minimal default for formatting
      if (!dateString) return '';

      // Use formatOverride if provided, otherwise use currentSettings.dateFormat
      const formatToUse = formatOverride || currentSettings.dateFormat;
      return formatDate(dateString, { ...currentSettings, dateFormat: formatToUse });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString || '';
    }
  };

  // Enhanced currency conversion function with historical rates
  const convertToBaseCurrency = useCallback(async (amount, fromCurrency, date) => {
    if (!amount || isNaN(parseFloat(amount))) return 0;

    const baseCurrency = settings?.baseCurrency || 'EUR';
    if (fromCurrency === baseCurrency) return parseFloat(amount);

    try {
      // Use the utility function for base currency conversion
      return await convertToBaseCurrencyUtil(amount, fromCurrency, date);
    } catch (error) {
      // Fallback to current rates if historical conversion fails
      if (exchangeRates && exchangeRates[fromCurrency]) {
        return parseFloat((parseFloat(amount) / exchangeRates[fromCurrency]).toFixed(2));
      }

      const cachedRates = getCurrentExchangeRates();
      if (cachedRates && cachedRates[fromCurrency]) {
        return parseFloat((parseFloat(amount) / cachedRates[fromCurrency]).toFixed(2));
      }

      return parseFloat(amount);
    }
  }, [exchangeRates, settings?.baseCurrency]);

  // New function to get base currency equivalent for display
  const getBaseCurrencyEquivalent = async (amount, fromCurrency, date) => {
    if (!amount || isNaN(parseFloat(amount))) return null;
    
    const baseCurrency = settings?.baseCurrency || 'EUR';
    if (fromCurrency === baseCurrency) return null; // No need to show equivalent for same currency
    return await convertToBaseCurrency(amount, fromCurrency, date);
  };

  // Enhanced format currency function that handles conversion display
  const formatCurrencyWithConversion = async (amount, currency, date, showConversion = true) => {
    if (!amount || isNaN(parseFloat(amount))) return '';
    
    const baseCurrency = settings?.baseCurrency || 'EUR';
    const formattedAmount = formatCurrency(parseFloat(amount), currency);
    
    if (showConversion && currency !== baseCurrency) {
      try {
        const baseEquivalent = await getBaseCurrencyEquivalent(amount, currency, date);
        if (baseEquivalent !== null) {
          return (
            <span className="flex flex-col">
              <span className="text-sm text-gray-400">{formattedAmount}</span>
              <span className="text-xs text-blue-300">≈ {formatCurrency(baseEquivalent, baseCurrency)}</span>
            </span>
          );
        }
      } catch (error) {
        // Silently handle base currency equivalent errors
      }
    }
    
    return formattedAmount;
  };


  const handleEditCancel = () => {
    setEditingReceipt(null);
    setIsEditing(false);
    // Ensure editForm is reset when cancelling edit
    setEditForm({
      merchant: '',
      amount: '',
      date: '',
      category: '',
      subtotal: '',
      payment_method: '',
      currency: 'EUR',
      items: []
    });
    setCurrentNewItem({ name: '', price: '' });
    setCurrentEditingItemIndex(null);
  };

  // Add Item to manual entry form
  const handleAddItem = () => {
    if (!newItem.name.trim() && !newItem.price.trim()) {
      return;
    }
    if (!newItem.name.trim() || !newItem.price.trim()) {
      toast({
        title: "Incomplete Item",
        description: "Please provide both item name and price.",
        variant: "destructive",
      });
      return;
    }

    const priceNum = parseFloat(newItem.price.replace(',', '.'));
    if (isNaN(priceNum)) {
      toast({
        title: "Invalid Price",
        description: "Item price must be a valid number.",
        variant: "destructive",
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { name: newItem.name.trim(), price: priceNum.toFixed(2) }]
    }));
    setNewItem({ name: '', price: '' });
  };

  // Add Item to edit form
  const handleEditItemAdd = () => {
    if (!currentNewItem.name.trim() || !currentNewItem.price.trim()) {
      toast({
        title: "Incomplete Item",
        description: "Please provide both item name and price for the new item.",
        variant: "destructive",
      });
      return;
    }
    const priceNum = parseFloat(currentNewItem.price.replace(',', '.'));
    if (isNaN(priceNum)) {
      toast({
        title: "Invalid Price",
        description: "New item price must be a valid number.",
        variant: "destructive",
      });
      return;
    }

    setEditForm(prev => ({
      ...prev,
      items: [...(prev.items || []), { name: currentNewItem.name.trim(), price: priceNum.toFixed(2) }]
    }));
    setCurrentReceipt(prev => ({
      ...prev,
      items: [...(prev.items || []), { name: currentNewItem.name.trim(), price: priceNum.toFixed(2) }]
    }));
    setCurrentNewItem({ name: '', price: '' });
  };

  // Determine which form state to use based on editingReceipt
  const activeFormData = editingReceipt ? editForm : formData;
  const isEditMode = !!editingReceipt;

  // Async receipt card component with historical currency conversion
  // Async currency conversion component
  const AsyncCurrencyConversion = (props) => (
    <AsyncCurrencyConversionComponent
      baseCurrency={settings?.baseCurrency || 'EUR'}
      convertToBaseCurrency={convertToBaseCurrency}
      normalizeToLocalMidnight={normalizeToLocalMidnight}
      formatCurrency={formatCurrency}
      {...props}
    />
  );

// Wrapper function for backward compatibility
  const renderReceiptCard = (receipt) => {
    return (
      <ReceiptCard
        receipt={receipt}
        expandedReceiptId={expandedReceiptId}
        setExpandedReceiptId={setExpandedReceiptId}
        handleEditClick={handleEditClick}
          handleBinIconClick={handleBinIconClick}
          setPendingDeleteId={setPendingDeleteId}
          setShowDeleteModal={setShowDeleteModal}
          settings={settings}
          getBaseAmount={getReceiptBaseAmount}
          getCategoryBorderClass={getCategoryBorderClass}
          formatCurrency={formatCurrency}
          AsyncCurrencyConversion={AsyncCurrencyConversion}
        />
    );
  };


  const handleEditClick = (receipt) => {
    setEditingReceipt(receipt);
    setIsEditing(true);
    setCurrentStep('receipt_form');

    // Safely parse numbers for initial editForm state
    const safeParseFloat = (value) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
    };

    // Convert Firestore Timestamp to date string for the form
    let dateString = '';
    if (receipt.transactionDate) {
      if (receipt.transactionDate.toDate) {
        // It's a Firestore Timestamp
        dateString = receipt.transactionDate.toDate().toISOString().split('T')[0];
      } else if (typeof receipt.transactionDate === 'string') {
        // It's already a string
        dateString = receipt.transactionDate;
      } else if (receipt.transactionDate instanceof Date) {
        // It's a Date object
        dateString = receipt.transactionDate.toISOString().split('T')[0];
      }
    }
    
    // Also check for receipt.date as fallback
    if (!dateString && receipt.date) {
      if (receipt.date.toDate) {
        dateString = receipt.date.toDate().toISOString().split('T')[0];
      } else if (typeof receipt.date === 'string') {
        dateString = receipt.date;
      } else if (receipt.date instanceof Date) {
        dateString = receipt.date.toISOString().split('T')[0];
      }
    }

    setEditForm({
      merchant: receipt.merchant || '',
      total: safeParseFloat(receipt.total), // Always set 'total' as string with two decimals
      date: dateString,
      category: receipt.category || '',
      subtotal: receipt.subtotal ? safeParseFloat(receipt.subtotal) : '',
      payment_method: receipt.paymentMethod || '',
      currency: receipt.currency || 'EUR',
      items: receipt.items?.map(item => ({
        name: item.name || '',
        price: safeParseFloat(item.price)
      })) || [] // Ensure items are formatted safely
    });
    setCurrentReceipt(receipt);
    setIsEditing(true);
    setCurrentStep('receipt_form'); // Open the receipt form modal for editing
    setReturnToCategory(selectedCategory); // Save the category context
  };

  // Add this useEffect near the top of the component, after the state declarations
  useEffect(() => {
    if (currentStep === 'receipt_form' || currentStep === 'manual_entry') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [currentStep]);

  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup function to restore scroll on component unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isLoading]);

  // Add a helper to get the currency symbol
  const getCurrencySymbol = (code) => {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === code);
    return currency ? currency.symbol : code;
  };

  // Add a helper to format currency with locale-aware symbol placement and postfix exceptions
  const postfixCurrencies = ['SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'];
  const formatCurrency = (amount, currencyCode = null) => {
    if (amount === null || amount === undefined) return '';
    
    // Use base currency if no currency specified
    if (!currencyCode) {
      currencyCode = settings?.baseCurrency || 'EUR';
    }
    
    if (postfixCurrencies.includes(currencyCode)) {
      return amount.toFixed(2) + ' ' + currencyCode;
    }
    // Pick a locale based on currency (for best symbol placement)
    let locale = 'en-US';
    if (currencyCode === 'EUR') locale = 'fr-FR';
    if (currencyCode === 'CZK') locale = 'cs-CZ';
    if (currencyCode === 'PLN') locale = 'pl-PL';
    if (currencyCode === 'GBP') locale = 'en-GB';
    if (currencyCode === 'JPY') locale = 'ja-JP';
    if (currencyCode === 'CNY') locale = 'zh-CN';
    if (currencyCode === 'AUD') locale = 'en-AU';
    if (currencyCode === 'CAD') locale = 'en-CA';
    if (currencyCode === 'CHF') locale = 'de-CH';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return amount + ' ' + currencyCode;
    }
  };

  // Add swipe state:
  const [swipedId, setSwipedId] = useState(null);
  const [swipeDir, setSwipeDir] = useState(null);
  const swipeRefs = useRef({});
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [hasShownSwipeHint, setHasShownSwipeHint] = useState(() => !!localStorage.getItem('hasSeenSwipeHint'));
  

  
  // Show swipe hint on first visit
  useEffect(() => {
    if (!hasShownSwipeHint && receipts.length > 0) {
      setShowSwipeHint(true);
      localStorage.setItem('hasSeenSwipeHint', 'true');
      setHasShownSwipeHint(true);
    }
  }, [receipts.length, hasShownSwipeHint]);

  // Add swipe handlers:
  const handleTouchStart = (id, e) => {
    if (DEBUG) {
      console.log('[DEBUG] handleTouchStart', { id, x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
    setSwipeStartX(prev => ({ ...prev, [id]: e.touches[0].clientX }));
    setSwipeStartY(prev => ({ ...prev, [id]: e.touches[0].clientY }));
  };
  const handleTouchMove = (id, e) => {
    if (swipeStartX[id] == null || swipeStartY[id] == null) return;
    const dx = e.touches[0].clientX - swipeStartX[id];
    const dy = e.touches[0].clientY - swipeStartY[id];
    if (DEBUG) {
      console.log('[DEBUG] handleTouchMove', { id, dx, dy });
    }
    // Only handle horizontal swipes, ignore vertical movement
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      e.preventDefault(); // Only prevent default for horizontal swipes
      e.stopPropagation();
      setSwipeOffset(prev => ({ ...prev, [id]: dx }));
    }
  };
  const handleTouchEnd = (id) => {
    const offset = swipeOffset[id] || 0;
    const card = document.getElementById(`receipt-card-${id}`);
    const width = card ? card.offsetWidth : 1;
    const threshold = width * 0.4;
    if (DEBUG) {
      console.log('[DEBUG] handleTouchEnd', { id, offset, width, threshold });
    }
    if (offset > threshold) {
      try { navigator.vibrate && navigator.vibrate(30); } catch {}
      setTimeout(() => {
        setSwipeOffset(prev => ({ ...prev, [id]: 0 }));
        setSwipeStartX(prev => ({ ...prev, [id]: undefined }));
        setSwipeStartY(prev => ({ ...prev, [id]: undefined }));
        handleEditClick(receipts.find(r => r.id === id));
      }, 150);
    } else if (offset < -threshold) {
      try { navigator.vibrate && navigator.vibrate([30, 30, 30]); } catch {}
      setTimeout(() => {
        setSwipeOffset(prev => ({ ...prev, [id]: 0 }));
        setSwipeStartX(prev => ({ ...prev, [id]: undefined }));
        setSwipeStartY(prev => ({ ...prev, [id]: undefined }));
        setPendingDeleteId(id);
        setShowDeleteModal(true);
      }, 150);
      } else {
      setSwipeOffset(prev => ({ ...prev, [id]: 0 }));
      setSwipeStartX(prev => ({ ...prev, [id]: undefined }));
      setSwipeStartY(prev => ({ ...prev, [id]: undefined }));
    }
  };

  // Add at the top of the component:
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Add a helper to get swipe progress (0 to 1) and direction:
  const getSwipeProgress = (id) => {
    const offset = swipeOffset[id] || 0;
    const card = document.getElementById(`receipt-card-${id}`);
    const width = card ? card.offsetWidth : 1;
    const progress = Math.min(Math.abs(offset) / (width * 0.4), 1);
    const dir = offset > 0 ? 'right' : offset < 0 ? 'left' : null;
    return { progress, dir };
  };

  // Add these hooks for swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState({});
  const [swipeStartX, setSwipeStartX] = useState({});
  const [swipeStartY, setSwipeStartY] = useState({});

  // --- Date helpers ---
  const normalizeToLocalMidnight = useCallback((d) => {
    if (!d) return null;
    if (typeof d.toDate === 'function') { d = d.toDate(); } // Handle Firestore Timestamps
    if (d && typeof d === 'object' && typeof d.seconds === 'number') {
      d = new Date(d.seconds * 1000);
    }
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      // Parse as local date (YYYY-MM-DD)
      const [year, month, day] = d.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    if (d instanceof Date && !isNaN(d)) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    if (typeof d === 'string' || typeof d === 'number') {
      const parsed = new Date(d);
      if (!isNaN(parsed)) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    }
    return null;
  }, []);

  const { weekStart, weekEnd } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() - today.getDay()); // Sunday (local)
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Saturday
    end.setHours(23, 59, 59, 999); // End of day
    return { weekStart: start, weekEnd: end };
  }, []);

  // In ReceiptUploader (parent):

  // Add a function to handle bin icon clicks with confirmation
  const handleBinIconClick = (e, receiptId) => {
    e.stopPropagation();
    setPendingDeleteId(receiptId);
    setShowDeleteModal(true);
  };

  const handleDeleteReceiptAndClose = async (receiptId) => {
    await deleteReceipt(receiptId);
    handleCloseReceiptForm();
  };

  // Make exchange rates available globally for insights
  useEffect(() => {
    if (exchangeRates) {
      window.exchangeRates = exchangeRates;
    }
  }, [exchangeRates]);

  const getReceiptKey = useCallback((receipt) => {
    if (!receipt) return null;
    return (
      receipt.id ||
      receipt.transactionDate?.toDate?.()?.toISOString?.() ||
      receipt.date ||
      receipt.createdAt?.toDate?.()?.toISOString?.() ||
      `${receipt.merchant || 'receipt'}-${receipt.total || ''}`
    );
  }, []);

  // Track converted amounts for all receipts in the current base currency
  useEffect(() => {
    let cancelled = false;
    const buildBaseAmounts = async () => {
      if (!receipts.length || !settings?.baseCurrency) {
        setBaseAmountsById(new Map());
        return;
      }
      const baseCurrency = settings.baseCurrency;
      const conversionCache = conversionCacheRef.current;
      const nextMap = new Map();

      await Promise.all(
        receipts.map(async (receipt) => {
          const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
          if (!date) return;
          const rawAmount = parseFloat(receipt.total) || 0;
          const receiptCurrency = receipt.currency || baseCurrency;
          const cacheKey = `${receipt.id || 'noid'}|${receiptCurrency}|${baseCurrency}|${rawAmount}|${date.getTime()}`;

          let amountBaseCurrency = rawAmount;
          if (conversionCache.has(cacheKey)) {
            amountBaseCurrency = conversionCache.get(cacheKey);
          } else if (receiptCurrency !== baseCurrency) {
            amountBaseCurrency = await convertToBaseCurrency(receipt.total, receiptCurrency, date);
            conversionCache.set(cacheKey, amountBaseCurrency);
          }

          const key = getReceiptKey(receipt);
          if (key) {
            nextMap.set(key, amountBaseCurrency);
          }
        })
      );

      if (!cancelled) {
        setBaseAmountsById(nextMap);
      }
    };

    buildBaseAmounts();
    return () => {
      cancelled = true;
    };
  }, [receipts, settings?.baseCurrency, convertToBaseCurrency, normalizeToLocalMidnight, getReceiptKey]);

  // Update monthly totals calculation to use converted base currency amounts with smart grouping
  const calculateMonthlyTotals = (receipts, baseAmountById, baseCurrency) => {
    const monthlyTotals = {};
    
    // Group receipts by month first
    const receiptsByMonth = {};
    
    for (const receipt of receipts) {
      const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
      if (!date) continue;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!receiptsByMonth[monthKey]) {
        receiptsByMonth[monthKey] = [];
      }
      receiptsByMonth[monthKey].push(receipt);
    }
    
    // Process each month with smart grouping
    for (const [monthKey, monthReceipts] of Object.entries(receiptsByMonth)) {
      let totalNetExpenses = 0;
      const groupNetExpenses = {};
      
      // First pass: collect all group expenses and reimbursements for this month
      for (const receipt of monthReceipts) {
        const amountBaseCurrency = receipt?.id && baseAmountById.has(receipt.id)
          ? baseAmountById.get(receipt.id)
          : parseFloat(receipt.total) || 0;
        
        // Check if this is a group-related receipt
        const isGroupReceipt = receipt.isGroupExpense || 
                              receipt.category === 'Group Expense' || 
                              (receipt.note && receipt.note.includes('Group:'));
        
        if (isGroupReceipt && receipt.groupId) {
          // Group expense or reimbursement
          if (!groupNetExpenses[receipt.groupId]) {
            groupNetExpenses[receipt.groupId] = {
              expenses: 0,
              reimbursements: 0,
              net: 0
            };
          }
          
          const isReimbursement = receipt.isReimbursement;
          
          if (isReimbursement) {
            groupNetExpenses[receipt.groupId].reimbursements += amountBaseCurrency;
          } else {
            groupNetExpenses[receipt.groupId].expenses += Math.abs(amountBaseCurrency);
          }
        } else {
          // Personal expense (not group-related)
          totalNetExpenses += amountBaseCurrency;
        }
      }
      
      // Second pass: calculate net for each group and add to total
      Object.values(groupNetExpenses).forEach(group => {
        group.net = -group.expenses + group.reimbursements;
        totalNetExpenses += group.net;
      });
      
      // Set monthly totals
      const date = normalizeToLocalMidnight(monthReceipts[0].transactionDate || monthReceipts[0].date);
      monthlyTotals[monthKey] = {
        total: totalNetExpenses,
        count: monthReceipts.length,
        month: date.getMonth(),
        year: date.getFullYear()
      };
    }
    
    return monthlyTotals;
  };

  // State for calculated totals
  const [calculatedTotals, setCalculatedTotals] = useState({
    totalExpenses: 0,
    categoryTotals: {},
    monthlyTotals: {}
  });

  // Calculate current month totals using converted amounts
  const [currentMonthData, setCurrentMonthData] = useState({ total: 0, count: 0 });

  // Update the existing totalExpenses calculation to use converted base currency amounts with smart grouping
  useEffect(() => {
    if (showOnly === 'upload') {
      return;
    }

    let cancelled = false;
      const calculateTotals = async () => {
        try {
          const baseCurrency = settings?.baseCurrency || 'EUR';
          const baseAmountById = baseAmountsById;

        if (cancelled) return;

        const monthlyTotals = calculateMonthlyTotals(receipts, baseAmountById, baseCurrency);

        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        const currentMonthReceipts = receipts.filter(receipt => {
          const d = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
          return d && d >= currentMonthStart && d <= currentMonthEnd;
        });

        let totalExpenses = 0;
        const categoryTotals = {};
        const groupNetExpenses = {};

        for (const receipt of currentMonthReceipts) {
          const amountBaseCurrency = receipt?.id && baseAmountById.has(receipt.id)
            ? baseAmountById.get(receipt.id)
            : parseFloat(receipt.total) || 0;
          const amountLocalCurrency = parseFloat(receipt.total) || 0;
          const receiptCurrency = receipt.currency || baseCurrency;

          const isGroupReceipt = receipt.isGroupExpense ||
            receipt.category === 'Group Expense' ||
            (receipt.note && receipt.note.includes('Group:'));

          if (isGroupReceipt && receipt.groupId) {
            if (!groupNetExpenses[receipt.groupId]) {
              let groupName = 'Unknown Group';
              if (receipt.note && receipt.note.includes('Group: ')) {
                groupName = receipt.note.split('Group: ')[1].split(' -')[0];
              } else if (receipt.note && receipt.note.includes('Family')) {
                groupName = 'Family';
              } else if (receipt.merchant && receipt.merchant.includes('ALDI')) {
                groupName = 'Family';
              }

              groupNetExpenses[receipt.groupId] = {
                groupName: groupName,
                expenses: 0,
                reimbursements: 0,
                net: 0,
                baseCurrency: 0,
                localCurrency: 0,
                currencies: {}
              };
            }

            const isReimbursement = receipt.isReimbursement;

            if (isReimbursement) {
              groupNetExpenses[receipt.groupId].reimbursements += amountBaseCurrency;
            } else {
              groupNetExpenses[receipt.groupId].expenses += Math.abs(amountBaseCurrency);
            }

            groupNetExpenses[receipt.groupId].baseCurrency += amountBaseCurrency;
            groupNetExpenses[receipt.groupId].localCurrency += amountLocalCurrency;

            if (!groupNetExpenses[receipt.groupId].currencies[receiptCurrency]) {
              groupNetExpenses[receipt.groupId].currencies[receiptCurrency] = 0;
            }
            groupNetExpenses[receipt.groupId].currencies[receiptCurrency] += amountLocalCurrency;
          } else {
            totalExpenses += -Math.abs(amountBaseCurrency);

            const category = receipt.category || 'Uncategorized';
            if (!categoryTotals[category]) {
              categoryTotals[category] = {
                baseCurrency: 0,
                localCurrency: 0,
                currencies: {}
              };
            }

            categoryTotals[category].baseCurrency -= Math.abs(amountBaseCurrency);
            categoryTotals[category].localCurrency -= Math.abs(amountLocalCurrency);

            if (!categoryTotals[category].currencies[receiptCurrency]) {
              categoryTotals[category].currencies[receiptCurrency] = 0;
            }
            categoryTotals[category].currencies[receiptCurrency] -= Math.abs(amountLocalCurrency);
          }
        }

        Object.values(groupNetExpenses).forEach(group => {
          group.net = -group.expenses + group.reimbursements;
          totalExpenses += group.net;

          if (group.net !== 0) {
            categoryTotals[group.groupName] = {
              baseCurrency: group.net,
              localCurrency: group.localCurrency,
              currencies: group.currencies
            };
          }
        });

        if (cancelled) return;

        setCalculatedTotals({
          totalExpenses,
          categoryTotals,
          monthlyTotals
        });
        setTotalExpenses(totalExpenses);
        setCategoryTotals(categoryTotals);

        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthData = monthlyTotals[currentMonthKey] || { total: 0, count: 0 };
        setCurrentMonthData(currentMonthData);
      } catch (error) {
        console.error('Error calculating totals:', error);
      }
    };

    if (receipts.length > 0 && settings?.baseCurrency) {
      calculateTotals();
    } else {
      setCalculatedTotals({ totalExpenses: 0, categoryTotals: {}, monthlyTotals: {} });
      setTotalExpenses(0);
      setCategoryTotals({});
      setCurrentMonthData({ total: 0, count: 0 });
    }

    return () => {
      cancelled = true;
    };
  }, [receipts, baseAmountsById, settings?.baseCurrency, normalizeToLocalMidnight, showOnly]);

  // Convert receipts to EUR for period calculations
  const [periodReceipts, setPeriodReceipts] = useState([]);
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return end;
  });


  const receiptsNeedingFixCount = useMemo(() => (
    receipts.filter(
      (receipt) => !(receipt.merchant && receipt.total && (receipt.transactionDate || receipt.date))
    ).length
  ), [receipts]);

  const getTimeLabel = (receipt) => {
    const date = receipt.transactionDate?.toDate?.() || (receipt.date ? new Date(receipt.date) : null);
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  const getReceiptBaseAmount = useCallback(
    (receipt) => {
      if (!receipt) return 0;
      const key = getReceiptKey(receipt);
      if (key && baseAmountsById.has(key)) {
        return baseAmountsById.get(key);
      }
      return parseFloat(receipt.total) || 0;
    },
    [baseAmountsById, getReceiptKey]
  );
  const getReceiptBaseTax = useCallback(
    (receipt) => {
      if (!receipt) return 0;
      const taxMeta = estimateTaxForReceipt(receipt, settings);
      const taxRaw = parseFloat(taxMeta?.amount) || 0;
      if (!taxRaw) return 0;
      const baseTotal = getReceiptBaseAmount(receipt);
      const totalRaw = parseFloat(receipt.total) || 0;
      if (totalRaw > 0 && baseTotal > 0 && receipt.currency !== (settings?.baseCurrency || 'EUR')) {
        return Math.abs(baseTotal * (taxRaw / totalRaw));
      }
      return taxRaw;
    },
    [getReceiptBaseAmount, settings, settings?.baseCurrency]
  );

  const daySections = useMemo(
    () => buildDaySections(receipts, normalizeToLocalMidnight),
    [receipts, normalizeToLocalMidnight]
  );

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return receipts.reduce((sum, receipt) => {
      const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
      if (!date || date < start || date > end) return sum;
      return sum + Math.abs(getReceiptBaseAmount(receipt));
    }, 0);
  }, [receipts, getReceiptBaseAmount, normalizeToLocalMidnight]);

  const lastMonthTotal = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return receipts.reduce((sum, receipt) => {
      const date = normalizeToLocalMidnight(receipt.transactionDate || receipt.date);
      if (!date || date < start || date > end) return sum;
      return sum + Math.abs(getReceiptBaseAmount(receipt));
    }, 0);
  }, [receipts, getReceiptBaseAmount, normalizeToLocalMidnight]);

  const monthDelta = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const {
    analyticsSummary,
    topCategory,
    topExpenses,
    donutSegments,
    donutStops,
    analyticsReport,
    getBaseAmount,
  } = useReceiptAnalytics({
    receipts,
    settings,
    analyticsRange,
    customRange,
    weekStart,
    weekEnd,
    normalizeToLocalMidnight,
    convertToBaseCurrency,
    categoryColors,
    enabled: showOnly !== 'receipts' && showOnly !== 'upload',
  });


  if (showOnly === 'receipts') {
    return (
      <>
        <ReceiptsTabView
          user={user}
          receiptsNeedingFixCount={receiptsNeedingFixCount}
          monthLabel={monthLabel}
          currentMonthTotal={currentMonthTotal}
          monthDelta={monthDelta}
          daySections={daySections}
          expandedReceiptId={expandedReceiptId}
          setExpandedReceiptId={setExpandedReceiptId}
          getTimeLabel={getTimeLabel}
          getBaseAmount={getReceiptBaseAmount}
          getBaseTax={getReceiptBaseTax}
          formatCurrency={formatCurrency}
          settings={settings}
          isOcrProcessing={isOcrProcessing}
          onEditReceipt={handleEditClick}
          onDeleteReceipt={handleBinIconClick}
        />
        <ReceiptFormModal
          open={currentStep === 'receipt_form' || currentStep === 'manual_entry'}
          onOpenChange={() => {}}
          handleSaveReceiptSubmit={handleSaveReceiptSubmit}
          handleCloseReceiptForm={handleCloseReceiptForm}
          editingReceipt={editingReceipt}
          isBusy={isBusy}
          isEditMode={isEditMode}
          activeFormData={activeFormData}
          formErrors={formErrors}
          settings={settings}
          categories={categories}
          supportedCurrencies={SUPPORTED_CURRENCIES}
          getCurrencySymbol={getCurrencySymbol}
          merchantInputRef={merchantInputRef}
          handleFormInputChange={handleFormInputChange}
          handleItemInputChange={handleItemInputChange}
          handleAddItemField={handleAddItemField}
          handleRemoveItemField={handleRemoveItemField}
          onRequestDelete={() => {
            if (editingReceipt?.id) {
              setPendingDeleteId(editingReceipt.id);
              setShowDeleteModal(true);
            }
          }}
        />
        <ReceiptDeleteDialog
          showDeleteModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          pendingDeleteId={pendingDeleteId}
          setPendingDeleteId={setPendingDeleteId}
          handleDeleteReceipt={handleDeleteReceiptAndClose}
        />
      </>
    );
  }

  if (showOnly === 'upload') {
    return (
      <>
        <UploadCameraView
          groups={groups}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          groupSwitcherOpen={groupSwitcherOpen}
          setGroupSwitcherOpen={setGroupSwitcherOpen}
          isCameraOpen={isCameraOpen}
          isCameraReady={isCameraReady}
          isFlashOn={isFlashOn}
          scanMode={scanMode}
          setScanMode={setScanMode}
          videoRef={videoRef}
          fileInputRef={fileInputRef}
          canvasRef={canvasRef}
          handleImageChange={handleImageChange}
          handleManualEntry={handleManualEntry}
          handleOpenCamera={handleOpenCamera}
          handleToggleFlash={handleToggleFlash}
          capturePhoto={capturePhoto}
          stopCamera={stopCamera}
          onTabChange={onTabChange}
          scannerBackground={SCANNER_BG}
        />
        <ReceiptFormModal
          open={currentStep === 'receipt_form' || currentStep === 'manual_entry'}
          onOpenChange={() => {}}
          handleSaveReceiptSubmit={handleSaveReceiptSubmit}
          handleCloseReceiptForm={handleCloseReceiptForm}
          editingReceipt={editingReceipt}
          isBusy={isBusy}
          isEditMode={isEditMode}
          activeFormData={activeFormData}
          formErrors={formErrors}
          settings={settings}
          categories={categories}
          supportedCurrencies={SUPPORTED_CURRENCIES}
          getCurrencySymbol={getCurrencySymbol}
          merchantInputRef={merchantInputRef}
          handleFormInputChange={handleFormInputChange}
          handleItemInputChange={handleItemInputChange}
          handleAddItemField={handleAddItemField}
          handleRemoveItemField={handleRemoveItemField}
          onRequestDelete={() => {
            if (editingReceipt?.id) {
              setPendingDeleteId(editingReceipt.id);
              setShowDeleteModal(true);
            }
          }}
        />
        <ReceiptDeleteDialog
          showDeleteModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          pendingDeleteId={pendingDeleteId}
          setPendingDeleteId={setPendingDeleteId}
          handleDeleteReceipt={handleDeleteReceiptAndClose}
        />
        <ReceiptFullScreenPreview
          show={showFullScreenPreview}
          previewImageSrc={previewImageSrc}
          processingStage={processingStage}
          handleRetakePreview={handleRetakePreview}
          handleConfirmPreview={handleConfirmPreview}
        />
      </>
    );
  }


  if (showOnly === 'expenses') {
    return (
      <ExpensesTabView
        analyticsRange={analyticsRange}
        setAnalyticsRange={setAnalyticsRange}
        customRange={customRange}
        setCustomRange={setCustomRange}
        analyticsSummary={analyticsSummary}
        analyticsReport={analyticsReport}
        formatCurrency={formatCurrency}
        settings={settings}
        receipts={receipts}
        categoryTotals={categoryTotals}
        calculatedTotals={calculatedTotals}
        getBaseAmount={getReceiptBaseAmount}
        categoryColors={categoryColors}
        showAnalyticsReport={showAnalyticsReport}
        setShowAnalyticsReport={setShowAnalyticsReport}
        donutStops={donutStops}
        donutSegments={donutSegments}
        topCategory={topCategory}
        topExpenses={topExpenses}
        onTabChange={onTabChange}
        showLocationInsights={settings?.features?.locationInsights !== false}
      />
    );
  }



  return (
    <div className={`relative flex flex-col items-center w-full ${className}`} style={{ touchAction: 'manipulation', overflowX: 'hidden' }}>
      {/* Success State Overlay */}
      {showSuccessState && <ReceiptSuccessOverlay />}

      {/* Loading Overlay */}
      {isLoading && !showSuccessState && (
        <ReceiptLoadingOverlay
          isOcrProcessing={isOcrProcessing}
          currentFunnyMessage={currentFunnyMessage}
        />
      )}

      {/* Main Content Area */}
      <div
        className="flex-grow flex flex-col items-center justify-start px-2 sm:px-4 lg:px-6 mt-8 mb-12"
        style={{
          touchAction: 'pan-y',
          overflowX: 'hidden',
          maxWidth: '100vw',
          width: '100vw'
        }}
      >
        {/* Dashboard Header */}
        <div className="text-center mb-8 w-full max-w-4xl px-2">
          <h1 className="text-4xl font-extrabold text-white mb-4">
            {/* Removed: Your Expense Dashboard */}
          </h1>
          <p className="text-xl text-gray-300">
            {/* Removed: Ready to conquer your expenses? Upload receipts, track spending, and gain insights with ease. */}
          </p>
        </div>

        {/* Responsive row layout for laptop/desktop, column for mobile */}
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-full items-start justify-center mb-8" style={{ overflowX: 'hidden' }}>
          {/* Upload Method Card */}
          <UploadMethodCard
            showOnly={showOnly}
            fileInputRef={fileInputRef}
            handleImageChange={handleImageChange}
            handleOpenCamera={handleOpenCamera}
            handleManualEntry={handleManualEntry}
            recentGroups={recentGroups}
            groups={groups}
            setSelectedGroupId={setSelectedGroupId}
            groupSwitcherOpen={groupSwitcherOpen}
            setGroupSwitcherOpen={setGroupSwitcherOpen}
            setGroups={setGroups}
            user={user}
          />

          {/* Financial Overview Card */}
          <div className={`w-full md:w-1/3 flex-col items-center mb-8 md:mb-0 ${showOnly === 'expenses' ? 'flex' : !showOnly ? 'flex' : 'hidden'} md:flex`}>
            <ExpensesDashboard
              totalExpenses={totalExpenses}
              categoryTotals={categoryTotals}
              formatCurrency={formatCurrency}
              formatDateSafely={formatDateSafely}
              settings={settings}
              receipts={receipts}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              modalOpen={modalOpen}
              setModalOpen={setModalOpen}
              getCategoryColor={getCategoryColor}
            />
            {/* Insights Section */}
            <InsightsSection
              receipts={receipts}
              categoryTotals={categoryTotals}
              calculatedTotals={calculatedTotals}
              formatCurrency={formatCurrency}
              settings={settings}
          getBaseAmount={getReceiptBaseAmount}
              categoryColors={categoryColors}
            />
          </div>

          <ReceiptsListLayout
            showOnly={showOnly}
            isFirestoreLoading={isFirestoreLoading}
            firestoreError={firestoreError}
            currentFunnyMessage={currentFunnyMessage}
            fetchReceipts={fetchReceipts}
            receipts={receipts}
            normalizeToLocalMidnight={normalizeToLocalMidnight}
            setExpandedMonths={setExpandedMonths}
            isMonthExpanded={isMonthExpanded}
            calculatedTotals={calculatedTotals}
            formatCurrency={formatCurrency}
            settings={settings}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            groups={groups}
            selectMode={selectMode}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            renderReceiptCard={renderReceiptCard}
          />
        </div>
        {/* Receipt Form Modal (for Manual Entry and OCR-populated forms) */}
        <ReceiptFormModal
          open={currentStep === 'receipt_form' || currentStep === 'manual_entry'}
          onOpenChange={() => {}}
          handleSaveReceiptSubmit={handleSaveReceiptSubmit}
          handleCloseReceiptForm={handleCloseReceiptForm}
          editingReceipt={editingReceipt}
          isBusy={isBusy}
          isEditMode={isEditMode}
          activeFormData={activeFormData}
          formErrors={formErrors}
          settings={settings}
          categories={categories}
          supportedCurrencies={SUPPORTED_CURRENCIES}
          getCurrencySymbol={getCurrencySymbol}
          merchantInputRef={merchantInputRef}
          handleFormInputChange={handleFormInputChange}
          handleItemInputChange={handleItemInputChange}
          handleAddItemField={handleAddItemField}
          handleRemoveItemField={handleRemoveItemField}
          onRequestDelete={() => {
            if (editingReceipt?.id) {
              setPendingDeleteId(editingReceipt.id);
              setShowDeleteModal(true);
            }
          }}
        />
        </div>

      {/* Full Screen Preview */}
      <ReceiptFullScreenPreview
        show={showFullScreenPreview}
        previewImageSrc={previewImageSrc}
        processingStage={processingStage}
        handleRetakePreview={handleRetakePreview}
        handleConfirmPreview={handleConfirmPreview}
      />

      {/* Camera View */}
      <ReceiptCameraDialog
        isCameraOpen={isCameraOpen}
        setIsCameraOpen={setIsCameraOpen}
        stopCamera={stopCamera}
        videoRef={videoRef}
        canvasRef={canvasRef}
        rotation={rotation}
        isCameraReady={isCameraReady}
        capturePhoto={capturePhoto}
        onManualEntry={handleManualEntry}
      />
      <footer className="w-full text-center py-4 text-gray-400 text-sm mt-8 mb-4">
        Powered with <span className="animate-very-slow-pulse inline-block">❤️</span> by ExpenseApp
      </footer>
      <ReceiptDeleteDialog
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        pendingDeleteId={pendingDeleteId}
        setPendingDeleteId={setPendingDeleteId}
        handleDeleteReceipt={handleDeleteReceiptAndClose}
      />
      {/* Category Details Modal */}
      <CategoryDetailsModal
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        selectedCategory={selectedCategory}
        receipts={receipts}
        settings={settings}
        formatCurrency={formatCurrency}
        formatDateSafely={formatDateSafely}
        normalizeToLocalMidnight={normalizeToLocalMidnight}
        expandedInCategoryModalId={expandedInCategoryModalId}
        setExpandedInCategoryModalId={setExpandedInCategoryModalId}
        AsyncCurrencyConversion={AsyncCurrencyConversion}
      />
      
      {/* Swipe Hint Tooltip */}
      <SwipeHintTooltip
        show={showSwipeHint}
        onDismiss={() => setShowSwipeHint(false)}
      />
    </div>
  );
}


