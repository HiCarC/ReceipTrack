import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Trash2, DollarSign, Calendar, Store, Tag, CreditCard, List, X, Camera } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { db } from '@/firebase'; // Import your Firebase db instance
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore"; // Import Firestore functions

export default function ReceiptUploader() {
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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
  const isBusyGlobal = isLoading || isFirestoreLoading || isBusy;

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
    setIsFirestoreLoading(true);
    setFirestoreError(null);
    try {
      const data = await getDocs(receiptsCollectionRef);
      const receiptsList = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      
      // Sort receipts by created_at timestamp in descending order (newest first)
      const sortedReceipts = receiptsList.sort((a, b) => {
        // Handle cases where created_at might be null or undefined
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

  const processOCR = async (imageData) => {
    try {
      setIsBusy(true);
      setCurrentFunnyMessage(getRandomFunnyMessage());
      
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
                  text: "Extract the following information from this receipt image: date, merchant name, total amount, tax amount, subtotal (if available), payment method (if available), and a list of items with their prices (if available). Format the response as a JSON object with these fields: date, merchant, total, tax, subtotal, paymentMethod, and items (as an array of objects with name and price). If any field is not found, set it to null. For the date, use YYYY-MM-DD format. For monetary values, use numbers without currency symbols."
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
      const content = data.choices[0].message.content;
      
      // Parse the JSON response, handling markdown formatting
      let jsonStr = content;
      if (content.includes('```json')) {
        // Extract JSON from markdown code block
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          jsonStr = match[1];
        }
      }
      
      const parsedData = JSON.parse(jsonStr);
      console.log('Parsed OCR data:', parsedData);
      
      // Update individual form fields
      setMerchant(parsedData.merchant || '');
      setAmount(parsedData.total ? parsedData.total.toString() : '');
      setDate(parsedData.date || '');
      setSubtotal(parsedData.subtotal ? parsedData.subtotal.toString() : '');
      setPaymentMethod(parsedData.paymentMethod || '');
      setItems(parsedData.items || []);

      // Show success message
      setMessage({ type: 'success', text: 'Receipt processed successfully!' });
    } catch (error) {
      console.error('OCR Error:', error);
      setMessage({ 
        type: 'error', 
        text: `Error! Failed to parse OCR response: ${error.message}. Please try again or enter details manually.`
      });
    } finally {
      setIsBusy(false);
    }
  };

  const normalizeDate = (input) => {
    // Regex to match common date formats (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY)
    const dateRegex = /(\d{4}[-/]\d{2}[-/]\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
    const match = input.match(dateRegex);

    if (!match) {
      console.warn(`Could not normalize date: ${input}`);
      return '';
    }

    let datePart = match[0];
    let parts;

    if (datePart.includes('-')) {
      parts = datePart.split('-');
    } else if (datePart.includes('/')) {
      parts = datePart.split('/');
    } else {
      return ''; // Should not happen with current regex, but as a fallback
    }

    let year, month, day;

    if (parts[0].length === 4) { // YYYY-MM-DD
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (parts[2].length === 4) { // MM/DD/YYYY or DD/MM/YYYY
      // Try to determine format based on common conventions or if month/day > 12
      // This is a simplistic approach and might need more robust logic for international dates
      if (parseInt(parts[0]) > 12 && parseInt(parts[1]) <= 12) { // Assume DD/MM/YYYY
        day = parts[0];
        month = parts[1];
      } else { // Assume MM/DD/YYYY (or DD/MM/YY where day is <=12)
        month = parts[0];
        day = parts[1];
      }
      year = parts[2];
    } else { // MM/DD/YY or DD/MM/YY (two-digit year)
      // For two-digit years, assume current century if year is within a reasonable range
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = century + parseInt(parts[2]);

      if (parseInt(parts[0]) > 12 && parseInt(parts[1]) <= 12) { // Assume DD/MM/YY
        day = parts[0];
        month = parts[1];
      } else { // Assume MM/DD/YY
        month = parts[0];
        day = parts[1];
      }
    }

    // Pad month and day with leading zeros if necessary
    month = String(parseInt(month)).padStart(2, '0');
    day = String(parseInt(day)).padStart(2, '0');

    // Return in YYYY-MM-DD format for input type="date"
    return `${year}-${month}-${day}`;
  };

  const handleSaveReceipt = async () => {
    setFormErrors({});
    let errors = {};

    if (!merchant.trim()) errors.merchant = "Merchant is required.";
    if (!amount || isNaN(parseFloat(amount))) errors.amount = "Amount is required and must be a number.";
    if (!date) errors.date = "Date is required.";
    if (!category) errors.category = "Category is required.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsLoading(true); // Start loading for Firestore operation
    try {
      const newReceipt = {
        merchant,
        amount: parseFloat(amount),
        date,
        category,
        subtotal: subtotal ? parseFloat(subtotal) : null,
        payment_method: paymentMethod || null,
        items: items.filter(item => item.name && item.price), // Filter out empty items
        created_at: serverTimestamp(), // Add timestamp
      };
      await addDoc(receiptsCollectionRef, newReceipt);
      console.log("Receipt saved:", newReceipt);
      // Clear form
      setFile(null);
      setAmount('');
      setMerchant('');
      setDate('');
      setCategory('');
      setSubtotal('');
      setPaymentMethod('');
      setItems([]);
      setFormErrors({});
      fetchReceipts(); // Refresh receipts list
    } catch (e) {
      console.error("Error adding document: ", e);
      setFirestoreError("Failed to save receipt. Please try again.");
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const handleDeleteReceipt = async (id) => {
    setIsLoading(true); // Start loading for Firestore operation
    try {
      await deleteDoc(doc(db, "receipts", id));
      console.log("Receipt deleted:", id);
      fetchReceipts(); // Refresh receipts list
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
      // Allow empty string or numbers with up to 2 decimal places
      if (value === '' || /^[0-9]*\.?[0-9]{0,2}$/.test(value)) {
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
      setPreviewImageSrc(URL.createObjectURL(selectedFile));
      setShowFullScreenPreview(true);
      processOCR(URL.createObjectURL(selectedFile)); // Changed from handleOCR to processOCR
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setShowFullScreenPreview(false); // Hide preview if camera is opened
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play(); // Explicitly play the video
        videoRef.current.onloadedmetadata = () => {
          console.log(`Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
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
      setShowFullScreenPreview(true);
      stopCamera(); // Stop camera after capturing photo
    }
  };

  const handleUseImage = () => {
    if (previewImageSrc) {
      console.log('Processing image:', previewImageSrc);
      processOCR(previewImageSrc);
      setShowFullScreenPreview(false);
    } else {
      console.error('No preview image available');
      setMessage({ 
        type: 'error', 
        text: 'No image available to process. Please try capturing or uploading again.'
      });
    }
  };

  const handleConfirmPreview = () => {
    setShowFullScreenPreview(false);
  };

  const handleRetakePreview = () => {
    setPreviewImageSrc(null);
    setShowFullScreenPreview(false);
    setFile(null); // Clear file so new one can be selected/taken
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
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const updatedForm = { ...prev, [name]: value };
      if (name === "amount" || name === "subtotal") {
        if (value === '' || /^[0-9]*\.?[0-9]{0,2}$/.test(value)) {
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
      setIsEditing(false); // Close edit form
      setEditingReceipt(null);
      setEditForm({ merchant: '', amount: '', date: '', category: '', subtotal: '', payment_method: '', items: [] });
      fetchReceipts(); // Refresh list
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
  };

  // Add Item to main form
  const handleAddItem = (index = null) => {
    if (!newItem.name.trim() || !newItem.price.trim()) {
      alert('Item name and price cannot be empty.');
      return;
    }
    const priceNum = parseFloat(newItem.price);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Item price must be a valid non-negative number.');
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
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Item price must be a valid non-negative number.');
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
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Item price must be a valid non-negative number.');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-700 flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      {/* Full-screen loading overlay with funny animation */}
      {isBusyGlobal && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm text-white space-y-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex text-6xl animate-bounce">🧾</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-center animate-pulse tracking-wide">{currentFunnyMessage}</p>
        </div>
      )}

      <main className={`w-full max-w-4xl ${isBusyGlobal ? 'pointer-events-none opacity-50' : ''}`}>
        <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white text-center mb-10 tracking-tight">
          Receipt Uploader
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-16">
          {/* Upload and Form Section */}
          <Card className="bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300 ease-in-out">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Upload Receipt</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-8 relative">
                {showFullScreenPreview && previewImageSrc && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
                    <div className="relative w-full h-full max-w-4xl max-h-[90vh] flex flex-col items-center justify-center">
                      <img
                        src={previewImageSrc}
                        alt="Receipt preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                      />
                      <div className="absolute bottom-4 flex gap-4">
                        <button
                          onClick={handleUseImage}
                          className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 ease-in-out text-lg font-semibold"
                          disabled={isBusyGlobal}
                        >
                          Use Image
                        </button>
                        <button
                          onClick={handleRetakePreview}
                          className="bg-gray-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-gray-700 active:bg-gray-800 transition-all duration-200 ease-in-out text-lg font-semibold"
                          disabled={isBusyGlobal}
                        >
                          Retake / Re-upload
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full md:w-full">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upload Receipt Image
                    </label>
                    <div className="mt-1 flex flex-col gap-4">
                      {/* Camera View */}
                      {isCameraOpen && (
                        <div className="relative rounded-lg overflow-hidden w-full h-[calc(100vh - 200px)] flex items-center justify-center bg-black">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover rounded-lg border-2 border-red-500"
                          />
                          <canvas ref={canvasRef} className="hidden" />
                          {/* Guidance Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="border-2 border-dashed border-white opacity-75 w-3/4 h-3/4 rounded-lg flex items-center justify-center">
                              <p className="text-white text-lg font-semibold text-center hidden sm:block">Align receipt within the frame</p>
                            </div>
                          </div>
                          {/* Loading/Status indicator */}
                          {!videoRef.current?.srcObject && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
                              <p className="text-white text-lg">Awaiting camera feed...</p>
                            </div>
                          )}

                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 p-2">
                            {/* Capture Button */}
                            <button
                              onClick={capturePhoto}
                              className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 ease-in-out flex items-center justify-center border-4 border-white"
                              style={{ width: '70px', height: '70px' }}
                              aria-label="Capture Photo"
                              disabled={isBusyGlobal}
                            >
                              <Camera className="h-8 w-8" />
                            </button>
                          </div>
                          {/* Close Camera Button */}
                          <button
                            onClick={stopCamera}
                            className="absolute top-4 right-4 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 active:bg-opacity-90 transition-all duration-200 ease-in-out shadow-lg"
                            aria-label="Close Camera"
                            disabled={isBusyGlobal}
                          >
                            <X className="h-6 w-6" />
                          </button>
                        </div>
                      )}

                      {/* Upload Area (Hidden when preview is open or camera is open) */}
                      {!isCameraOpen && !showFullScreenPreview && (
                        <div className="flex flex-col gap-4">
                          <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                            style={isBusyGlobal ? { pointerEvents: 'none', opacity: 0.5 } : {}} // Disable click and reduce opacity
                          >
                            <div className="space-y-4 text-center">
                              <div className="flex justify-center">
                                <Upload className="h-12 w-12 text-gray-400 dark:text-gray-400" />
                              </div>
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <label
                                  htmlFor="file-upload"
                                  className="relative cursor-pointer bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 active:bg-blue-800 focus-within:outline-none px-4 py-2 border border-transparent transition-all duration-200 ease-in-out"
                                  style={isBusyGlobal ? { pointerEvents: 'none', opacity: 0.5 } : {}} // Disable label as well
                                >
                                  <span>Upload File</span>
                                  <input
                                    id="file-upload"
                                    name="file-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="sr-only"
                                    disabled={isBusyGlobal}
                                  />
                                </label>
                                <button
                                  onClick={startCamera}
                                  className="flex items-center gap-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 transition-all duration-200 ease-in-out border border-gray-300 dark:border-gray-600"
                                  disabled={isBusyGlobal}
                                >
                                  <Camera className="h-5 w-5" />
                                  <span>Take Photo</span>
                                </button>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                PNG, JPG, GIF up to 10MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Form */}
          <Card className="bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300 ease-in-out">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Receipt Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="merchant" className="text-gray-700 dark:text-gray-300">Merchant</Label>
                  <Input
                    id="merchant"
                    name="merchant"
                    value={merchant}
                    onChange={handleChange}
                    placeholder="Enter merchant name"
                    className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                    disabled={isBusyGlobal}
                  />
                  {formErrors.merchant && <p className="text-red-500 text-sm dark:text-red-400">{formErrors.merchant}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-gray-700 dark:text-gray-300">Amount</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    value={amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                    disabled={isBusyGlobal}
                  />
                  {formErrors.amount && <p className="text-red-500 text-sm dark:text-red-400">{formErrors.amount}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-gray-700 dark:text-gray-300">Date</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    value={date}
                    onChange={handleChange}
                    className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                    disabled={isBusyGlobal}
                  />
                  {formErrors.date && <p className="text-red-500 text-sm dark:text-red-400">{formErrors.date}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-gray-700 dark:text-gray-300">Category</Label>
                  <Select
                    name="category"
                    value={category}
                    onValueChange={(value) => setCategory(value)}
                    disabled={isBusyGlobal}
                  >
                    <SelectTrigger className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:text-white">
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.category && <p className="text-red-500 text-sm dark:text-red-400">{formErrors.category}</p>}
                </div>
                {/* Subtotal (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="subtotal" className="text-gray-700 dark:text-gray-300">Subtotal (Optional)</Label>
                  <Input
                    id="subtotal"
                    name="subtotal"
                    type="number"
                    min="0"
                    value={subtotal}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                    disabled={isBusyGlobal}
                  />
                </div>
                {/* Payment Method (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="payment_method" className="text-gray-700 dark:text-gray-300">Payment Method (Optional)</Label>
                  <Input
                    id="payment_method"
                    name="payment_method"
                    value={paymentMethod}
                    onChange={handleChange}
                    placeholder="e.g., Credit Card, Cash"
                    className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                    disabled={isBusyGlobal}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <List className="h-5 w-5 text-gray-500 dark:text-gray-400" /> Items (Optional)
                </h3>
                <div className="space-y-3">
                  {items && items.length > 0 ? (
                    items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                        {editingItemIndex === index ? (
                          <>
                            <Input
                              type="text"
                              value={newItem.name}
                              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                              placeholder="Item Name"
                              className="flex-grow border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                              disabled={isBusyGlobal}
                            />
                            <Input
                              type="number"
                              value={newItem.price}
                              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                              placeholder="Price"
                              className="w-24 border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                              disabled={isBusyGlobal}
                            />
                            <Button onClick={() => handleAddItem(index)} size="sm" className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white" disabled={isBusyGlobal}>Save</Button>
                            <Button onClick={handleEditCancel} size="sm" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500" disabled={isBusyGlobal}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-grow text-gray-800 dark:text-gray-200">{item.name}</span>
                            <span className="text-gray-600 dark:text-gray-400">${parseFloat(item.price).toFixed(2)}</span>
                            <Button onClick={() => handleEditItem(index)} size="sm" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500" disabled={isBusyGlobal}>Edit</Button>
                            <Button onClick={() => handleRemoveItem(index)} size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white" disabled={isBusyGlobal}>Remove</Button>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    !isLoading && <p className="text-gray-500 dark:text-gray-400 text-center py-4">No items extracted yet. Add items manually or upload a receipt.</p>
                  )}

                  {editingItemIndex === null && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        placeholder="Add new item name"
                        className="flex-grow border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                        disabled={isBusyGlobal}
                      />
                      <Input
                        type="number"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                        placeholder="Price"
                        className="w-24 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                        disabled={isBusyGlobal}
                      />
                      <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white" disabled={isBusyGlobal}>Add Item</Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <Button
                  onClick={handleSaveReceipt}
                  className="bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors px-10 py-4 text-xl font-bold rounded-lg shadow-xl"
                  disabled={isBusyGlobal}
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-6 w-6" /> Save Receipt
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Edit Receipt Form (if active) */}
          {isEditing && currentReceipt && (
            <Card className="bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 mt-8 mb-8 hover:shadow-2xl transition-shadow duration-300 ease-in-out">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Edit Receipt</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-merchant" className="text-gray-700 dark:text-gray-300">Merchant</Label>
                    <Input
                      id="edit-merchant"
                      name="merchant"
                      value={editForm.merchant}
                      onChange={handleEditChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                      disabled={isBusyGlobal}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount" className="text-gray-700 dark:text-gray-300">Amount</Label>
                    <Input
                      id="edit-amount"
                      name="amount"
                      type="number"
                      value={editForm.amount}
                      onChange={handleEditChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                      disabled={isBusyGlobal}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-date" className="text-gray-700 dark:text-gray-300">Date</Label>
                    <Input
                      id="edit-date"
                      name="date"
                      type="date"
                      value={editForm.date}
                      onChange={handleEditChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                      disabled={isBusyGlobal}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-category" className="text-gray-700 dark:text-gray-300">Category</Label>
                    <Select
                      name="category"
                      value={editForm.category}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}
                      disabled={isBusyGlobal}
                    >
                      <SelectTrigger className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:text-white">
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Edit Subtotal (Optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-subtotal" className="text-gray-700 dark:text-gray-300">Subtotal (Optional)</Label>
                    <Input
                      id="edit-subtotal"
                      name="subtotal"
                      type="number"
                      min="0"
                      value={editForm.subtotal || ''}
                      onChange={handleEditChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                      disabled={isBusyGlobal}
                    />
                  </div>
                  {/* Edit Payment Method (Optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-payment_method" className="text-gray-700 dark:text-gray-300">Payment Method (Optional)</Label>
                    <Input
                      id="edit-payment_method"
                      name="payment_method"
                      value={editForm.payment_method || ''}
                      onChange={handleEditChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                      disabled={isBusyGlobal}
                    />
                  </div>
                </div>

                {/* Edit Items Section */}
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <List className="h-5 w-5 text-gray-500 dark:text-gray-400" /> Items (Optional)
                  </h3>
                  <div className="space-y-3">
                    {editForm.items && editForm.items.length > 0 ? (
                      editForm.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                          {currentEditingItemIndex === index ? (
                            <>
                              <Input
                                type="text"
                                value={currentNewItem.name}
                                onChange={(e) => setCurrentNewItem({ ...currentNewItem, name: e.target.value })}
                                placeholder="Item Name"
                                className="flex-grow border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                                disabled={isBusyGlobal}
                              />
                              <Input
                                type="number"
                                value={currentNewItem.price}
                                onChange={(e) => setCurrentNewItem({ ...currentNewItem, price: e.target.value })}
                                placeholder="Price"
                                className="w-24 border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                                disabled={isBusyGlobal}
                              />
                              <Button onClick={handleEditItemSave} size="sm" className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white" disabled={isBusyGlobal}>Save</Button>
                              <Button onClick={handleEditItemCancel} size="sm" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500" disabled={isBusyGlobal}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-grow text-gray-800 dark:text-gray-200">{item.name}</span>
                              <span className="text-gray-600 dark:text-gray-400">${parseFloat(item.price).toFixed(2)}</span>
                              <Button onClick={() => handleEditItemEdit(index)} size="sm" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500" disabled={isBusyGlobal}>Edit</Button>
                              <Button onClick={() => handleRemoveItemEdit(index)} size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white" disabled={isBusyGlobal}>Remove</Button>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">No items extracted yet.</p>
                    )}

                    {currentEditingItemIndex === null && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={currentNewItem.name}
                          onChange={(e) => setCurrentNewItem({ ...currentNewItem, name: e.target.value })}
                          placeholder="Add new item name"
                          className="flex-grow border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                          disabled={isBusyGlobal}
                        />
                        <Input
                          type="number"
                          value={currentNewItem.price}
                          onChange={(e) => setCurrentNewItem({ ...currentNewItem, price: e.target.value })}
                          placeholder="Price"
                          className="w-24 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out"
                          disabled={isBusyGlobal}
                        />
                        <Button onClick={handleEditItemAdd} className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white" disabled={isBusyGlobal}>Add Item</Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <Button
                    onClick={() => handleEditSave(currentReceipt.id)}
                    className="bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors"
                    disabled={isBusyGlobal}
                  >
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" /> Save Changes
                    </span>
                  </Button>
                  <Button
                    onClick={handleEditCancel}
                    className="bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800 transition-colors"
                    disabled={isBusyGlobal}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Screen Image Preview Modal - Kept for mobile photo-taking preview, but also applies to any uploaded image preview. */}
          {showFullScreenPreview && previewImageSrc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
              <div className="relative w-full h-full max-w-4xl max-h-[90vh] flex flex-col items-center justify-center">
                <img
                  src={previewImageSrc}
                  alt="Receipt preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                />
                <div className="absolute bottom-4 flex gap-4">
                  <button
                    onClick={handleUseImage}
                    className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 ease-in-out text-lg font-semibold"
                    disabled={isBusyGlobal}
                  >
                    Use Image
                  </button>
                  <button
                    onClick={handleRetakePreview}
                    className="bg-gray-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-gray-700 active:bg-gray-800 transition-all duration-200 ease-in-out text-lg font-semibold"
                    disabled={isBusyGlobal}
                  >
                    Retake / Re-upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message Display */}
          {(ocrError || firestoreError) && (
            <div className="bg-red-100 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded relative mt-4" role="alert">
              <strong className="font-bold">Error!</strong>
              <span className="block sm:inline"> {ocrError || firestoreError}</span>
            </div>
          )}

          {/* Receipts List */}
          <Card className="bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 mt-8 hover:shadow-2xl transition-shadow duration-300 ease-in-out">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Your Receipts</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {totalExpenses !== null && (
                <div className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Total Expenses: <span className="text-blue-600"> ${totalExpenses.toFixed(2)}</span>
                </div>
              )}
              {receipts.length === 0 && !isFirestoreLoading && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No receipts found. Upload one to get started!</p>
              )}
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <Card key={receipt.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md transition-shadow duration-200 ease-in-out hover:scale-[1.01] active:scale-[0.99] transform origin-center duration-150 ease-out">
                    <div className="flex-grow space-y-1 mb-2 sm:mb-0">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{receipt.merchant}</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">${receipt.amount.toFixed(2)}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Date: {receipt.date}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Category: {receipt.category}</p>
                      {receipt.subtotal && <p className="text-sm text-gray-600 dark:text-gray-300">Subtotal: ${parseFloat(receipt.subtotal).toFixed(2)}</p>}
                      {receipt.payment_method && <p className="text-sm text-gray-600 dark:text-gray-300">Payment Method: {receipt.payment_method}</p>}
                      {receipt.items && receipt.items.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Items:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300">
                            {receipt.items.map((item, itemIndex) => (
                              <li key={itemIndex}>{item.name}: ${parseFloat(item.price).toFixed(2)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Saved on: {receipt.created_at?.toDate().toLocaleString() || 'N/A'}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
                      <button
                        onClick={() => handleEditClick(receipt)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
                        disabled={isBusyGlobal}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteReceipt(receipt.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors"
                        disabled={isBusyGlobal}
                      >
                        Delete
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}