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

  const handleOCR = async (file) => {
    if (!file) return;

    setIsOcrProcessing(true);
    setOcrError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        try {
          const base64Image = reader.result.split(",")[1];
          if (!base64Image) {
            throw new Error('Invalid base64 data format');
          }

          console.log('Sending request to OpenAI API...');
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
                      text: "Extract the merchant name, total amount, date, subtotal, payment method, and a list of individual items with their names and prices from this receipt image. Format your response as a JSON object with these exact keys: 'merchant', 'amount', 'date', 'subtotal', 'payment_method', and 'items'. The 'items' key should be an array of objects, each with 'name' (string) and 'price' (string). Also, suggest a suitable category for the overall expense from this list: Groceries, Dining, Transportation, Shopping, Bills, Entertainment, Health, Other. Add the category under the key 'category'. Example response format:\n```json\n{\"merchant\": \"Lidl\", \"amount\": \"23.50\", \"date\": \"13/06/2025\", \"subtotal\": \"20.00\", \"payment_method\": \"Credit Card\", \"category\": \"Groceries\", \"items\": [{\"name\":\"Milk\",\"price\":\"3.00\"}, {\"name\":\"Bread\",\"price\":\"2.50\"}]}\n```" 
                    },
                    { 
                      type: "image_url", 
                      image_url: { 
                        url: `data:image/jpeg;base64,${base64Image}`,
                        detail: "high"
                      } 
                    }
                  ]
                }
              ],
              max_tokens: 1500
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error Response:', errorData);
            if (errorData.error) {
              throw new Error(`API Error: ${errorData.error.message || errorData.error.code || 'Unknown error'}`);
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          console.log("Full API Response:", data);

          if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid API response structure:', data);
            throw new Error('Invalid API response structure');
          }

          const replyText = data.choices[0].message.content;
          console.log("Raw API Response Text:", replyText);

          let jsonMatch = replyText.match(/```json\s*({[\s\S]*?})\s*```/i);
          if (!jsonMatch) {
            try {
              const parsedResponse = JSON.parse(replyText);
              if (parsedResponse && typeof parsedResponse === 'object') {
                jsonMatch = [null, JSON.stringify(parsedResponse)];
              }
            } catch (e) {
              console.error("Failed to parse response as JSON:", e);
            }
          }

          if (!jsonMatch) {
            console.error("No valid JSON found in response:", replyText);
            throw new Error("No valid JSON found in the response");
          }

          const jsonStr = jsonMatch[1].replace(/```json\n|\n```/g, '').trim();
          const parsedJSON = JSON.parse(jsonStr);
          console.log("Parsed JSON:", parsedJSON);

          if (!parsedJSON.merchant || !parsedJSON.amount || !parsedJSON.date || !parsedJSON.subtotal || !parsedJSON.payment_method || !parsedJSON.items) {
            console.error("Missing required fields in JSON:", parsedJSON);
            throw new Error("Missing required fields in the response. Check merchant, amount, date, subtotal, payment_method, or items.");
          }

          // Set all form values
          setMerchant(parsedJSON.merchant);
          
          // Handle amount - ensure it's a valid number
          const cleanAmount = parseFloat(parsedJSON.amount.replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(cleanAmount)) {
            setAmount(cleanAmount.toString());
          }
          
          // Handle date
          const rawDate = parsedJSON.date.trim();
          const normalizedDate = normalizeDate(rawDate);
          if (normalizedDate) {
            setDate(normalizedDate);
          }
          
          // Handle category
          if (parsedJSON.category) {
            const matchedCategory = categories.find(cat => cat.toLowerCase() === parsedJSON.category.toLowerCase());
            setCategory(matchedCategory || 'Other');
          } else {
            setCategory('Other');
          }
          
          // Handle subtotal - ensure it's a valid number
          const cleanSubtotal = parseFloat(parsedJSON.subtotal.replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(cleanSubtotal)) {
            setSubtotal(cleanSubtotal.toString());
          }
          
          // Handle payment method
          setPaymentMethod(parsedJSON.payment_method);
          
          // Handle items
          if (Array.isArray(parsedJSON.items)) {
            setItems(parsedJSON.items.map(item => ({
              name: item.name,
              price: parseFloat(item.price.replace(/[^0-9.,]/g, '').replace(',', '.')).toString()
            })));
          }
        } catch (error) {
          console.error("Error processing OCR:", error);
          setOcrError(error.message || "Failed to process receipt image");
        } finally {
          setIsOcrProcessing(false);
        }
      };

      reader.onerror = () => {
        setOcrError("Failed to read the image file");
        setIsOcrProcessing(false);
      };
    } catch (error) {
      console.error("Error in handleOCR:", error);
      setOcrError(error.message || "Failed to process receipt image");
      setIsOcrProcessing(false);
    }
  };

  const normalizeDate = (input) => {
    // Try different date formats
    const formats = [
      /(\d{2})[\\/\\-](\d{2})[\\/\\-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[\\/\\-](\d{2})[\\/\\-](\d{2})/, // YYYY/MM/DD or YYYY-MM/DD
      /(\d{2})[\\/\\-](\d{2})[\\/\\-](\d{2})/  // MM/DD/YY or MM-DD-YY
    ];

    for (const format of formats) {
      const parts = input.match(format);
      if (parts) {
        if (format === formats[0]) {
          // DD/MM/YYYY format
          const [_, day, month, year] = parts;
          return `${year}-${month}-${day}`;
        } else if (format === formats[1]) {
          // YYYY/MM/DD format
          const [_, year, month, day] = parts;
          return `${year}-${month}-${day}`;
        } else {
          // MM/DD/YY format
          const [_, month, day, year] = parts;
          const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
          return `${fullYear}-${month}-${day}`;
        }
      }
    }

    // If no format matches, try to parse the date directly
    try {
      const date = new Date(input);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.error("Error parsing date:", e);
    }
    return null;
  };

  const receiptData = {
    merchant: merchant,
    amount: amount,
    date: date,
    category: category,
    subtotal: subtotal,
    payment_method: paymentMethod,
    items: items,
  }; 

  const handleSaveReceipt = async () => {
    // Validate form
    const errors = {};
    if (!merchant) errors.merchant = 'Merchant is required';
    if (!amount) errors.amount = 'Amount is required';
    if (!category) errors.category = 'Category is required';
    if (!date) errors.date = 'Date is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsFirestoreLoading(true);
    setFirestoreError(null);

    try {
      const receiptData = {
        merchant,
        amount: parseFloat(amount),
        date,
        category,
        subtotal: subtotal ? parseFloat(subtotal) : null,
        payment_method: paymentMethod || null,
        items: items.length > 0 ? items.map(item => ({
          name: item.name,
          price: parseFloat(item.price).toString()
        })) : null,
        created_at: serverTimestamp()
      };

      await addDoc(receiptsCollectionRef, receiptData);
      
      // Clear form and image after successful save
      setFile(null);
      setAmount('');
      setMerchant('');
      setDate('');
      setCategory('');
      setSubtotal('');
      setPaymentMethod('');
      setItems([]);
      setNewItem({ name: '', price: '' });
      setEditingItemIndex(null);
      setFormErrors({});
      
      // Refresh receipts list
      await fetchReceipts();
    } catch (error) {
      console.error("Error saving receipt:", error);
      setFirestoreError("Failed to save receipt. Please try again.");
    } finally {
      setIsFirestoreLoading(false);
    }
  };

  const handleDeleteReceipt = async (id) => {
    setIsFirestoreLoading(true);
    setFirestoreError(null);
    try {
      const receiptDoc = doc(db, "receipts", id);
      await deleteDoc(receiptDoc);
      fetchReceipts();
    } catch (error) {
      console.error("Error deleting document:", error);
      setFirestoreError("Failed to delete receipt. Please try again.");
    } finally {
      setIsFirestoreLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    switch (name) {
      case 'merchant':
        setMerchant(value);
        break;
      case 'amount':
        setAmount(value);
        break;
      case 'date':
        setDate(value);
        break;
      case 'category':
        setCategory(value);
        break;
      case 'subtotal':
        setSubtotal(value);
        break;
      case 'payment_method':
        setPaymentMethod(value);
        break;
      default:
        break;
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile(file);
      };
      reader.readAsDataURL(file);
    } else {
      setFile(null);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setOcrError("Could not access camera. Please try uploading an image instead.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame on the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "receipt.jpg", { type: "image/jpeg" });
          handleImageChange({ target: { files: [file] } });
          stopCamera();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleEditClick = (receipt) => {
    setEditingReceipt(receipt.id);
    setEditForm({
      merchant: receipt.merchant,
      amount: receipt.amount.toString(),
      date: receipt.date,
      category: receipt.category,
      subtotal: receipt.subtotal ? receipt.subtotal.toString() : '',
      payment_method: receipt.payment_method || '',
      items: receipt.items || []
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditSave = async (receiptId) => {
    try {
      const receiptRef = doc(db, "receipts", receiptId);
      const updatedData = {
        ...editForm,
        amount: parseFloat(editForm.amount),
        subtotal: editForm.subtotal ? parseFloat(editForm.subtotal) : null,
        updated_at: serverTimestamp()
      };
      
      await updateDoc(receiptRef, updatedData);
      setEditingReceipt(null);
      await fetchReceipts();
    } catch (error) {
      console.error("Error updating receipt:", error);
      setFirestoreError("Failed to update receipt. Please try again.");
    }
  };

  const handleEditCancel = () => {
    setEditingReceipt(null);
    setEditForm({
      merchant: '',
      amount: '',
      date: '',
      category: '',
      subtotal: '',
      payment_method: '',
      items: []
    });
  };

  const handleAddItem = () => {
    if (newItem.name && newItem.price) {
      if (editingItemIndex !== null) {
        // Update existing item
        const updatedItems = [...items];
        updatedItems[editingItemIndex] = {
          name: newItem.name,
          price: parseFloat(newItem.price).toString()
        };
        setItems(updatedItems);
        setEditingItemIndex(null);
      } else {
        // Add new item
        setItems([...items, {
          name: newItem.name,
          price: parseFloat(newItem.price).toString()
        }]);
      }
      setNewItem({ name: '', price: '' });
    }
  };

  const handleEditItem = (index) => {
    setNewItem({
      name: items[index].name,
      price: items[index].price
    });
    setEditingItemIndex(index);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Receipt Uploader</h1>

          {/* Upload Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload Receipt Image
                </label>
                <div className="mt-1 flex flex-col gap-4">
                  {/* Camera View */}
                  {isCameraOpen && (
                    <div className="relative rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-auto rounded-lg"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <button
                          onClick={capturePhoto}
                          className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full border-4 border-blue-500"></div>
                        </button>
                        <button
                          onClick={stopCamera}
                          className="bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload Area */}
                  {!isCameraOpen && (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                        <div className="space-y-4 text-center">
                          <div className="flex justify-center">
                            <Upload className="h-12 w-12 text-gray-400" />
                          </div>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none px-4 py-2 border border-blue-500"
                            >
                              <span>Upload File</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="sr-only"
                              />
                            </label>
                            <button
                              onClick={startCamera}
                              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
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
              {file && (
                <div className="w-full sm:w-1/2">
                  <div className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Receipt preview"
                      className="w-full h-auto rounded-lg shadow-md"
                    />
                    <button
                      onClick={() => {
                        setFile(null);
                        stopCamera();
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="merchant" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Merchant</label>
                <input
                  type="text"
                  id="merchant"
                  name="merchant"
                  value={merchant || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., Starbucks"
                  required
                />
                {formErrors.merchant && <p className="text-red-500 text-xs mt-1">{formErrors.merchant}</p>}
              </div>

              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={amount || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., 25.50"
                  required
                  step="0.01"
                  min="0"
                />
                {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <select
                  id="category"
                  name="category"
                  value={category || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {formErrors.category && <p className="text-red-500 text-xs mt-1">{formErrors.category}</p>}
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={date || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
                {formErrors.date && <p className="text-red-500 text-xs mt-1">{formErrors.date}</p>}
              </div>

              <div>
                <label htmlFor="subtotal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subtotal (Optional)</label>
                <input
                  type="number"
                  id="subtotal"
                  name="subtotal"
                  value={subtotal || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., 20.00"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method (Optional)</label>
                <input
                  type="text"
                  id="payment_method"
                  name="payment_method"
                  value={paymentMethod || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., Credit Card"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4">Items (Optional)</h3>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    name="name"
                    value={newItem.name}
                    onChange={handleItemChange}
                    placeholder="Item name"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    name="price"
                    value={newItem.price}
                    onChange={handleItemChange}
                    placeholder="Price"
                    step="0.01"
                    min="0"
                    className="w-full sm:w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddItem}
                      className="flex-1 sm:flex-none bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      {editingItemIndex !== null ? 'Update' : 'Add'} Item
                    </button>
                    {editingItemIndex !== null && (
                      <button
                        onClick={() => {
                          setEditingItemIndex(null);
                          setNewItem({ name: '', price: '' });
                        }}
                        className="flex-1 sm:flex-none bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No items added yet.</p>
                ) : (
                  <ul className="border border-gray-300 dark:border-gray-600 rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-white dark:bg-gray-700">
                    {items.map((item, index) => (
                      <li key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-gray-800 dark:text-gray-200">
                        <div className="flex-1">
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-2">${parseFloat(item.price).toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditItem(index)}
                            className="text-blue-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveReceipt}
              className={`w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors mt-6 ${isFirestoreLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isFirestoreLoading}
            >
              {isFirestoreLoading ? "Saving..." : "Save Receipt"}
            </button>

            {isFirestoreLoading && (
              <p className="text-gray-600 mt-4">Loading receipts...</p>
            )}

            {firestoreError && (
              <p className="text-red-500 text-sm mt-2">{firestoreError}</p>
            )}
          </div>

          {/* Expense Summary Section */}
          <div className="mt-8 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-200">Expense Summary</h2>
            <div className="flex justify-between items-center text-lg font-bold text-blue-700 dark:text-blue-300 mb-4">
              <span>Total Expenses:</span>
              <span>${totalExpenses.toFixed(2)}</span>
            </div>

            <h3 className="text-lg font-semibold mb-2 text-blue-700 dark:text-blue-300">Expenses by Category:</h3>
            {Object.keys(categoryTotals).length === 0 ? (
              <p className="text-blue-600 dark:text-blue-400">No expenses to summarize by category yet.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(categoryTotals).map(([cat, total]) => (
                  <li key={cat} className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                    <span>{cat}:</span>
                    <span>${total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Receipts Section */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Recent Receipts</h2>
            {receipts.length === 0 && !isFirestoreLoading && !firestoreError ? (
              <p className="text-gray-600 dark:text-gray-400">No receipts yet! Upload one to get started.</p>
            ) : (
              <ul className="space-y-4">
                {receipts.map((receipt) => (
                  <li
                    key={receipt.id}
                    className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{receipt.merchant}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-gray-700 dark:text-gray-300">
                            Amount: ${parseFloat(receipt.amount).toFixed(2)}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">
                            Date: {receipt.date}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">
                            Category: {receipt.category}
                          </p>
                          {receipt.subtotal && (
                            <p className="text-gray-600 dark:text-gray-400">
                              Subtotal: ${parseFloat(receipt.subtotal).toFixed(2)}
                            </p>
                          )}
                          {receipt.payment_method && (
                            <p className="text-gray-600 dark:text-gray-400">
                              Payment Method: {receipt.payment_method}
                            </p>
                          )}
                          {receipt.items && receipt.items.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-700 dark:text-gray-300">Items:</p>
                              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                                {receipt.items.map((item, itemIndex) => (
                                  <li key={itemIndex}>
                                    {item.name}: ${parseFloat(item.price).toFixed(2)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {editingReceipt !== receipt.id && (
                          <button
                            onClick={() => handleEditClick(receipt)}
                            className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReceipt(receipt.id)}
                          className={`bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors ${isFirestoreLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={isFirestoreLoading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}