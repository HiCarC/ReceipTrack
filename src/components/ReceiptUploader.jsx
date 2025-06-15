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
  const videoRef = useRef(null);
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
    date: '',
    merchant: '',
    total: '',
    tax: '',
    subtotal: '',
    paymentMethod: '',
    currency: 'EUR', // Default currency for new receipts
    items: [],
    category: '' // Initialize category to an empty string
  });

  // State for UI
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentFunnyMessage, setCurrentFunnyMessage] = useState('');

  // Combine isLoading and isFirestoreLoading for a global busy state
  const isBusyGlobal = isLoading || isFirestoreLoading;

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
    "Hold tight, magic is happening!"
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
      setIsLoading(true);
      setCurrentFunnyMessage(getRandomFunnyMessage());
      processOCR(selectedFile);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
          setIsCameraReady(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please grant camera access to use this feature.",
        variant: "destructive",
      });
      setIsCameraReady(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsCameraReady(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      setPreviewImageSrc(canvasRef.current.toDataURL('image/jpeg'));
      setShowFullScreenPreview(true);
    }
  };

  const handleUseImage = async () => {
    if (previewImageSrc) {
      setIsLoading(true);
      setCurrentFunnyMessage(getRandomFunnyMessage());
      setShowFullScreenPreview(false);
      stopCamera(); // Stop camera after capturing
      const blob = await fetch(previewImageSrc).then(res => res.blob());
      processOCR(blob);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
          const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const processOCR = async (file) => {
    try {
      setIsOcrProcessing(true);
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
                  text: "You are a receipt OCR expert. Extract the following information from this receipt image: store name, total amount, date, and any line items with their prices. Format the response as a JSON object with these fields: store, amount, date, items (array of {name, price}). Only reply with the JSON object enclosed in triple backticks." 
                },
                {
                  type: "image_url",
                  image_url: {
                    url: base64,
                    detail: "high"
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OCR API Error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to process receipt via OCR API.');
      }

      const result = await response.json();
      console.log('OCR Raw Result:', result);

      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/```json\s*({[\s\S]*?})\s*```/);
      
      if (!jsonMatch) {
        throw new Error('No valid JSON found in OCR response');
      }

      const parsedData = JSON.parse(jsonMatch[1]);
      console.log('Parsed OCR Data:', parsedData);

      // Sanitize and parse data from OCR result
      const merchantName = parsedData.store || '';
      const totalAmount = parseFloat(parsedData.amount || '0').toFixed(2);
      const subtotalAmount = parseFloat(parsedData.subtotal || totalAmount).toFixed(2);
      const transactionDate = parsedData.date ? new Date(parsedData.date).toISOString().split('T')[0] : '';
      const detectedCurrency = parsedData.currency || 'EUR'; // Default to EUR if not detected

      // Debugging: Log parsed values
      console.log('Parsed Merchant:', merchantName);
      console.log('Parsed Total Amount:', totalAmount);
      console.log('Parsed Subtotal Amount:', subtotalAmount);
      console.log('Parsed Date:', transactionDate);
      console.log('Parsed Currency:', detectedCurrency);

      const itemsFromOcr = (parsedData.items || []).map(item => ({
        name: item.name || '',
        price: parseFloat(item.price || '0').toFixed(2)
      }));

      // Debugging: Log parsed items
      console.log('Parsed Items:', itemsFromOcr);

      setFormData({
        date: transactionDate,
        merchant: merchantName,
        total: totalAmount,
        tax: '', // Let tax be calculated on save if not present in OCR
        subtotal: subtotalAmount,
        paymentMethod: '', // OCR usually doesn't provide this clearly
        currency: detectedCurrency, // Set currency from OCR
        items: itemsFromOcr.length > 0 ? itemsFromOcr : [{ name: '', price: '' }], // Ensure at least one empty item for manual entry
        category: '' // Initialize category to an empty string
      });
      setCurrentStep('receipt_form'); // Go to receipt form to review/edit
    } catch (error) {
      console.error("Error processing OCR:", error);
      setOcrError(`Failed to process receipt: ${error.message}. Please try manual entry.`);
      toast({
        title: "OCR Failed 😥",
        description: `Error: ${error.message}. Please try manual entry.`,
        variant: "destructive",
      });
    } finally {
      setIsOcrProcessing(false);
      setIsLoading(false);
    }
  };

  const handleConfirmPreview = () => {
    handleUseImage();
  };

  const handleRetakePreview = () => {
    setShowFullScreenPreview(false);
    setPreviewImageSrc(null);
    startCamera(); // Restart camera for a new photo
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

  return (
    <div className={`relative flex flex-col items-center w-full ${className}`}>
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
                  startCamera();
                }}
                className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </Button>
              <Button
                onClick={() => {
                  setCurrentStep('manual_entry');
                }}
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
            {isCameraReady ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            ) : (
              <p className="text-gray-400">Camera not ready or access denied.</p>
            )}
            <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
          <div className="mt-4 flex space-x-4">
            <Button onClick={capturePhoto} disabled={!isCameraReady} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              <Camera className="h-5 w-5 mr-2" /> Capture Photo
            </Button>
            <Button onClick={stopCamera} variant="outline" className="text-gray-200 border-gray-600 hover:bg-gray-700 hover:text-white font-bold py-2 px-4 rounded">
              <X className="h-5 w-5 mr-2" /> Close Camera
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