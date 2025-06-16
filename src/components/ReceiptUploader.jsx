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
      // Call startCamera directly here if modal is already open
      if (isCameraOpen) {
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

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  console.log('ReceiptUploader component - Current settings state:', settings);

  // Helper function to format date safely
  const formatDateSafely = (dateString) => {
    try {
      // Ensure settings and dateFormat are available before calling formatDate
      // Provide a fallback settings object if the component's settings state is not yet ready
      const currentSettings = settings || { dateFormat: 'YYYY-MM-DD', baseCurrency: 'EUR' }; // Minimal default for formatting
      if (!dateString || !currentSettings.dateFormat) return '';
      return formatDate(dateString, currentSettings);
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

  const handleSaveReceipt = async () => {
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

    // Basic validation for required fields
    if (!formData.merchant || !formData.total || !formData.date || formData.items.length === 0) {
      setFormErrors({
        merchant: !formData.merchant ? 'Merchant is required.' : '',
        date: !formData.date ? 'Date is required.' : '',
        total: !formData.total ? 'Total amount is required.' : '',
        items: formData.items.length === 0 ? 'At least one item is required.' : ''
      });
      toast({
        title: "Missing Information",
        description: "Please fill in Merchant, Total, Date, and at least one Item.",
        variant: "destructive",
      });
      setIsBusy(false);
      return;
    }

    // Ensure all items have a name and a valid price
    const cleanedItems = formData.items.filter(item => item.name && parseFloat(item.price) > 0).map(item => ({
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
    let calculatedTax = parseFloat(formData.tax) || 0;
    if (!formData.tax && formData.total && formData.subtotal) {
      calculatedTax = parseFloat(formData.total) - parseFloat(formData.subtotal);
      if (isNaN(calculatedTax) || calculatedTax < 0) calculatedTax = 0; // Ensure non-negative tax
    }

    const receiptData = {
      userId: user.uid,
      merchant: formData.merchant,
      date: serverTimestamp(), // Use server timestamp for consistency
      transactionDate: formData.date, // Keep original date string for display
      total: parseFloat(formData.total),
      subtotal: parseFloat(formData.subtotal),
      tax: calculatedTax,
      paymentMethod: formData.paymentMethod || 'Other',
      currency: formData.currency,
      items: cleanedItems,
      imageUrl: formData.imageUrl || '',
      category: formData.category || 'Uncategorized', // Ensure category is never undefined
      createdAt: serverTimestamp()
    };

    console.log("Receipt data being sent to Firestore:", receiptData);

    try {
      await addDoc(collection(db, "receipts"), receiptData);
      toast({
        title: "Receipt Saved! 🎉",
        description: "Your expense has been successfully recorded.",
      });
      setFormData({
        date: '',
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
      setFile(null); // Clear the selected file after saving
      setPreviewImageSrc(null); // Clear the preview image after saving
      setCurrentStep('upload_options');
      fetchReceipts();
    } catch (error) {
      console.error("Error saving receipt:", error);
      toast({
        title: "Error Saving Receipt 😥",
        description: `There was an issue saving your receipt: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
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

  const handleChange = (e, itemIndex = null, fieldName = null) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updatedData = { ...prev };
      if (name === "total" || name === "subtotal" || name === "tax") {
        // Allow empty string or numbers with up to 2 decimal places
      if (value === '' || /^-?[0-9]*\.?[0-9]{0,2}$/.test(value)) {
          updatedData[name] = value;
      }
      } else {
        updatedData[name] = value;
      }
      return updatedData;
    });
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Camera stream obtained:', stream);
      _videoElement.srcObject = stream;
      setIsCameraReady(true); // Set to true after stream is successfully assigned
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
      setIsCameraReady(false); // Reset if there's an error
    }
  };

  const stopCamera = () => {
    if (_videoElement && _videoElement.srcObject) {
      _videoElement.srcObject.getTracks().forEach(track => track.stop());
      _videoElement.srcObject = null;
      console.log('Camera stream stopped.');
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
    setEditForm({
      merchant: receipt.merchant || '',
      amount: parseFloat(receipt.amount).toFixed(2), // Ensure 2 decimal places
      date: receipt.date || '',
      category: receipt.category || '',
      subtotal: receipt.subtotal ? parseFloat(receipt.subtotal).toFixed(2) : '', // Ensure 2 decimal places
      payment_method: receipt.payment_method || '',
      currency: receipt.currency || 'EUR', // Set currency for edit form
      items: receipt.items?.map(item => ({ name: item.name || '', price: parseFloat(item.price).toFixed(2) })) || [{ name: '', price: '' }] // Ensure items are formatted
    });
    setCurrentReceipt(receipt); // Set current receipt for item management
    setIsEditing(true);
  };

  // Generic handler for edit form changes, supports nested item changes
  const handleEditChange = (e, itemIndex = null, fieldName = null) => {
    const { name, value } = e.target;

    setEditForm(prev => {
      let updatedForm = { ...prev };

      if (itemIndex !== null && fieldName) {
        // Handle item changes
        const updatedItems = [...(prev.items || [])];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          [fieldName]: (fieldName === 'price') ? (value === '' ? '' : parseFloat(value).toFixed(2)) : value
        };
        updatedForm.items = updatedItems;
      } else {
        // Handle top-level form changes
      if (name === "amount" || name === "subtotal") {
          // Allow empty string or numbers with up to 2 decimal places
        if (value === '' || /^-?[0-9]*\.?[0-9]{0,2}$/.test(value)) {
            updatedForm[name] = value;
          }
        } else {
          updatedForm[name] = value;
        }
      }
      return updatedForm;
    });

    // Also update currentReceipt to reflect changes live in the modal
    setCurrentReceipt(prev => {
      let updatedReceipt = { ...prev };
      if (itemIndex !== null && fieldName) {
        const updatedItems = [...(prev.items || [])];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          [fieldName]: (fieldName === 'price') ? (value === '' ? '' : parseFloat(value).toFixed(2)) : value
        };
        updatedReceipt.items = updatedItems;
      } else {
        updatedReceipt[name] = (name === "amount" || name === "subtotal") ? (value === '' ? '' : parseFloat(value)) : value;
      }
      return updatedReceipt;
    });
  };

  const handleEditSave = async (event) => {
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
    if (!editForm.merchant || !editForm.date || !editForm.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields: Merchant, Date, and Total Amount.",
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
      const parsedAmount = parseFloat(editForm.amount);
      const parsedSubtotal = parseFloat(editForm.subtotal);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
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
      let taxAmount = parseFloat(editForm.tax);
      if (isNaN(taxAmount) || editForm.tax === '') {
        taxAmount = (parsedAmount - (parsedSubtotal || parsedAmount)).toFixed(2); // If subtotal exists, tax is total - subtotal, else 0
      } else {
        taxAmount = taxAmount.toFixed(2);
      }

      const updatedReceiptData = {
        user_id: user.uid,
        merchant: editForm.merchant,
        amount: parsedAmount.toFixed(2), // Store as string with 2 decimal places
        subtotal: parsedSubtotal ? parsedSubtotal.toFixed(2) : undefined, // Store as string with 2 decimal places
        tax: parseFloat(taxAmount).toFixed(2), // Ensure tax is also 2 decimal places
        date: editForm.date,
        category: editForm.category,
        payment_method: editForm.payment_method,
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

      setEditingReceipt(null);
      setIsEditing(false);
      setCurrentStep('upload_options'); // Go back to dashboard view
      fetchReceipts(); // Refresh the list
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
    setEditForm({
      merchant: '',
      amount: '',
      date: '',
      category: '',
      subtotal: '',
      payment_method: '',
      items: []
    });
    setCurrentNewItem({ name: '', price: '' });
    setCurrentEditingItemIndex(null);
  };

  // Add Item to main form (manual entry)
  const handleAddItem = () => {
    // Only validate if we're explicitly adding an item (not from onBlur)
    if (!newItem.name.trim() && !newItem.price.trim()) {
      return; // If both are empty, just return silently
    }
    if (!newItem.name.trim() || !newItem.price.trim()) {
      toast({
        title: "Incomplete Item",
        description: "Please provide both item name and price.",
        variant: "destructive",
      });
      return;
    }

    // Parse price before validation
    const priceNum = parseFloat(newItem.price);
    if (isNaN(priceNum)) {
      toast({
        title: "Invalid Price",
        description: "Item price must be a valid number.",
        variant: "destructive",
      });
      return;
    }

    // Add new item with formatted price to formData.items
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), {
        name: newItem.name.trim(),
        price: priceNum.toFixed(2)
      }]
    }));
    setNewItem({ name: '', price: '' }); // Clear input fields
  };

  // Edit Item in main form (manual entry)
  const handleEditItem = (index) => {
    setNewItem(items[index]);
    setEditingItemIndex(index);
  };

  // Remove Item from main form (manual entry)
  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle changes for items in the main form (used for formData.items)
  const handleItemChange = (e, index, field = 'name') => {
    const { value } = e.target;
    setFormData(prev => {
      const updatedItems = [...(prev.items || [])];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: (field === 'price') ? (value === '' ? '' : parseFloat(value).toFixed(2)) : value
      };
      return { ...prev, items: updatedItems };
    });
  };

  // Add Item to edit form (for currentReceipt items)
  const handleEditItemAdd = () => {
    if (!currentNewItem.name.trim() || !currentNewItem.price.trim()) {
      toast({
        title: "Incomplete Item",
        description: "Please provide both item name and price for the new item.",
        variant: "destructive",
      });
      return;
    }
    const priceNum = parseFloat(currentNewItem.price);
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
    // Also update currentReceipt to ensure consistency
    setCurrentReceipt(prev => ({
      ...prev,
      items: [...(prev.items || []), { name: currentNewItem.name.trim(), price: priceNum.toFixed(2) }]
    }));
    setCurrentNewItem({ name: '', price: '' });
  };

  // Edit Item in edit form
  const handleEditItemEdit = (index) => {
    setCurrentNewItem(currentReceipt.items[index]);
    setCurrentEditingItemIndex(index);
  };

  // Save edited item in edit form
  const handleEditItemSave = () => {
    if (!currentNewItem.name.trim() || !currentNewItem.price.trim()) {
      toast({
        title: "Incomplete Item",
        description: "Please provide both item name and price for the edited item.",
        variant: "destructive",
      });
      return;
    }
    const priceNum = parseFloat(currentNewItem.price);
    if (isNaN(priceNum)) {
      toast({
        title: "Invalid Price",
        description: "Edited item price must be a valid number.",
        variant: "destructive",
      });
      return;
    }

    setEditForm(prev => {
      const updatedItems = [...(prev.items || [])];
      updatedItems[currentEditingItemIndex] = { name: currentNewItem.name.trim(), price: priceNum.toFixed(2) };
      return { ...prev, items: updatedItems };
    });
    setCurrentReceipt(prev => {
      const updatedItems = [...(prev.items || [])];
      updatedItems[currentEditingItemIndex] = { name: currentNewItem.name.trim(), price: priceNum.toFixed(2) };
      return { ...prev, items: updatedItems };
    });
    setCurrentNewItem({ name: '', price: '' });
    setCurrentEditingItemIndex(null);
  };

  // Cancel item editing in edit form
  const handleEditItemCancel = () => {
    setCurrentNewItem({ name: '', price: '' });
    setCurrentEditingItemIndex(null);
  };

  // Remove Item from edit form
  const handleRemoveItemEdit = (index) => {
    setEditForm(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index)
    }));
    setCurrentReceipt(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index)
    }));
  };

  // Helper for adding new item fields in the Manual Entry form dynamically
  const handleAddItemField = (insertIndex) => {
    setFormData(prevData => {
      const newItems = [...(prevData.items || [])];
      newItems.splice(insertIndex, 0, { name: '', price: '' });
      return { ...prevData, items: newItems };
    });
  };

  // Helper for removing item fields in the Manual Entry form dynamically
  const handleRemoveItemField = (removeIndex) => {
    setFormData(prevData => {
      if (prevData.items.length === 1 && !prevData.items[0].name && !prevData.items[0].price) {
        return prevData; // Prevent removing the last empty item if it's the only one
      }
      if (prevData.items.length > 1) {
        const newItems = prevData.items.filter((_, i) => i !== removeIndex);
        return { ...prevData, items: newItems };
      }
      return prevData; // Do nothing if trying to remove the last item
    });
  };

  // Helper for adding new item fields in the Edit Receipt form dynamically
  const handleEditItemAddField = (insertIndex) => {
    setEditForm(prevData => {
      const newItems = [...(prevData.items || [])];
      newItems.splice(insertIndex, 0, { name: '', price: '' });
      return { ...prevData, items: newItems };
    });
    setCurrentReceipt(prev => {
      const newItems = [...(prev.items || [])];
      newItems.splice(insertIndex, 0, { name: '', price: '' });
      return { ...prev, items: newItems };
    });
  };

  // Helper for removing item fields in the Edit Receipt form dynamically
  const handleRemoveItemEditField = (removeIndex) => {
    setEditForm(prevData => {
      if (prevData.items.length === 1 && !prevData.items[0].name && !prevData.items[0].price) {
        return prevData;
      }
      if (prevData.items.length > 1) {
        const newItems = prevData.items.filter((_, i) => i !== removeIndex);
        return { ...prevData, items: newItems };
      }
      return prevData;
    });
    setCurrentReceipt(prev => {
      if (prev.items.length === 1 && !prev.items[0].name && !prev.items[0].price) {
        return prev;
      }
      if (prev.items.length > 1) {
        const newItems = prev.items.filter((_, i) => i !== removeIndex);
        return { ...prev, items: newItems };
      }
      return prev;
    });
  };

  // Update the receipt card rendering
  const renderReceiptCard = (receipt) => (
    <Card key={receipt.id} className="bg-slate-700/80 p-5 rounded-xl shadow-lg text-white border border-gray-700 hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">{receipt.merchant}</CardTitle>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => handleEditClick(receipt)}
            variant="ghost"
            size="icon"
            className="text-blue-400 hover:bg-slate-600/50 hover:text-blue-300"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleDeleteReceipt(receipt.id)}
            variant="ghost"
            size="icon"
            className="text-red-400 hover:bg-slate-600/50 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Date</p>
            <p className="text-lg">{formatDateSafely(receipt.transactionDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Amount</p>
            <p className="text-lg font-semibold">
              {parseFloat(receipt.total).toFixed(2)} {receipt.currency}
              {receipt.currency !== (settings?.baseCurrency || 'EUR') && exchangeRates && (
                <span className="ml-2 text-sm text-gray-400">
                  ({convertToBaseCurrency(receipt.total, receipt.currency, settings?.baseCurrency || 'EUR', exchangeRates).toFixed(2)} {settings?.baseCurrency || 'EUR'})
                </span>
              )}
          </p>
        </div>
          <div>
            <p className="text-sm text-gray-400">Category</p>
            <p className="text-lg">{receipt.category || 'Uncategorized'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Payment Method</p>
            <p className="text-lg">{receipt.paymentMethod || 'Not specified'}</p>
          </div>
        </div>
        {receipt.items && receipt.items.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-2">Items</p>
            <ul className="space-y-1">
              {receipt.items.map((item, index) => (
                <li key={index} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span>
                    {parseFloat(item.price).toFixed(2)} {receipt.currency}
                    {receipt.currency !== (settings?.baseCurrency || 'EUR') && exchangeRates && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({convertToBaseCurrency(item.price, receipt.currency, settings?.baseCurrency || 'EUR', exchangeRates).toFixed(2)} {settings?.baseCurrency || 'EUR'})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const scrollStart = windowHeight * 0.2; // Match header animation start
      const scrollEnd = windowHeight * 0.5; // Match header animation end
      
      if (scrollPosition > scrollStart) {
        const progress = Math.min(1, (scrollPosition - scrollStart) / (scrollEnd - scrollStart));
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Use effect to manage camera modal open/close state
  useEffect(() => {
    console.log('useEffect for camera modal open/close triggered. isCameraOpen:', isCameraOpen);
    // The startCamera is now handled by the videoRef callback when the element mounts
    // stopCamera is called here when modal closes
    if (!isCameraOpen) {
      stopCamera();
    }
  }, [isCameraOpen]);

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
6. Items (list of items with their prices)

Consider these guidelines for categorization:
- Groceries: Supermarkets, food stores, grocery items
- Dining: Restaurants, cafes, fast food, takeout
- Transportation: Gas stations, public transport, taxis, car services
- Shopping: Retail stores, clothing, electronics, general merchandise
- Bills: Utilities, services, subscriptions
- Entertainment: Movies, events, leisure activities
- Health: Medical, pharmacy, wellness
- Other: Any items that don't fit the above categories

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
  "items": [
    {"name": "Item 1", "price": "10.00"},
    {"name": "Item 2", "price": "13.50"}
  ]
}
\`\`\``
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
      if (!jsonMatch) throw new Error("No JSON found in the response");

      const parsedJSON = JSON.parse(jsonMatch[1]);

      // Update form data with the extracted information
      setFormData(prev => ({
        ...prev,
        merchant: parsedJSON.store || '',
        total: parsedJSON.amount ? parsedJSON.amount.replace(/[^\d.,]/g, '').replace(',', '.') : '',
        date: parsedJSON.date ? normalizeDate(parsedJSON.date) : '',
        category: parsedJSON.category || '',
        paymentMethod: parsedJSON.payment_method || '',
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

  // Update the manual entry button click handler
  const handleManualEntry = () => {
    resetFormData();
    setCurrentStep('manual_entry');
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
                  {totalExpenses.toFixed(2)} {settings?.baseCurrency || 'EUR'}
                </p>
                <div className="space-y-2 w-full px-4">
                  {Object.entries(categoryTotals).length > 0 ? (
                    Object.entries(categoryTotals)
                      .sort(([, amountA], [, amountB]) => amountB - amountA) // Sort by amount descending
                      .map(([category, amount]) => (
                        <div key={category} className="flex justify-between items-center text-gray-300 text-sm">
                          <span>{category}</span>
                          <span>{amount.toFixed(2)} {settings?.baseCurrency || 'EUR'}</span>
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
        <Dialog open={currentStep === 'receipt_form' || currentStep === 'manual_entry'} onOpenChange={(open) => {
          if (!open) {
            setCurrentStep('upload_options'); // Close and return to main options
            setEditingReceipt(null); // Clear editing state if user closes modal
            setFormData({ date: '', merchant: '', total: '', tax: '', subtotal: '', paymentMethod: '', currency: 'EUR', items: [], category: '' });
            setNewItem({ name: '', price: '' });
            setFile(null); // Clear the selected file
            setPreviewImageSrc(null); // Clear the preview image
          }
        }}>
          <DialogContent className="sm:max-w-[800px] bg-slate-800 text-white border-gray-700 p-6 rounded-lg shadow-xl animate-fade-in">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold text-gray-100">{editingReceipt ? 'Edit Receipt' : 'New Receipt'}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {editingReceipt ? 'Make changes to your receipt here. Click save when you\'re done.' : 'Review and edit your receipt details. Click save to record your expense.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(100vh-180px)] pr-4">
              <form onSubmit={handleSaveReceipt}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="bg-slate-700/70 border-gray-700/50 text-white focus:border-blue-400"
                    />
                    {formErrors.date && <p className="text-red-400 text-sm">{formErrors.date}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="merchant">Merchant</Label>
                    <Input
                      id="merchant"
                      name="merchant"
                      value={formData.merchant}
                      onChange={handleChange}
                      className="bg-slate-700/70 border-gray-700/50 text-white focus:border-blue-400"
                    />
                    {formErrors.merchant && <p className="text-red-400 text-sm">{formErrors.merchant}</p>}
                  </div>
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="total">Total Amount</Label>
                    <div className="flex items-center">
                    <Input
                        id="total"
                      type="number"
                        step="0.01"
                      placeholder="0.00"
                        value={formData.total}
                        onChange={(e) => setFormData(prev => ({ ...prev, total: parseFloat(e.target.value).toFixed(2) }))}
                        className="w-full bg-slate-700/70 border-gray-700/50 text-white"
                    />
                      <span className="ml-2 text-gray-400 text-sm">{SUPPORTED_CURRENCIES.find(c => c.code === formData.currency)?.symbol || ''}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtotal">Subtotal (Optional)</Label>
                    <div className="flex items-center">
                    <Input
                        id="subtotal"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.subtotal}
                        onChange={(e) => setFormData(prev => ({ ...prev, subtotal: parseFloat(e.target.value).toFixed(2) }))}
                        className="w-full bg-slate-700/70 border-gray-700/50 text-white"
                      />
                      <span className="ml-2 text-gray-400 text-sm">{SUPPORTED_CURRENCIES.find(c => c.code === formData.currency)?.symbol || ''}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      className="w-full bg-slate-700/70 border-gray-700/50 text-white"
                    >
                      <SelectTrigger className="w-full bg-slate-700/70 border-gray-700/50 text-white">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 text-white border-gray-700">
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Input
                      id="paymentMethod"
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="bg-slate-700/70 border-gray-700/50 text-white focus:border-blue-400"
                    />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                      className="w-full bg-slate-700/70 border-gray-700/50 text-white"
                    >
                      <SelectTrigger className="w-full bg-slate-700/70 border-gray-700/50 text-white">
                        <SelectValue placeholder="Select a currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 text-white border-gray-700">
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Items Section */}
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200">Items</h3>
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                              <Input
                        id={`item-name-${index}`}
                                placeholder="Item Name"
                        value={item.name || ''}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="flex-grow bg-slate-700/70 border-gray-700/50 text-white focus:border-blue-400 focus:ring-blue-400"
                              />
                              <Input
                        id={`item-price-${index}`}
                        type="text"
                        placeholder="0.00"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        onBlur={(e) => {
                          const value = e.target.value;
                          const parsed = parseFloat(value.replace(',', '.')).toFixed(2);
                          handleItemChange(index, 'price', isNaN(parsed) ? '' : parsed);
                        }}
                        className="w-28 bg-slate-700/70 border-gray-700/50 text-white focus:border-blue-400 focus:ring-blue-400"
                      />
                      <span className="text-gray-400">{formData.currency}</span>
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => handleRemoveItemField(index)}
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-400"
                        >
                          <MinusCircle className="h-5 w-5" />
                        </Button>
                          )}
                        </div>
                  ))}

                  {/* Dynamic Empty Item Field / Add New Item Button */}
                  <div className="flex items-end gap-2">
                    <div className="flex-grow space-y-2">
                      <Label htmlFor="new-item-name">New Item Name</Label>
                        <Input
                        id="new-item-name"
                          type="text"
                        placeholder="Add new item name"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        className="w-full bg-slate-700/70 border-gray-700/50 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-item-price">Price</Label>
                      <div className="flex items-center">
                        <Input
                          id="new-item-price"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newItem.price}
                          onChange={(e) => setNewItem(prev => ({ ...prev, price: e.target.value }))}
                          className="w-28 bg-slate-700/70 border-gray-700/50 text-white"
                        />
                        <span className="text-gray-400 text-sm ml-2">{SUPPORTED_CURRENCIES.find(c => c.code === formData.currency)?.symbol || ''}</span>
                      </div>
                  </div>
                  <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAddItem()}
                      disabled={!newItem.name.trim() && !newItem.price.trim()}
                      className="text-blue-400 hover:bg-slate-600/50 hover:text-blue-300"
                  >
                      <PlusCircle className="h-5 w-5" />
                  </Button>
                </div>
          </div>

                <DialogFooter className="flex justify-end p-4 bg-slate-800/80 border-t border-gray-700/50 rounded-b-xl">
                <Button
                    type="button" 
                    variant="secondary" 
                    onClick={() => {
                      setCurrentStep('upload_options');
                      setEditingReceipt(null);
                    }} 
                    className="bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Cancel
                </Button>
                  <Button 
                    type="submit" 
                    disabled={isBusy}
                    onClick={(e) => {
                      e.preventDefault(); // Prevent default form submission that causes page reload
                      handleSaveReceipt();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                  >
                    {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isBusy ? 'Saving...' : 'Save Receipt'}
                  </Button>
                </DialogFooter>
              </form>
            </ScrollArea>
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
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
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
    </div>
  );
}