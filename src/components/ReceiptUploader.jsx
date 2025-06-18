import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Trash2, DollarSign, Calendar, Store, Tag, CreditCard, List, X, Camera, CheckCircle, XCircle, PlusCircle, Save, Edit, Mail, LineChart, Lock, Loader2, MinusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { db } from '@/firebase'; // Import your Firebase db instance
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore"; // Import Firestore functions
import {
  fetchExchangeRates,
  convertToBaseCurrency,
  initializeExchangeRates
} from '@/utils/currencyUtils';
import { loadSettings, formatDate } from '@/utils/settingsUtils'; // Corrected import for formatDate
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  ScrollArea,
} from "./ui/scroll-area";

// Define supported currencies
const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' }
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
    "Whoops! We need to know where you spent your hard-earned cash. Please enter the merchant name! 🏪",
    "The merchant is a mystery... for now. Fill it in! 🕵️‍♂️",
    "No merchant? No memory! Please tell us where you shopped. 🛒"
  ],
  total: [
    "How much did you spend? The universe (and your budget) needs to know! 💸",
    "Total amount missing! Your wallet is confused. 🤔",
    "No total, no tally! Please enter the amount. 🧮"
  ],
  date: [
    "When did this happen? Time travel is hard without a date! ⏳",
    "Date missing! Was it yesterday, today, or in a galaxy far, far away? 🌌",
    "No date, no story! Please pick a day. 📅"
  ],
  items: [
    "What did you buy? At least one item, please! 🛍️",
    "No items? No fun! Add something to your receipt. 🎁",
    "Your receipt is hungry for items. Feed it! 🍔"
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

// Add at the top of the component:
const categoryColors = {
  Groceries: 'border-green-400',
  Dining: 'border-pink-400',
  Transportation: 'border-yellow-400',
  Shopping: 'border-purple-400',
  Bills: 'border-blue-400',
  Entertainment: 'border-indigo-400',
  Health: 'border-emerald-400',
  Other: 'border-gray-400',
  Uncategorized: 'border-blue-500',
};
const getCategoryColor = (cat) => categoryColors[cat] || categoryColors['Uncategorized'];

// Add at the top of the component:
const [swipeOffset, setSwipeOffset] = useState({});
const [swipeStartX, setSwipeStartX] = useState({});

export default function ReceiptUploader({ className }) {
  const { toast } = useToast();
  const authContext = useAuth();
  const user = authContext ? authContext.user : null;
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [items, setItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [isFirestoreLoading, setIsFirestoreLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  let _videoElement = null; // Mutable variable to hold the video DOM element
  const videoRef = (node) => {
    if (node) {
      _videoElement = node;
      // Only start camera if modal is open and camera isn't already running
      if (isCameraOpen && !isCameraReady) {
        console.log('Video element assigned to ref, and camera modal is open. Calling startCamera.');
        startCamera();
      }
    } else {
      _videoElement = null;
      console.log('Video element detached from ref.');
    }
  };
  const canvasRef = useRef(null);
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState('upload_options'); // Changed initial state

  // New states for the "Edit Receipt Form" section's item management
  const [currentReceipt, setCurrentReceipt] = useState(null); // Holds the receipt being edited
  const [currentNewItem, setCurrentNewItem] = useState({ name: '', price: '' }); // For adding/editing items in the edit form
  const [currentEditingItemIndex, setCurrentEditingItemIndex] = useState(null); // Index for editing items in the edit form
  const [expandedReceiptId, setExpandedReceiptId] = useState(null); // New state to manage expanded receipt

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
    category: ''
  });

  // State for UI
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentFunnyMessage, setCurrentFunnyMessage] = useState('');

  // Combine isLoading and isFirestoreLoading for a global busy state
  const isBusyGlobal = isLoading || isFirestoreLoading;

  // Array of funny loading messages
  const funnyMessages = [
    "Teaching receipts to read... 📚",
    "Counting pixels and dollars... 💰",
    "Wrangling numbers into submission... 🤠",
    "Decoding receipt hieroglyphics... 🔍",
    "Making receipts talk... 🗣️",
    "Converting paper to pixels... 📄➡️💻",
    "Teaching AI to read receipts... 🤖",
    "Calculating the meaning of life, the universe, and your receipt... 🌌",
    "Hold tight, magic is happening! ✨",
    "Scanning for hidden discounts... 🔎",
    "Teaching receipts to dance... 💃",
    "Brewing coffee for the receipt scanner... ☕",
    "Polishing the pixels... ✨",
    "Feeding the receipt scanner... 🍕",
    "Teaching receipts to do yoga... 🧘‍♂️",
    "Counting all the zeros... 0️⃣",
    "Making the receipt scanner happy... 😊",
    "Teaching receipts to sing... 🎵",
    "Polishing the digital lens... 🔍",
    "Feeding the AI some numbers... 🤖"
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

  const receiptsCollectionRef = collection(db, "receipts");

  const fetchReceipts = async () => {
    if (!user) {
      console.log("fetchReceipts: User not authenticated, skipping fetch.");
      return;
    }
    console.log("fetchReceipts: Current user:", user);
    setIsFirestoreLoading(true);
    setFirestoreError(null);
    try {
      const data = await getDocs(receiptsCollectionRef);
      const receiptsList = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      console.log("fetchReceipts: All fetched receipts (before filter):", receiptsList);
      // Only show receipts for the current user
      const userReceipts = receiptsList.filter(r => {
        const isMatch = r.userId === user.uid; // Corrected field name from user_id to userId
        console.log(`Receipt ID: ${r.id}, Receipt userId: ${r.userId}, Current User UID: ${user.uid}, Match: ${isMatch}`);
        return isMatch;
      });
      console.log("fetchReceipts: Filtered user receipts:", userReceipts);
      // Sort receipts by last updated timestamp (or created_at if not updated)
      const sortedReceipts = userReceipts.sort((a, b) => {
        const dateA = (a.updated_at?.toDate?.() || a.createdAt?.toDate?.() || new Date(0));
        const dateB = (b.updated_at?.toDate?.() || b.createdAt?.toDate?.() || new Date(0));
        return dateB - dateA; // Sort in descending order (newest first)
      });
      setReceipts(sortedReceipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      setFirestoreError("Failed to load receipts. Please try again.");
    } finally {
      setIsFirestoreLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  useEffect(() => {
    // Calculate total expenses
    const total = receipts.reduce((sum, receipt) => sum + (parseFloat(receipt.total) || 0), 0);
    setTotalExpenses(total);

    // Calculate category totals
    const categorySums = receipts.reduce((acc, receipt) => {
      const cat = receipt.category || 'Uncategorized';
      const amount = parseFloat(receipt.total) || 0; // Changed from receipt.amount to receipt.total
      acc[cat] = (acc[cat] || 0) + amount;
      return acc;
    }, {});
    setCategoryTotals(categorySums);
  }, [receipts]);

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
  const [exchangeRates, setExchangeRates] = useState(null);

  // Initialize exchange rates on component mount
  useEffect(() => {
    initializeExchangeRates().then(rates => {
      setExchangeRates(rates);
    });
  }, []);

  // Update exchange rates periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const rates = await fetchExchangeRates();
        setExchangeRates(rates);
      } catch (error) {
        console.error('Failed to update exchange rates:', error);
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

  console.log('ReceiptUploader component - Current settings state:', settings);

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

  const convertToEUR = (amount, fromCurrency) => {
    if (fromCurrency === 'EUR') return parseFloat(amount);
    if (!exchangeRates || !exchangeRates[fromCurrency] || !amount) return parseFloat(amount); // Return original if no rate
    return (parseFloat(amount) / exchangeRates[fromCurrency]).toFixed(2);
  };

  const handleDeleteReceipt = async (id) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to delete receipts.",
        variant: "destructive",
      });
      return;
    }
    try {
      await deleteDoc(doc(db, "receipts", id));
      setReceipts(receipts.filter((receipt) => receipt.id !== id));
      toast({
        title: "Receipt Deleted! 🗑️",
        description: "The receipt has been successfully removed.",
      });
    } catch (error) {
      console.error("Error deleting receipt:", error);
      toast({
        title: "Error Deleting Receipt 😥",
        description: `There was an issue deleting the receipt: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleImageChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create a preview URL for the selected file
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImageSrc(event.target.result);
        setShowFullScreenPreview(true);
      };
      reader.readAsDataURL(selectedFile);
      // Clear the input value to allow re-uploading the same file
      e.target.value = null; 
    }
  };

  // Refactor: Use a single handler for all top-level form input changes
  const handleFormInputChange = (e) => {
    const { name, value } = e.target;
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;

    targetStateSetter(prev => {
      let updatedData = { ...prev };
      if (name === "total" || name === "subtotal" || name === "tax") {
        // Allow empty string or numbers with up to 2 decimal places
        if (value === '' || /^-?[0-9]*\.?[0-9]{0,2}$/.test(value.replace(',', '.'))) {
          updatedData[name] = value.replace(',', '.');
        }
      } else if (name === "date") {
        updatedData[name] = normalizeDate(value);
      } else {
        updatedData[name] = value;
      }
      return updatedData;
    });

    // If editing, also update currentReceipt to reflect changes live in the modal for item management
    if (editingReceipt) {
      setCurrentReceipt(prev => {
        let updatedReceipt = { ...prev };
        // Special handling for numerical fields to ensure they are parsed correctly for currentReceipt
        updatedReceipt[name] = (name === "total" || name === "subtotal" || name === "tax") ? (value === '' ? '' : parseFloat(value.replace(',', '.'))) : value;
        return updatedReceipt;
      });
    }
  };

  // Refactor: Use a single handler for all item input changes within the form
  const handleItemInputChange = (e, index, field) => {
    const { value } = e.target;
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;

    targetStateSetter(prev => {
      const updatedItems = [...(prev.items || [])];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: (field === 'price') ? (value === '' ? '' : parseFloat(value.replace(',', '.')).toFixed(2)) : value
      };
      return { ...prev, items: updatedItems };
    });

    // If editing, also update currentReceipt items to reflect changes live in the modal
    if (editingReceipt) {
      setCurrentReceipt(prev => {
        const updatedItems = [...(prev.items || [])];
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: (field === 'price') ? (value === '' ? '' : parseFloat(value.replace(',', '.')).toFixed(2)) : value
        };
        return { ...prev, items: updatedItems };
      });
    }
  };

  // Update the `handleSaveReceipt` for new receipts
  const handleSaveReceiptSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save receipts.",
        variant: "destructive",
      });
      return;
    }

    setIsBusy(true);
    setFormErrors({}); // Clear previous errors

    // Use the correct form state for validation and saving
    const activeFormData = editingReceipt ? editForm : formData;

    // Basic validation for required fields
    const missingFields = [];
    if (!activeFormData.merchant) missingFields.push('merchant');
    if (!activeFormData.total) missingFields.push('total');
    if (!activeFormData.date) missingFields.push('date');
    if (!activeFormData.items || activeFormData.items.length === 0) missingFields.push('items');

    if (missingFields.length > 0) {
      setFormErrors({
        merchant: !activeFormData.merchant ? 'Merchant is required.' : '',
        date: !activeFormData.date ? 'Date is required.' : '',
        total: !activeFormData.total ? 'Total amount is required.' : '',
        items: !activeFormData.items || activeFormData.items.length === 0 ? 'At least one item is required.' : ''
      });
      toast({
        title: "Missing Information",
        description: getFunnyMissingMessage(missingFields),
        variant: "destructive",
      });
      setIsBusy(false);
      return;
    }

    // Ensure all items have a name and a valid price
    const cleanedItems = (activeFormData.items || []).filter(item => item.name && parseFloat(item.price) > 0).map(item => ({
      name: item.name,
      price: parseFloat(item.price)
    }));

    if (cleanedItems.length === 0) {
      setFormErrors({
        items: 'Please ensure all items have a name and a valid price.'
      });
      toast({
        title: "Invalid Items",
        description: "Please ensure all items have a name and a valid price.",
        variant: "destructive",
      });
      setIsBusy(false);
      return;
    }

    // Calculate tax if not manually entered (total - subtotal)
    let calculatedTax = parseFloat(activeFormData.tax) || 0;
    if (!activeFormData.tax && activeFormData.total && activeFormData.subtotal) {
      calculatedTax = parseFloat(activeFormData.total) - parseFloat(activeFormData.subtotal);
      if (isNaN(calculatedTax) || calculatedTax < 0) calculatedTax = 0; // Ensure non-negative tax
    }

    const receiptData = {
      userId: user.uid,
      merchant: activeFormData.merchant,
      date: serverTimestamp(), // Use server timestamp for consistency
      transactionDate: activeFormData.date, // Keep original date string for display
      total: parseFloat(activeFormData.total),
      subtotal: parseFloat(activeFormData.subtotal),
      tax: calculatedTax,
      paymentMethod: activeFormData.paymentMethod || 'Other',
      currency: activeFormData.currency,
      items: cleanedItems,
      imageUrl: activeFormData.imageUrl || '',
      category: activeFormData.category || 'Uncategorized', // Ensure category is never undefined
      createdAt: serverTimestamp()
    };

    console.log("Receipt data being sent to Firestore:", receiptData);

    try {
      if (editingReceipt) {
        // Update existing receipt
        await updateDoc(doc(db, "receipts", editingReceipt.id), receiptData);
        toast({
          title: "Receipt Updated! 🚀",
          description: "Your receipt has been successfully updated.",
        });
      } else {
        // Create new receipt
      await addDoc(collection(db, "receipts"), receiptData);
      toast({
        title: "Receipt Saved! 🎉",
        description: "Your expense has been successfully recorded.",
      });
      }
      // Reset form and close modal
      setFormData({ // Ensure formData is reset for next new entry
        date: new Date().toISOString().split('T')[0],
        merchant: '',
        total: '',
        tax: '',
        subtotal: '',
        paymentMethod: '',
        currency: 'EUR',
        items: [],
        category: ''
      });
      setNewItem({ name: '', price: '' });
      setEditingReceipt(null);
      setIsEditing(false);
      setFile(null);
      setPreviewImageSrc(null);
      setCurrentStep('upload_options');
      fetchReceipts();
    } catch (error) {
      console.error("Error saving receipt:", error);
      toast({
        title: editingReceipt ? "Error Updating Receipt 😥" : "Error Saving Receipt 😥",
        description: `There was an issue saving your receipt: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  };

  // Update the `handleEditSave` for existing receipts
  const handleEditSaveSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save changes.",
        variant: "destructive",
      });
      return;
    }

    if (!editingReceipt) {
      toast({
        title: "Error",
        description: "No receipt selected for editing.",
        variant: "destructive",
      });
      return;
    }

    // Validate essential fields for edit form
    if (!editForm.merchant || !editForm.date || !editForm.total) { // Use editForm.total here
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields: Merchant, Total, and Date.",
        variant: "destructive",
      });
      return;
    }

    // Validate items in edit form
    const hasIncompleteItem = editForm.items.some(item => (item.name && !item.price) || (!item.name && item.price));
    if (hasIncompleteItem) {
      toast({
        title: "Incomplete Item",
        description: "Please ensure all items have both a name and a price, or remove incomplete items.",
        variant: "destructive",
      });
      return;
    }

    setIsBusy(true);

    try {
      const parsedTotal = parseFloat(editForm.total); // Use editForm.total
      const parsedSubtotal = parseFloat(editForm.subtotal);

      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        toast({
          title: "Invalid Total Amount",
          description: "Please enter a valid positive number for the total amount.",
          variant: "destructive",
        });
        return;
      }
      if (editForm.subtotal && (isNaN(parsedSubtotal) || parsedSubtotal < 0)) {
        toast({
          title: "Invalid Subtotal",
          description: "Please enter a valid non-negative number for the subtotal.",
          variant: "destructive",
        });
        return;
      }

      // Calculate tax if not provided
      let taxAmount = parseFloat(editForm.tax); // Use editForm.tax
      if (isNaN(taxAmount) || editForm.tax === '') {
        taxAmount = (parsedTotal - (parsedSubtotal || parsedTotal)).toFixed(2); // If subtotal exists, tax is total - subtotal, else 0
      } else {
        taxAmount = taxAmount.toFixed(2);
      }

      const updatedReceiptData = {
        userId: user.uid, // Use userId for consistency
        merchant: editForm.merchant,
        total: parsedTotal.toFixed(2), // Store as string with 2 decimal places
        subtotal: parsedSubtotal ? parsedSubtotal.toFixed(2) : undefined, // Store as string with 2 decimal places
        tax: parseFloat(taxAmount).toFixed(2), // Ensure tax is also 2 decimal places
        transactionDate: editForm.date, // Use transactionDate for consistency
        category: editForm.category,
        paymentMethod: editForm.payment_method,
        currency: editForm.currency || editingReceipt.currency || settings.baseCurrency,
        items: editForm.items.map(item => ({
          name: item.name,
          price: parseFloat(item.price).toFixed(2) // Ensure item prices are 2 decimal places
        })),
        updated_at: serverTimestamp()
      };

      await updateDoc(doc(db, "receipts", editingReceipt.id), updatedReceiptData);
      toast({
        title: "Receipt Updated! 🚀",
        description: "Your receipt has been successfully updated.",
      });

      // Reset editing state and close modal
      setEditingReceipt(null);
      setIsEditing(false);
      setCurrentStep('upload_options');
      fetchReceipts();
    } catch (error) {
      console.error("Error updating receipt:", error);
      toast({
        title: "Error Updating Receipt 😥",
        description: `There was an issue updating your receipt: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
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

  // Helper for adding new item fields dynamically
  const handleAddItemField = (insertIndex) => {
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;
    targetStateSetter(prevData => {
      const newItems = [...(prevData.items || [])];
      newItems.splice(insertIndex, 0, { name: '', price: '' });
      return { ...prevData, items: newItems };
    });
    if (editingReceipt) {
    setCurrentReceipt(prev => {
      const newItems = [...(prev.items || [])];
      newItems.splice(insertIndex, 0, { name: '', price: '' });
      return { ...prev, items: newItems };
    });
    }
  };

  // Helper for removing item fields dynamically
  const handleRemoveItemField = (removeIndex) => {
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;
    targetStateSetter(prevData => {
      if ((prevData.items || []).length === 1 && (!prevData.items[0].name && !prevData.items[0].price)) {
        return prevData; // Prevent removing the last empty item if it's the only one
      }
      if ((prevData.items || []).length > 0) {
        const newItems = (prevData.items || []).filter((_, i) => i !== removeIndex);
        return { ...prevData, items: newItems };
      }
      return prevData; // Do nothing if trying to remove from empty list
    });
    if (editingReceipt) {
    setCurrentReceipt(prev => {
        if ((prev.items || []).length === 1 && (!prev.items[0].name && !prev.items[0].price)) {
        return prev;
      }
        if ((prev.items || []).length > 0) {
          const newItems = (prev.items || []).filter((_, i) => i !== removeIndex);
        return { ...prev, items: newItems };
      }
      return prev;
    });
    }
  };

  // Determine which form state to use based on editingReceipt
  const activeFormData = editingReceipt ? editForm : formData;

  // Update the receipt card rendering
  const renderReceiptCard = (receipt) => {
    const isExpanded = expandedReceiptId === receipt.id;
    const amount = parseFloat(receipt.total);
    const isNegative = isNaN(amount) || amount < 0;
    const catColor = getCategoryColor(receipt.category);
    const isSwiped = swipedId === receipt.id;
    const { progress, dir } = getSwipeProgress(receipt.id);
    return (
      <div
        className="relative w-full"
        onTouchStart={e => handleTouchStart(receipt.id, e)}
        onTouchMove={e => handleTouchMove(receipt.id, e)}
        onTouchEnd={() => handleTouchEnd(receipt.id)}
      >
        {/* Swipe backgrounds with animated icon */}
        <div
          className={`absolute inset-0 z-0 flex items-center transition-all duration-200 ${dir === 'left' ? 'justify-end pr-8' : dir === 'right' ? 'justify-start pl-8' : ''}`}
          style={{
            background: dir === 'left'
              ? `rgba(220,38,38,${progress * 0.8})` // red-600
              : dir === 'right'
              ? `rgba(37,99,235,${progress * 0.8})` // blue-600
              : 'transparent',
            borderRadius: '1rem',
            pointerEvents: 'none',
          }}
        >
          {dir === 'left' && (
            <Trash2
              className="h-7 w-7 text-white"
              style={{
                opacity: progress,
                transform: `scale(${0.8 + 0.4 * progress})`,
                transition: 'all 0.2s',
              }}
            />
          )}
          {dir === 'right' && (
            <Edit
              className="h-7 w-7 text-white"
              style={{
                opacity: progress,
                transform: `scale(${0.8 + 0.4 * progress})`,
                transition: 'all 0.2s',
              }}
            />
          )}
        </div>
        <Card
          id={`receipt-card-${receipt.id}`}
          key={receipt.id}
          style={{
            minHeight: 96,
            transform: `translateX(${swipeOffset[receipt.id] || 0}px)`,
            transition: swipeOffset[receipt.id] ? 'none' : 'transform 0.5s cubic-bezier(0.22,1,0.36,1)', // springy
          }}
          className={`relative bg-slate-800/90 p-5 pl-4 rounded-2xl shadow-xl text-white border border-blue-900/30 border-l-4 ${catColor} transition-all duration-300 ease-in-out animate-fade-in-up ${isExpanded ? 'ring-2 ring-blue-500/50 scale-[1.01] shadow-2xl' : 'hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98]'}`}
          onClick={() => setExpandedReceiptId(isExpanded ? null : receipt.id)}
          aria-label={`Receipt for ${receipt.merchant}`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg font-extrabold text-blue-200 truncate max-w-[120px] md:max-w-[200px] tracking-tight" title={receipt.merchant}>{receipt.merchant}</span>
                <span className="text-xs text-blue-200/80 font-medium whitespace-nowrap">{formatDateSafely(receipt.transactionDate, 'DD MMM')}</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-2xl font-extrabold ${isNegative ? 'text-red-400' : 'text-blue-100'}`}>{isNegative ? '0.00' : amount.toFixed(2)}</span>
                <span className="text-sm text-blue-200/80 ml-1">{receipt.currency}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end ml-2">
          <Button
                onClick={e => { e.stopPropagation(); handleEditClick(receipt); }}
            variant="ghost"
            size="icon"
                className="text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 transition-transform duration-150 ease-in-out active:scale-90"
                aria-label="Edit receipt"
          >
                <Edit className="h-5 w-5" />
          </Button>
          <Button
                onClick={e => { e.stopPropagation(); handleDeleteReceipt(receipt.id); }}
            variant="ghost"
            size="icon"
                className="text-red-400 hover:bg-blue-900/40 hover:text-red-300 transition-transform duration-150 ease-in-out active:scale-90"
                aria-label="Delete receipt"
          >
                <Trash2 className="h-5 w-5" />
          </Button>
          </div>
          </div>
          {isExpanded && (
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
                  <p className="text-xs text-blue-200/70">Subtotal</p>
                  <p className="text-base">{receipt.subtotal ? parseFloat(receipt.subtotal).toFixed(2) : '-'}</p>
          </div>
          <div>
                  <p className="text-xs text-blue-200/70">Tax</p>
                  <p className="text-base">{receipt.tax ? parseFloat(receipt.tax).toFixed(2) : '-'}</p>
        </div>
          <div>
                  <p className="text-xs text-blue-200/70">Payment</p>
                  <p className="text-base">{receipt.paymentMethod || 'Not specified'}</p>
          </div>
          <div>
                  <p className="text-xs text-blue-200/70">Category</p>
                  <p className="text-base flex items-center gap-1">{receipt.category || 'Uncategorized'}
                    <span className={`inline-block w-2 h-2 rounded-full ml-1 ${catColor.replace('border-l-4', 'bg-')}`}></span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-200/70">Date</p>
                  <p className="text-base">{formatDateSafely(receipt.transactionDate, 'DD MMM YYYY')}</p>
          </div>
        </div>
        {receipt.items && receipt.items.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-blue-200/70 mb-1">Items</p>
                  <ul className="space-y-1 list-disc list-inside">
              {receipt.items.map((item, index) => (
                <li key={index} className="flex justify-between text-sm">
                        <span className="truncate max-w-[100px]">{item.name}</span>
                        <span>{parseFloat(item.price).toFixed(2)} {receipt.currency}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
          )}
    </Card>
      </div>
    );
  };

  const startCamera = async () => {
    console.log('startCamera called');
    console.log('video element in startCamera: ', _videoElement);
    if (!_videoElement) {
      console.error('Attempted to start camera but _videoElement is null.');
      toast({
        title: "Camera Error",
        description: "Video element not available. Please try again.",
        variant: "destructive",
      });
      setIsCameraReady(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera for better receipt photos
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      console.log('Camera stream obtained:', stream);
      _videoElement.srcObject = stream;
      _videoElement.onloadedmetadata = () => {
        console.log('Video metadata loaded, playing video...');
        _videoElement.play()
          .then(() => {
            console.log('Video playback started successfully');
            setIsCameraReady(true);
          })
          .catch(error => {
            console.error('Error playing video:', error);
            setIsCameraReady(false);
          });
      };
      console.log('Camera stream assigned. Camera is ready.');
    } catch (error) {
      console.error("Error accessing camera:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      toast({
        title: "Camera Access Denied",
        description: "Please grant camera access to use this feature.",
        variant: "destructive",
      });
      setIsCameraReady(false);
    }
  };

  const stopCamera = () => {
    if (_videoElement && _videoElement.srcObject) {
      const tracks = _videoElement.srcObject.getTracks();
      tracks.forEach(track => {
        track.stop();
        track.enabled = false;
      });
      _videoElement.srcObject = null;
      _videoElement = null;
      console.log('Camera stream stopped and tracks released.');
    }
    setIsCameraOpen(false);
    setIsCameraReady(false);
  };

  const capturePhoto = () => {
    if (_videoElement && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = _videoElement.videoWidth;
      canvasRef.current.height = _videoElement.videoHeight;
      context.drawImage(_videoElement, 0, 0, canvasRef.current.width, canvasRef.current.height);
      setPreviewImageSrc(canvasRef.current.toDataURL('image/jpeg'));
      setShowFullScreenPreview(true);
      setIsCameraOpen(false); // Close the camera modal after capturing
      stopCamera(); // Stop the camera stream
    }
  };

  const handleConfirmPreview = () => {
    if (previewImageSrc) {
      setIsLoading(true);
      setCurrentFunnyMessage(getRandomFunnyMessage());
      setShowFullScreenPreview(false);
      // Convert base64 to blob and process it
      fetch(previewImageSrc)
        .then(res => res.blob())
        .then(blob => {
          processOCR(blob);
        })
        .catch(error => {
          console.error('Error processing captured image:', error);
          toast({
            title: "Error Processing Image",
            description: "There was an issue processing your captured image. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
        });
    }
  };

  const handleRetakePreview = () => {
    setShowFullScreenPreview(false);
    setPreviewImageSrc(null);
    setIsCameraOpen(true); // Reopen camera for retake
  };

  const handleEditClick = (receipt) => {
    setEditingReceipt(receipt);

    // Safely parse numbers for initial editForm state
    const safeParseFloat = (value) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
    };

    setEditForm({
      merchant: receipt.merchant || '',
      total: safeParseFloat(receipt.total), // Always set 'total' as string with two decimals
      date: receipt.transactionDate || '',
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
  };

  const processOCR = async (file) => {
    try {
      setIsOcrProcessing(true);
      setOcrError(null);
      const base64 = await toBase64(file);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this receipt image and extract the following information in JSON format:
1. Store/Merchant name
2. Total amount
3. Date
4. Category (choose from: Groceries, Dining, Transportation, Shopping, Bills, Entertainment, Health, Other)
5. Payment Method (e.g., Cash, Credit Card, Debit Card, Mobile Payment)
6. Currency (detect from the receipt, looking for currency symbols or codes like €, $, £, ¥, etc.)
7. Items (list of items with their prices)

Consider these guidelines for categorization:
- Groceries: Supermarkets, food stores, grocery items
- Dining: Restaurants, cafes, fast food, takeout
- Transportation: Gas stations, public transport, taxis, car services
- Shopping: Retail stores, clothing, electronics, general merchandise
- Bills: Utilities, services, subscriptions
- Entertainment: Movies, events, leisure activities
- Health: Medical, pharmacy, wellness
- Other: Any items that don't fit the above categories

For currency detection, look for:
- Currency symbols (€, $, £, ¥, etc.)
- Currency codes (EUR, USD, GBP, JPY, etc.)
- Regional formats (e.g., €1.234,56 for European format, $1,234.56 for US format)
- Currency indicators in the header or footer of the receipt
- Currency mentioned in the payment section
- Currency symbols next to prices

For payment method, look for:
- Credit/Debit card logos or names
- Cash indicators
- Mobile payment symbols (Apple Pay, Google Pay, etc.)
- Contactless payment indicators

Reply with a JSON object enclosed in triple backticks like this:
\`\`\`json
{
  "store": "Store Name",
  "amount": "23.50",
  "date": "13/06/2025",
  "category": "Category Name",
  "payment_method": "Payment Method",
  "currency": "EUR",
  "items": [
    {"name": "Item 1", "price": "10.00"},
    {"name": "Item 2", "price": "13.50"}
  ]
}
\`\`\`

Note: For currency, return the standard 3-letter currency code (e.g., EUR, USD, GBP, JPY) based on the detected currency.`
                },
                { type: "image_url", image_url: { url: base64 } }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      const data = await response.json();
      const replyText = data?.choices?.[0]?.message?.content || '';
      console.log("OCR Raw Response:\n", replyText);

      const jsonMatch = replyText.match(/```json\s*({[\s\S]*?})\s*```/i);
      if (!jsonMatch || !jsonMatch[1]) {
        console.error("OCR parsing error: No valid JSON block found in the response.", replyText);
        throw new Error("No valid JSON block found in the OCR response.");
      }

      const parsedJSON = JSON.parse(jsonMatch[1]);

      // Update form data with the extracted information
      setFormData(prev => ({
        ...prev,
        merchant: parsedJSON.store || '',
        total: parsedJSON.amount ? parsedJSON.amount.replace(/[^\d.,]/g, '').replace(',', '.') : '',
        date: parsedJSON.date ? normalizeDate(parsedJSON.date) : '',
        category: parsedJSON.category || '',
        paymentMethod: parsedJSON.payment_method || '',
        currency: parsedJSON.currency || 'EUR', // Use detected currency or default to EUR
        items: parsedJSON.items?.map(item => ({
          name: item.name || '',
          price: item.price ? item.price.replace(/[^\d.,]/g, '').replace(',', '.') : ''
        })) || []
      }));

      setCurrentStep('receipt_form');
    } catch (error) {
      console.error('OCR error:', error);
      setOcrError('Failed to process receipt. Please try again or enter manually.');
      toast({
        title: "OCR Processing Error",
        description: "Failed to process the receipt. Please try again or enter the details manually.",
        variant: "destructive",
      });
    } finally {
      setIsOcrProcessing(false);
      setIsLoading(false);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
          const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
        });

  // Add a function to reset form data with today's date
  const resetFormData = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      merchant: '',
      total: '',
      tax: '',
      subtotal: '',
      paymentMethod: '',
      currency: 'EUR',
      items: [],
      category: ''
    });
  };

  // Add a ref for the merchant input
  const merchantInputRef = useRef(null);

  // Update the handleManualEntry function to focus on merchant field
  const handleManualEntry = () => {
    resetFormData();
    setCurrentStep('manual_entry');
    // Use setTimeout to ensure the modal is open before focusing
    setTimeout(() => {
      merchantInputRef.current?.focus();
    }, 100);
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

  // Add a helper to get the currency symbol
  const getCurrencySymbol = (code) => {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === code);
    return currency ? currency.symbol : code;
  };

  // Add a helper to format currency with locale-aware symbol placement and postfix exceptions
  const postfixCurrencies = ['SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'];
  const formatCurrency = (amount, currencyCode = 'EUR') => {
    if (amount === null || amount === undefined) return '';
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

  // Add swipe handlers:
  const handleTouchStart = (id, e) => {
    setSwipeStartX(prev => ({ ...prev, [id]: e.touches[0].clientX }));
  };
  const handleTouchMove = (id, e) => {
    if (swipeStartX[id] == null) return;
    const dx = e.touches[0].clientX - swipeStartX[id];
    setSwipeOffset(prev => ({ ...prev, [id]: dx }));
  };
  const handleTouchEnd = (id) => {
    const offset = swipeOffset[id] || 0;
    const card = document.getElementById(`receipt-card-${id}`);
    const width = card ? card.offsetWidth : 1;
    const threshold = width * 0.4;
    if (offset > threshold) {
      try { navigator.vibrate && navigator.vibrate(30); } catch {}
      setTimeout(() => {
        setSwipeOffset(prev => ({ ...prev, [id]: 0 }));
        setSwipeStartX(prev => ({ ...prev, [id]: undefined }));
        handleEditClick(receipts.find(r => r.id === id));
      }, 150);
    } else if (offset < -threshold) {
      try { navigator.vibrate && navigator.vibrate([30, 30, 30]); } catch {}
      setTimeout(() => {
        setSwipeOffset(prev => ({ ...prev, [id]: 0 }));
        setSwipeStartX(prev => ({ ...prev, [id]: undefined }));
        setPendingDeleteId(id);
        setShowDeleteModal(true);
      }, 150);
    } else {
      setSwipeOffset(prev => ({ ...prev, [id]: 0 }));
      setSwipeStartX(prev => ({ ...prev, [id]: undefined }));
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

  return (
    <div className={`relative flex flex-col items-center w-full ${className}`}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-blue-400/20 max-w-md w-full mx-4 text-center">
            {/* Receipt Animation */}
            <div className="relative h-20 mb-6 flex items-center justify-center">
              <div className="absolute w-24 h-32 bg-white rounded-lg shadow-lg transform -rotate-6 animate-bounce-slow">
                <div className="p-2">
                  <div className="h-2 bg-gray-200 rounded w-3/4 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-2/3 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/3 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2 mb-1 animate-pulse"></div>
                </div>
              </div>
              <div className="absolute w-24 h-32 bg-white rounded-lg shadow-lg transform rotate-6 animate-bounce-slow-delayed">
                <div className="p-2">
                  <div className="h-2 bg-gray-200 rounded w-3/4 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-2/3 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/3 mb-1 animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2 mb-1 animate-pulse"></div>
                </div>
              </div>
            </div>
            <p className="text-xl text-white font-medium mb-2">Processing your receipt...</p>
            <p className="text-lg text-blue-300 animate-pulse">{currentFunnyMessage}</p>
          </div>
          </div>
        )}

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 mt-8 mb-12">
        {/* Dashboard Header */}
        <div className="text-center mb-8 w-full max-w-4xl">
          <h1 className="text-4xl font-extrabold text-white mb-4">
            {/* Removed: Your Expense Dashboard */}
          </h1>
          <p className="text-xl text-gray-300">
            {/* Removed: Ready to conquer your expenses? Upload receipts, track spending, and gain insights with ease. */}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 w-full">
          {/* Choose Upload Method Card */}
          <Card className="w-full md:w-1/3 p-6 flex flex-col items-center justify-start gap-6 bg-slate-800/80 text-white shadow-2xl rounded-xl border border-blue-400/20">
            <CardHeader className="w-full text-center p-0 mb-4">
              <CardTitle className="text-2xl font-bold text-blue-100">Choose Upload Method</CardTitle>
            </CardHeader>
            <CardContent className="w-full flex flex-col items-center justify-center gap-4 p-0">
              {file && <p className="text-sm text-gray-400 mb-2">File: {file.name}</p>}
                  <input
                    type="file"
                id="fileInput"
                    ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
                  />
                <Button
                onClick={() => document.getElementById('fileInput').click()}
                className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
                >
                <Upload className="h-5 w-5" />
                Upload File
                </Button>
              <Button
                onClick={() => {
                  setIsCameraOpen(true);
                }}
                className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </Button>
              <Button
                onClick={handleManualEntry}
                className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              >
                <List className="h-5 w-5" />
                Enter Manually
              </Button>
            </CardContent>
          </Card>

          {/* Combined Total Expenses and Your Receipts Card */}
          <Card className="w-full md:w-2/3 p-6 flex flex-col items-center justify-start gap-6 bg-slate-800/80 text-white shadow-2xl rounded-xl border border-blue-400/20">
            <CardHeader className="w-full text-center p-0 mb-4">
              <CardTitle className="text-2xl font-bold text-blue-100">Your Financial Overview</CardTitle>
            </CardHeader>
            <CardContent className="w-full flex flex-col items-center justify-center p-0">
              {/* Total Expenses Section */}
              <div className="w-full text-center mb-6">
                <p className="text-sm text-gray-400">Total Expenses</p>
                <p className="text-5xl font-extrabold text-indigo-400 mb-4">
                  {formatCurrency(totalExpenses, settings?.baseCurrency || 'EUR')}
                </p>
                <div className="space-y-2 w-full px-4">
                  {Object.entries(categoryTotals).length > 0 ? (
                    Object.entries(categoryTotals)
                      .sort(([, amountA], [, amountB]) => amountB - amountA) // Sort by amount descending
                      .map(([category, amount]) => (
                        <div key={category} className="flex justify-between items-center text-gray-300 text-sm">
                          <span>{category}</span>
                          <span>{formatCurrency(amount, settings?.baseCurrency || 'EUR')}</span>
                </div>
                      ))
                  ) : (
                    <p className="text-center text-gray-400 text-md">No categorized expenses yet.</p>
                  )}
                        </div>
              </div>

              {/* Your Receipts Section */}
              <div className="w-full mt-6">
                <h2 className="text-xl font-bold text-blue-100 text-center mb-4">Your Receipts</h2>
                {isFirestoreLoading ? (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>{currentFunnyMessage}</p>
                  </div>
                ) : firestoreError ? (
                  <div className="text-center text-red-400">
                    <XCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>{firestoreError}</p>
                    <Button onClick={fetchReceipts} className="mt-4">Try Again</Button>
                  </div>
                ) : receipts.length === 0 ? (
                  <div className="text-center">
                    <p className="text-xl text-slate-400 font-semibold mb-2">No receipts yet!</p>
                    <p className="text-md text-slate-500">
                      It's a blank canvas for your financial journey. <br />
                      Start by <span className="text-blue-400 font-medium">uploading your first receipt</span> or <span className="text-blue-400 font-medium">adding one manually</span>.
                      </p>
                    </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-4 w-full max-h-[400px] overflow-y-auto pr-2 mb-12">
                    {console.log('Rendering receipts. Current settings for map:', settings)}
                    {receipts.map(renderReceiptCard)}
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receipt Form Modal (for Manual Entry and OCR-populated forms) */}
        <Dialog 
          open={currentStep === 'receipt_form' || currentStep === 'manual_entry'} 
          onOpenChange={(open) => {
          if (!open) {
              setCurrentStep('upload_options');
              setEditingReceipt(null);
            setFormData({ date: '', merchant: '', total: '', tax: '', subtotal: '', paymentMethod: '', currency: 'EUR', items: [], category: '' });
            setNewItem({ name: '', price: '' });
              setFile(null);
              setPreviewImageSrc(null);
            }
          }}
        >
          <DialogContent 
            className="w-full max-w-lg md:max-w-2xl bg-gradient-to-b from-blue-900 via-slate-900/95 to-slate-900 text-white border-none p-4 md:p-8 rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden fixed top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] max-h-[90vh] z-50 flex flex-col"
            style={{ touchAction: 'manipulation', backdropFilter: 'blur(10px)' }}
            onPointerDownOutside={e => e.preventDefault()}
            onInteractOutside={e => e.preventDefault()}
          >
            <DialogHeader className="mb-2 animate-fade-in duration-300 ease-in-out">
              <DialogTitle className="text-xl md:text-2xl font-bold text-blue-200 text-center tracking-tight">{editingReceipt ? 'Edit Receipt' : 'New Receipt'}</DialogTitle>
              <DialogDescription className="text-blue-300/80 text-center text-sm md:text-base">{editingReceipt ? 'Edit your receipt details below.' : 'Enter your receipt details below.'}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-2 overflow-y-auto max-h-[60vh] pb-24 animate-fade-in duration-300 ease-in-out">
              <form onSubmit={handleSaveReceiptSubmit} autoComplete="off" className="space-y-8 md:space-y-10 px-1 md:px-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in duration-200 ease-in-out">
                  <div className="space-y-2">
                    <Label htmlFor="merchant">Merchant</Label>
                    <Input
                      id="merchant"
                      name="merchant"
                      ref={merchantInputRef}
                      value={activeFormData.merchant}
                      onChange={handleFormInputChange}
                      className="bg-slate-800/90 border border-blue-700/40 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                      placeholder="Enter merchant name"
                      autoCapitalize="words"
                      autoFocus
                      inputMode="text"
                    />
                    {formErrors.merchant && <p className="text-red-400 text-xs mt-1 animate-fade-in duration-200 ease-in-out">{formErrors.merchant}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total">Total Amount</Label>
                    <div className="flex items-center">
                    <Input
                        id="total"
                        name="total"
                      type="number"
                        inputMode="decimal"
                        step="0.01"
                      placeholder="0.00"
                        value={activeFormData.total}
                        onChange={handleFormInputChange}
                        className="w-full bg-slate-800/90 border border-blue-700/40 text-white text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                      />
                      <span className="ml-2 text-blue-200 text-sm">{getCurrencySymbol(activeFormData.currency)}</span>
                    </div>
                    {formErrors.total && <p className="text-red-400 text-xs mt-1 animate-fade-in duration-200 ease-in-out">{formErrors.total}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtotal">Subtotal <span className="text-blue-200/60">(Optional)</span></Label>
                    <div className="flex items-center">
                    <Input
                        id="subtotal"
                        name="subtotal"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        placeholder="0.00"
                        value={activeFormData.subtotal}
                        onChange={handleFormInputChange}
                        className="w-full bg-slate-800/90 border border-blue-700/40 text-white text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                      />
                      <span className="ml-2 text-blue-200 text-sm">{getCurrencySymbol(activeFormData.currency)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={activeFormData.paymentMethod}
                      onValueChange={value => handleFormInputChange({ target: { name: 'paymentMethod', value } })}
                    >
                      <SelectTrigger className="w-full bg-slate-800/90 border border-blue-700/40 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent className="bg-blue-950 text-white border-blue-700/40">
                        {['Cash', 'Credit Card', 'Debit Card', 'Mobile Pay', 'Bank Transfer', 'Other'].map(method => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border-t border-blue-700/30 my-4" />
                <div className="mt-2">
                  <h3 className="text-base font-semibold text-blue-100 mb-2 animate-fade-in duration-200 ease-in-out">Items</h3>
                  {(activeFormData.items || []).map((item, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2 animate-fade-in-up transition-transform duration-200 ease-in-out hover:scale-[1.02]">
                              <Input
                        id={`item-name-${index}`}
                                placeholder="Item Name"
                        value={item.name || ''}
                        onChange={e => handleItemInputChange(e, index, 'name')}
                        className="flex-[2] min-w-0 bg-slate-800/90 border border-blue-700/40 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                        autoCapitalize="words"
                        inputMode="text"
                              />
                              <Input
                        id={`item-price-${index}`}
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.price}
                        onChange={e => handleItemInputChange(e, index, 'price')}
                        onBlur={e => {
                          const value = e.target.value;
                          const parsed = parseFloat(value.replace(',', '.')).toFixed(2);
                          handleItemInputChange({ target: { value: isNaN(parsed) ? '' : parsed } }, index, 'price');
                        }}
                        className="flex-[1] w-20 bg-slate-800/90 border border-blue-700/40 text-white text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                      />
                      <span className="text-blue-200">{getCurrencySymbol(activeFormData.currency)}</span>
                        <Button
                          type="button"
                        onClick={() => {
                          const targetStateSetter = editingReceipt ? setEditForm : setFormData;
                          targetStateSetter(prev => ({
                            ...prev,
                            items: (prev.items || []).filter((_, i) => i !== index)
                          }));
                          if (editingReceipt) {
                            setCurrentReceipt(prev => ({
                              ...prev,
                              items: (prev.items || []).filter((_, i) => i !== index)
                            }));
                          }
                        }}
                          variant="ghost"
                          size="icon"
                        className="text-red-400 hover:bg-blue-900/40 hover:text-red-300 transition-transform duration-150 ease-in-out active:scale-90"
                        aria-label="Remove item"
                        >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                        </div>
                  ))}
                  <div className="flex items-end gap-2 mt-2 animate-fade-in-up duration-200 ease-in-out">
                    <div className="flex-1">
                      <Label htmlFor="new-item-name">New Item Name</Label>
                        <Input
                        id="new-item-name"
                          type="text"
                        placeholder="Add new item name"
                        value={editingReceipt ? currentNewItem.name : newItem.name}
                        onChange={e => editingReceipt ? setCurrentNewItem({ ...currentNewItem, name: e.target.value }) : setNewItem({ ...newItem, name: e.target.value })}
                        className="flex-[2] min-w-0 bg-slate-800/90 border border-blue-700/40 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                        autoCapitalize="words"
                        inputMode="text"
                        />
                    </div>
                    <div className="w-28">
                      <Label htmlFor="new-item-price">Price</Label>
                        <Input
                          id="new-item-price"
                          type="number"
                        inputMode="decimal"
                          placeholder="0.00"
                        value={editingReceipt ? currentNewItem.price : newItem.price}
                        onChange={e => editingReceipt ? setCurrentNewItem(prev => ({ ...prev, price: e.target.value })) : setNewItem(prev => ({ ...prev, price: e.target.value }))}
                        className="flex-[1] w-20 bg-slate-800/90 border border-blue-700/40 text-white text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none"
                      />
                      </div>
                    <div className="flex flex-col justify-end pb-1">
                      <span className="text-blue-200 text-sm">{getCurrencySymbol(activeFormData.currency)}</span>
                  </div>
                  <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={editingReceipt ? handleEditItemAdd : handleAddItem}
                      disabled={editingReceipt ? (!currentNewItem.name.trim() || !currentNewItem.price.trim()) : (!newItem.name.trim() || !newItem.price.trim())}
                      className="text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 transition-transform duration-150 ease-in-out active:scale-90"
                      aria-label="Add item"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </Button>
                </div>
                  {formErrors.items && <p className="text-red-400 text-xs mt-1 animate-fade-in duration-200 ease-in-out">{formErrors.items}</p>}
          </div>
              </form>
            </ScrollArea>
            <div className="flex justify-end gap-4 pt-6 border-t border-blue-700/30 mt-8 bg-transparent">
                <Button
                    type="button" 
                    variant="secondary" 
                    onClick={() => {
                      setCurrentStep('upload_options');
                      setEditingReceipt(null);
                  setIsEditing(false);
                  resetFormData();
                    }} 
                className="bg-slate-700/90 hover:bg-blue-900 text-white text-base py-3 rounded-xl shadow-md transition-all duration-150 ease-in-out px-8"
                  >
                    Cancel
                </Button>
                  <Button 
                    type="submit" 
                onClick={handleSaveReceiptSubmit}
                className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white text-base font-semibold py-3 rounded-xl shadow-xl transition-all duration-200 ease-in-out transform hover:scale-105 px-8"
                style={{ minWidth: 140 }}
              >
                {isBusy ? <span className="animate-spin mr-2">⏳</span> : (editingReceipt ? 'Save Changes' : 'Save Receipt')}
                  </Button>
            </div>
          </DialogContent>
        </Dialog>
                  </div>

      {/* Full-screen camera preview modal */}
      {showFullScreenPreview && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
          <img src={previewImageSrc} alt="Preview" className="max-w-full max-h-[80vh] object-contain mb-4" />
          <div className="flex space-x-4">
                <Button
              onClick={handleRetakePreview}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
              Retake
                </Button>
                <Button
              onClick={handleConfirmPreview}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
              Use Image
                </Button>
            </div>
          </div>
        )}

      {/* Camera Modal */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => {
        if (!open) {
          stopCamera(); // Ensure camera is stopped when modal is closed
        }
        setIsCameraOpen(open);
      }}>
        <DialogContent className="sm:max-w-[600px] bg-slate-800 text-white border-gray-700 p-6 rounded-lg shadow-xl animate-fade-in flex flex-col items-center">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold text-gray-100">Take Photo</DialogTitle>
            <DialogDescription className="text-gray-400">
              Position your receipt within the frame and click capture.
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full max-w-[560px] h-[420px] bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            {!isCameraReady && (
              <p className="absolute text-gray-400">Camera not ready or access denied.</p>
            )}
            {/* Funny Guide Frame for Receipt positioning */}
            <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
              <div className="w-full h-full border-2 border-dashed border-blue-400 rounded-lg opacity-70 flex items-center justify-center text-blue-300 text-sm font-semibold text-center leading-tight">
                Position your<br/>receipt here!<br/>(Scan me!) 📸
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
          <div className="mt-4 flex space-x-4">
            <Button onClick={stopCamera} className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded">
              <X className="h-5 w-5 mr-2" /> Close Camera
            </Button>
            <Button onClick={capturePhoto} disabled={!isCameraReady} className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded">
              <Camera className="h-5 w-5 mr-2" /> Capture Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <footer className="w-full text-center py-4 text-gray-400 text-sm mt-8 mb-4">
        Powered with <span className="animate-very-slow-pulse inline-block">❤️</span> by ExpenseApp
      </footer>
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-xs bg-red-600/95 text-white border-none rounded-2xl shadow-2xl animate-fade-in-up">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Trash2 className="h-6 w-6 text-yellow-200 animate-bounce" />
              Delete Receipt?
            </DialogTitle>
            <DialogDescription className="text-white/80 mt-2">
              This action <span className="font-bold text-yellow-200">cannot be undone</span>.<br />
              Are you sure you want to send this receipt to the digital shredder?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20 rounded-lg px-4 py-2"
              onClick={() => { setShowDeleteModal(false); setPendingDeleteId(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-yellow-400 text-red-700 font-bold hover:bg-yellow-300 rounded-lg px-4 py-2 shadow-md animate-pulse"
              onClick={() => {
                if (pendingDeleteId) handleDeleteReceipt(pendingDeleteId);
                setShowDeleteModal(false); setPendingDeleteId(null);
              }}
            >
              <Trash2 className="inline-block mr-1 h-5 w-5" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}