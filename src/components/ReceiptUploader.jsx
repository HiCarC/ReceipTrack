import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Trash2, DollarSign, Calendar, Store, Tag, CreditCard, List, X, Camera, CheckCircle, XCircle, PlusCircle, Save, Edit, Mail, LineChart, Lock } from 'lucide-react';
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
  SUPPORTED_CURRENCIES, 
  fetchExchangeRates, 
  convertCurrency, 
  formatCurrency, 
  getCurrencySymbol,
  initializeExchangeRates 
} from '@/utils/currencyUtils';
import { loadSettings, formatAmount, formatDate } from '@/utils/settingsUtils';
import { useAuth } from '@/contexts/AuthContext';
import { convertToBaseCurrency } from '@/utils/currencyUtils';

// Add currency conversion rates (you would typically fetch these from an API)
const CURRENCY_RATES = {
  EUR: 1,
  USD: 1.08, // Example rate
  GBP: 0.86, // Example rate
  // Add more currencies as needed
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
    items: []
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
    if (!user) return;
    setIsFirestoreLoading(true);
    setFirestoreError(null);
    try {
      const data = await getDocs(receiptsCollectionRef);
      const receiptsList = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      // Only show receipts for the current user
      const userReceipts = receiptsList.filter(r => r.user_id === user.uid);
      // Sort receipts by created_at timestamp in descending order (newest first)
      const sortedReceipts = userReceipts.sort((a, b) => {
        const dateA = a.created_at?.toDate?.() || new Date(0);
        const dateB = b.created_at?.toDate?.() || new Date(0);
        return dateB - dateA;
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
    const total = receipts.reduce((sum, receipt) => sum + (parseFloat(receipt.amount) || 0), 0);
    setTotalExpenses(total);

    // Calculate category totals
    const categorySums = receipts.reduce((acc, receipt) => {
      const cat = receipt.category || 'Uncategorized';
      const amount = parseFloat(receipt.amount) || 0;
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

  const [currency, setCurrency] = useState({ symbol: '€', code: 'EUR', format: '1.234,56' });
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

  // Function to convert amount to EUR
  const convertToEUR = (amount, fromCurrency) => {
    if (!amount || !fromCurrency || fromCurrency === 'EUR') return amount;
    const rate = CURRENCY_RATES[fromCurrency];
    return rate ? amount / rate : amount;
  };

  // Function to format currency
  const formatCurrency = (amount, currencyCode = 'EUR') => {
    if (amount === null || amount === undefined) return '';
    const formatter = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  };

  // Add state for OCR data
  const [ocrData, setOcrData] = useState(null);
  const [detectedCurrency, setDetectedCurrency] = useState(null);

  // Update handleSaveReceipt to check for user
  const handleSaveReceipt = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save receipts.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Save Receipt button clicked. Attempting to save...');
      setIsLoading(true);
      setIsBusy(true);

      // Get the original amount from OCR data or form
      const originalAmount = ocrData?.total || parseFloat(amount) || 0;
      const originalCurrency = detectedCurrency?.code || settings.baseCurrency;

      // Convert amount to base currency if needed
      const baseAmount = originalCurrency !== settings.baseCurrency
        ? await convertToBaseCurrency(originalAmount, originalCurrency)
        : originalAmount;

      // Ensure all required fields are present and valid
      const receiptData = {
        merchant: ocrData?.merchant || merchant || 'Unknown Merchant',
        amount: baseAmount,
        originalAmount: originalAmount,
        originalCurrency: originalCurrency,
        date: ocrData?.date || date || new Date().toISOString().split('T')[0],
        category: ocrData?.category || category || 'Uncategorized',
        payment_method: ocrData?.payment_method || paymentMethod || 'Unknown',
        items: (ocrData?.items || items).map(item => ({
          name: item.name || 'Unknown Item',
          price: parseFloat(item.price) || 0,
          originalPrice: parseFloat(item.originalPrice) || parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity) || 1
        })),
        created_at: new Date(),
        user_id: user.uid
      };

      // Add subtotal if available
      if (ocrData?.subtotal || subtotal) {
        const originalSubtotal = ocrData?.subtotal || parseFloat(subtotal);
        receiptData.subtotal = originalCurrency !== settings.baseCurrency
          ? await convertToBaseCurrency(originalSubtotal, originalCurrency)
          : originalSubtotal;
        receiptData.originalSubtotal = originalSubtotal;
      }

      // Add tax if available
      if (ocrData?.tax || tax) {
        const originalTax = ocrData?.tax || parseFloat(tax);
        receiptData.tax = originalCurrency !== settings.baseCurrency
          ? await convertToBaseCurrency(originalTax, originalCurrency)
          : originalTax;
        receiptData.originalTax = originalTax;
      }

      // Add tax rate if available
      if (ocrData?.taxRate || taxRate) {
        receiptData.taxRate = parseFloat(ocrData?.taxRate || taxRate);
      }

      // Add tax type if available
      if (ocrData?.taxType || taxType) {
        receiptData.taxType = ocrData?.taxType || taxType;
      }

      // Add tax number if available
      if (ocrData?.taxNumber || taxNumber) {
        receiptData.taxNumber = ocrData?.taxNumber || taxNumber;
      }

      // Add notes if available
      if (ocrData?.notes || notes) {
        receiptData.notes = ocrData?.notes || notes;
      }

      // Add location if available
      if (ocrData?.location || location) {
        receiptData.location = ocrData?.location || location;
      }

      // Add receipt number if available
      if (ocrData?.receiptNumber || receiptNumber) {
        receiptData.receiptNumber = ocrData?.receiptNumber || receiptNumber;
      }

      // Add payment details if available
      if (ocrData?.paymentDetails || paymentDetails) {
        receiptData.paymentDetails = ocrData?.paymentDetails || paymentDetails;
      }

      // Add tags if available
      if (ocrData?.tags || tags) {
        receiptData.tags = ocrData?.tags || tags;
      }

      // Add attachments if available
      if (attachments && attachments.length > 0) {
        receiptData.attachments = attachments;
      }

      // Add metadata
      receiptData.metadata = {
        created_at: new Date(),
        updated_at: new Date(),
        version: '1.0',
        source: ocrData ? 'ocr' : 'manual_entry'
      };

      console.log('Saving receipt with data:', receiptData);
      const docRef = await addDoc(collection(db, 'receipts'), receiptData);
      console.log('Receipt saved: ', receiptData);

      // Reset form and OCR data
      resetForm();
      setOcrData(null);
      setDetectedCurrency(null);
      setShowAddReceipt(false);

      toast({
        title: "Success",
        description: "Receipt saved successfully",
        variant: "default",
      });
    } catch (error) {
      console.error('Error adding document: ', error);
      toast({
        title: "Error",
        description: "Failed to save receipt: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsBusy(false);
    }
  };

  const handleDeleteReceipt = async (id) => {
    setIsLoading(true); // Start loading for Firestore operation
    try {
      await deleteDoc(doc(db, "receipts", id));
      console.log("Receipt deleted:", id);
      fetchReceipts(); // Refresh receipts after deleting
    } catch (e) {
      console.error("Error deleting document: ", e);
      setFirestoreError("Failed to delete receipt. Please try again.");
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "amount" || name === "subtotal") {
      setFormErrors(prev => ({ ...prev, [name]: '' })); // Clear error for this field
      // Allow empty string, negative numbers, or positive numbers with up to 2 decimal places
      if (value === '' || /^-?[0-9]*\.?[0-9]{0,2}$/.test(value)) {
        if (name === "amount") setAmount(value);
        if (name === "subtotal") setSubtotal(value);
      }
    } else if (name === "merchant") {
      setMerchant(value);
    } else if (name === "date") {
      setDate(value);
    } else if (name === "payment_method") {
      setPaymentMethod(value);
    }
  };

  const handleImageChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const objectURL = URL.createObjectURL(selectedFile);
      setPreviewImageSrc(objectURL);
      setFile(selectedFile); // Set the file state
      setCurrentStep('preview'); // Move to preview step after selecting file
      // Remove automatic OCR processing
    } else {
      console.log('No file selected or file selection cancelled.');
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setIsCameraReady(false);
    setCurrentStep('camera'); // Move to camera step
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play(); // Explicitly play the video
        videoRef.current.onloadedmetadata = () => {
          console.log(`Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
        };
        videoRef.current.onplaying = () => {
          setIsCameraReady(true);
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Camera access denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        alert('No camera found. Please ensure a camera is connected and enabled.');
      } else {
        alert(`Could not start camera: ${err.message}`);
      }
      setIsCameraOpen(false);
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
      // Set canvas dimensions to video dimensions
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
      const imageDataUrl = canvasRef.current.toDataURL('image/jpeg');
      setPreviewImageSrc(imageDataUrl);
      setCurrentStep('preview'); // Move to preview step after capturing photo
      stopCamera(); // Stop camera after capturing photo
    }
  };

  const handleUseImage = async () => {
    if (previewImageSrc) {
      setIsBusy(true); // Set loading state before processing
      setCurrentFunnyMessage(getRandomFunnyMessage()); // Set a random funny message
      setCurrentStep('processing_ocr'); // <--- New step: immediately switch to processing screen
      try {
        await processOCR(previewImageSrc);
      } catch (error) {
        console.error('Error processing image:', error);
        setMessage({
          type: 'error',
          text: 'Failed to process image. Please try again.'
        });
        setCurrentStep('preview'); // Go back to preview if error
      }
    } else {
      console.error('No preview image available');
      setMessage({
        type: 'error',
        text: 'No image available to process. Please try capturing or uploading again.'
      });
    }
  };

  const processOCR = async (imageData) => {
    setIsBusy(true); // Start loading state
    try {
      // Convert blob URL to base64
      let base64Image;
      if (imageData.startsWith('blob:')) {
        const response = await fetch(imageData);
        const blob = await response.blob();
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      } else {
        base64Image = imageData.split(',')[1];
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this receipt image and extract the following information with high precision:\n\n1. Basic Information:\n- Date (convert to YYYY-MM-DD format)\n- Merchant name\n- Total amount\n- Tax amount\n- Subtotal (if available)\n- Payment method (if available)\n\n2. Currency Analysis:\n- Detect the currency symbol and code (€, $, £, etc.)\n- Identify the currency format (e.g., 1,234.56 or 1.234,56)\n- Note any currency-specific patterns or conventions\n\n3. Category Classification:\nDetermine the most appropriate category from: Groceries, Dining, Transportation, Shopping, Bills, Entertainment, Health, Other\nBase this on:\n- Merchant name and type\n- Items purchased\n- Overall purchase context\n- Common patterns for similar merchants\n\n4. Items Analysis:\n- List all items with their prices\n- Group similar items\n- Note any special categories or departments\n\nFormat the response as a JSON object with these fields:\n{\n  \"date\": \"YYYY-MM-DD\",\n  \"merchant\": \"string\",\n  \"total\": number,\n  \"tax\": number,\n  \"subtotal\": number,\n  \"paymentMethod\": \"string\",\n  \"category\": \"string\",\n  \"currency\": {\n    \"symbol\": \"string\",\n    \"code\": \"string\",\n    \"format\": \"string\"\n  },\n  \"items\": [\n    {\n      \"name\": \"string\",\n      \"price\": number,\n      \"group\": \"string\"\n    }\n  ]\n}\n\nRules:\n1. If any field is not found, set it to null\n2. For monetary values, use numbers without currency symbols\n3. Ensure all numbers are properly formatted according to the detected currency format\n4. Group similar items under appropriate categories\n5. Use the most specific category possible based on the available information"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to process image');
      }

      const data = await response.json();
      console.log('Raw OCR response:', data);

      let jsonStr = data.choices[0].message.content;

      // Handle different response formats
      if (typeof jsonStr === 'string') {
        // Try to extract JSON from markdown code block
        const markdownMatch = jsonStr.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (markdownMatch) {
          jsonStr = markdownMatch[1];
        }

        // Clean up any remaining markdown or extra whitespace
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      }

      // Parse the cleaned JSON string
      const parsedData = JSON.parse(jsonStr);
      console.log('Parsed OCR data:', parsedData);

      // Set the detected currency
      if (parsedData.currency) {
        const detectedCurrency = SUPPORTED_CURRENCIES[parsedData.currency.code] || SUPPORTED_CURRENCIES.EUR;
        setCurrency(detectedCurrency);
      }

      // Convert amounts to EUR
      const totalInEUR = convertCurrency(parsedData.total, parsedData.currency?.code);
      const subtotalInEUR = convertCurrency(parsedData.subtotal, parsedData.currency?.code);
      
      // Convert item prices to EUR
      const itemsInEUR = parsedData.items ? parsedData.items.map(item => ({
        ...item,
        price: convertCurrency(item.price, parsedData.currency?.code)
      })) : [];

      // Update form fields with converted values
      setMerchant(parsedData.merchant || '');
      setAmount(totalInEUR ? totalInEUR.toString() : '');
      setDate(parsedData.date || '');
      setSubtotal(subtotalInEUR ? subtotalInEUR.toString() : '');
      setPaymentMethod(parsedData.paymentMethod || '');
      setCategory(parsedData.category || '');
      setItems(itemsInEUR);

      // Store original amounts for display
      setConvertedAmount(parsedData.total);
      setConvertedSubtotal(parsedData.subtotal);
      setConvertedItems(parsedData.items || []);

      // Log currency information for debugging
      if (parsedData.currency) {
        console.log('Detected Currency:', parsedData.currency);
      }

      // Show success message
      setMessage({ type: 'success', text: 'Receipt processed successfully!' });

      // Only move to form step after successful processing
      setCurrentStep('form');
    } catch (error) {
      console.error('OCR Error:', error);
      setMessage({
        type: 'error',
        text: `Error! Failed to parse OCR response: ${error.message}. Please try again or enter details manually.`
      });
      // Stay in preview step if there's an error
      setCurrentStep('preview');
      throw error; // Re-throw to be caught by handleUseImage
    } finally {
      setIsBusy(false); // End loading state
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the file input value
      }
    }
  };

  const handleConfirmPreview = () => {
    setCurrentStep('form'); // Confirm preview, move to form
  };

  const handleRetakePreview = () => {
    setPreviewImageSrc(null);
    setFile(null); // Clear file so new one can be selected/taken
    setCurrentStep('camera'); // Re-open the camera by setting step back to camera
  };

  const handleEditClick = (receipt) => {
    setEditingReceipt(receipt);
    setEditForm({
      merchant: receipt.merchant,
      amount: receipt.amount.toString(),
      date: receipt.date,
      category: receipt.category,
      subtotal: receipt.subtotal?.toString() || '',
      payment_method: receipt.payment_method || '',
      items: receipt.items || []
    });
    setCurrentReceipt(receipt); // Set the current receipt for editing
    setCurrentNewItem({ name: '', price: '' }); // Reset new item for edit form
    setCurrentEditingItemIndex(null); // Reset item editing index
    setIsEditing(true); // Activate edit form visibility
    setCurrentStep('edit'); // Navigate to the edit step
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const updatedForm = { ...prev, [name]: value };
      if (name === "amount" || name === "subtotal") {
        // Allow empty string, negative numbers, or positive numbers with up to 2 decimal places
        if (value === '' || /^-?[0-9]*\.?[0-9]{0,2}$/.test(value)) {
          return updatedForm;
        } else {
          return prev; // Prevent invalid input
        }
      }
      return updatedForm;
    });
    // Also update currentReceipt to reflect immediate changes in the UI
    setCurrentReceipt(prev => ({
      ...prev,
      [name]: (name === "amount" || name === "subtotal") ? parseFloat(value) || 0 : value
    }));
  };

  const handleEditSave = async (receiptId) => {
    setIsLoading(true); // Start loading
    try {
      const receiptRef = doc(db, "receipts", receiptId);
      const updatedReceipt = {
        ...editForm,
        amount: parseFloat(editForm.amount),
        subtotal: editForm.subtotal ? parseFloat(editForm.subtotal) : null,
        items: editForm.items.filter(item => item.name && item.price),
        updated_at: serverTimestamp() // Add update timestamp
      };
      await updateDoc(receiptRef, updatedReceipt);
      console.log("Receipt updated:", updatedReceipt);
      fetchReceipts(); // Refresh receipts after editing
      setIsEditing(false); // Close edit form
      setEditingReceipt(null);
      setEditForm({ merchant: '', amount: '', date: '', category: '', subtotal: '', payment_method: '', items: [] });
      setCurrentStep('dashboard'); // Navigate back to dashboard
    } catch (e) {
      console.error("Error updating document: ", e);
      setFirestoreError("Failed to update receipt. Please try again.");
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditingReceipt(null);
    setEditForm({ merchant: '', amount: '', date: '', category: '', subtotal: '', payment_method: '', items: [] });
    setCurrentReceipt(null);
    setCurrentNewItem({ name: '', price: '' });
    setCurrentEditingItemIndex(null);
    setCurrentStep('dashboard'); // Navigate back to dashboard
  };

  // Add Item to main form
  const handleAddItem = (index = null) => {
    if (!newItem.name.trim() || !newItem.price.trim()) {
      alert('Item name and price cannot be empty.');
      return;
    }
    const priceNum = parseFloat(newItem.price);
    if (isNaN(priceNum)) {
      alert('Item price must be a valid number.');
      return;
    }

    if (index !== null) { // Editing existing item
      const updatedItems = [...items];
      updatedItems[index] = { name: newItem.name.trim(), price: priceNum.toFixed(2) };
      setItems(updatedItems);
      setEditingItemIndex(null);
    } else { // Adding new item
      setItems(prev => [...prev, { name: newItem.name.trim(), price: priceNum.toFixed(2) }]);
    }
    setNewItem({ name: '', price: '' }); // Clear input fields
  };

  // Edit Item in main form
  const handleEditItem = (index) => {
    setNewItem(items[index]);
    setEditingItemIndex(index);
  };

  // Remove Item from main form
  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle changes for items in the main form (used for currentNewItem)
  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
  };

  // Add Item to edit form
  const handleEditItemAdd = () => {
    if (!currentNewItem.name.trim() || !currentNewItem.price.trim()) {
      alert('Item name and price cannot be empty.');
      return;
    }
    const priceNum = parseFloat(currentNewItem.price);
    if (isNaN(priceNum)) {
      alert('Item price must be a valid number.');
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

  // Edit Item in edit form
  const handleEditItemEdit = (index) => {
    setCurrentNewItem(currentReceipt.items[index]);
    setCurrentEditingItemIndex(index);
  };

  // Save edited item in edit form
  const handleEditItemSave = () => {
    if (!currentNewItem.name.trim() || !currentNewItem.price.trim()) {
      alert('Item name and price cannot be empty.');
      return;
    }
    const priceNum = parseFloat(currentNewItem.price);
    if (isNaN(priceNum)) {
      alert('Item price must be a valid number.');
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

  const fileInputRef = useRef(null); // Ref for the file input element

  const [settings, setSettings] = useState(loadSettings());

  // Update settings when they change
  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(loadSettings());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update the receipt display to show both original and converted amounts
  const renderReceiptAmount = (receipt) => {
    const originalAmount = receipt.originalAmount;
    const baseAmount = receipt.amount;
    const originalCurrency = receipt.originalCurrency || settings.baseCurrency;
    const { showOriginalAmounts, showConvertedAmounts } = settings;

  return (
      <div className="flex flex-col">
        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
          {formatAmount(originalAmount, originalCurrency, settings)}
        </span>
        {showConvertedAmounts && originalCurrency !== settings.baseCurrency && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {formatAmount(baseAmount, settings.baseCurrency, settings)}
          </span>
        )}
          </div>
    );
  };

  // Update the receipt items display
  const renderReceiptItems = (items, originalItems) => {
    const { showOriginalAmounts, showConvertedAmounts } = settings;
    
    return items.map((item, index) => (
      <li key={index} className="flex justify-between">
        <span>{item.name}</span>
        <div className="flex flex-col items-end">
          <span>{formatAmount(item.price, settings.baseCurrency, settings)}</span>
          {showOriginalAmounts && originalItems?.[index]?.price && 
           item.price !== originalItems[index].price && (
            <span className="text-xs text-gray-500">
              {formatAmount(originalItems[index].price, originalItems[index].currency || settings.baseCurrency, settings)}
                </span>
          )}
        </div>
      </li>
    ));
  };

  // Update the total expenses display
  const renderTotalExpenses = () => {
    if (totalExpenses === null) return null;

    const { showOriginalAmounts, showConvertedAmounts } = settings;
    const hasMultipleCurrencies = receipts.some(r => r.originalCurrency !== settings.baseCurrency);

    // Calculate totals by currency
    const currencyTotals = receipts.reduce((acc, receipt) => {
      if (receipt.originalCurrency) {
        acc[receipt.originalCurrency] = (acc[receipt.originalCurrency] || 0) + (receipt.originalAmount || 0);
      }
      return acc;
    }, {});

    return (
                <div className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        Total Expenses: 
        <span className="text-blue-600 ml-2">
          {formatAmount(totalExpenses, settings.baseCurrency, settings)}
        </span>
        {hasMultipleCurrencies && showOriginalAmounts && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {Object.entries(currencyTotals).map(([currency, amount]) => (
              <div key={currency}>
                {formatAmount(amount, currency, settings)}
              </div>
            ))}
                </div>
              )}
      </div>
    );
  };

  // Update the receipt card display
  const renderReceiptCard = (receipt) => (
    <Card key={receipt.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-grow space-y-1">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {receipt.merchant}
            </p>
            {renderReceiptAmount(receipt)}
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Date: {formatDate(receipt.date, settings)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Category: {receipt.category}
            </p>
            {receipt.subtotal && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Subtotal: {formatAmount(receipt.subtotal, settings.baseCurrency, settings)}
                {settings.showOriginalAmounts && receipt.originalSubtotal && 
                 receipt.originalSubtotal !== receipt.subtotal && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({formatAmount(receipt.originalSubtotal, receipt.originalCurrency, settings)})
                  </span>
                )}
              </p>
            )}
            {receipt.payment_method && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Payment Method: {receipt.payment_method}
              </p>
            )}
                      {receipt.items && receipt.items.length > 0 && (
                        <div className="mt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Items:
                </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300">
                  {renderReceiptItems(receipt.items, receipt.originalItems)}
                          </ul>
                        </div>
                      )}
                    </div>
          <div className="flex space-x-2">
            <Button
                        onClick={() => handleEditClick(receipt)}
              size="sm"
              variant="outline"
              className="border-gray-300 dark:border-gray-600"
                      >
                        Edit
            </Button>
            <Button
                        onClick={() => handleDeleteReceipt(receipt.id)}
              size="sm"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
            </Button>
                    </div>
              </div>
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
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-7xl mx-auto py-8 px-4">
        {/* Choose Upload Method Card */}
        <Card className="w-full md:w-1/3 p-6 flex flex-col items-center justify-start gap-6 bg-slate-800/80 text-white shadow-xl border-none">
          <CardHeader className="w-full text-center p-0 mb-4">
            <CardTitle className="text-2xl font-bold text-blue-100">Choose Upload Method</CardTitle>
          </CardHeader>
          <CardContent className="w-full flex flex-col items-center justify-center gap-4 p-0">
            {file && <p className="text-sm text-gray-400 mb-2">File: {file.name}</p>}
            <Button onClick={() => document.getElementById('fileInput').click()} className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2">
              <Upload className="h-5 w-5" /> Upload File
            </Button>
            <input
              id="fileInput"
              type="file"
              accept="image/*,.pdf"
              onChange={handleImageChange}
              className="hidden"
            />
            <Button onClick={startCamera} className="w-full bg-gray-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center gap-2">
              <Camera className="h-5 w-5" /> Take Photo
            </Button>
            <Button onClick={() => setCurrentStep('manual_entry')} className="w-full bg-gray-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center gap-2">
              <List className="h-5 w-5" /> Enter Manually
            </Button>
          </CardContent>
        </Card>

        {/* Your Receipts Card */}
        <Card className="w-full md:w-2/3 p-6 flex flex-col bg-slate-800/80 text-white shadow-xl border-none">
          <CardHeader className="w-full p-0 mb-4 flex flex-row justify-between items-center">
            <CardTitle className="text-2xl font-bold text-blue-100">Your Receipts</CardTitle>
            {isFirestoreLoading ? (
              <div className="text-gray-400 text-sm">Loading receipts...</div>
            ) : (
              <p className="text-lg font-semibold text-indigo-300">Total Expenses: {formatCurrency(totalExpenses, currency.code)}</p>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-y-auto space-y-4 max-h-[calc(100vh-180px)]">
            {firestoreError && <p className="text-red-500 text-center">{firestoreError}</p>}
            {receipts.length === 0 && !isFirestoreLoading && !firestoreError && (
              <p className="text-center text-gray-400">No receipts yet. Start by uploading or entering one!</p>
            )}
            {receipts.map(renderReceiptCard)}
          </CardContent>
        </Card>
      </div>

      {/* Remaining content for ReceiptUploader (Dashboard) */}
      {/* These sections were previously outside the !user conditional, and thus remain here */}

      {/* Testimonial Carousel */}
      <div className="w-full max-w-md mt-10">
        <div className="bg-slate-700/95 rounded-2xl shadow-lg p-6 flex flex-col gap-4 text-white">
          <div className="flex items-center gap-3">
            <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="User" className="h-10 w-10 rounded-full border-2 border-blue-200/40" />
            <div>
              <p className="text-slate-100 font-semibold">"ExpenseApp made my expense reports a breeze. Love the simplicity!"</p>
              <span className="text-xs text-slate-300">— Alex, Freelancer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="User" className="h-10 w-10 rounded-full border-2 border-blue-200/40" />
            <div>
              <p className="text-slate-100 font-semibold">"Our team saves hours every month. The best receipt tool we've tried."</p>
              <span className="text-xs text-slate-300">— Priya, Startup COO</span>
            </div>
          </div>
        </div>
      </div>
      {/* Client Logos */}
      <div className="flex flex-row items-center justify-center gap-8 mt-10 opacity-80 grayscale bg-slate-700/90 rounded-xl py-4 px-8 shadow">
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" className="h-8" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple-logo.png" alt="Apple" className="h-8" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg" alt="IBM" className="h-8" />
        <img src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" alt="Google" className="h-8" />
      </div>
      {/* Footer Branding */}
      <footer className="py-10 bg-slate-900/90 text-slate-400 text-center w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} ExpenseApp. All rights reserved.</p>
          <p className="mt-2">
            <a href="#" className="text-slate-400 hover:text-blue-400 mx-2">Privacy Policy</a>
            <a href="#" className="text-slate-400 hover:text-blue-400 mx-2">Terms of Service</a>
          </p>
        </div>
      </footer>
    </div>
  );
}