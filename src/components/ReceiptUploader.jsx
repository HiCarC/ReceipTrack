import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Trash2, DollarSign, Calendar, Store, Tag, CreditCard, List } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { db } from '@/firebase'; // Import your Firebase db instance
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore"; // Import Firestore functions

export default function ReceiptUploader() {
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState('');
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [items, setItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});

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

  // Function to fetch receipts from Firestore
  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const receiptsCollection = collection(db, "receipts");
      console.log("Firestore Collection Reference:", receiptsCollection); // This will log the collection object
      const receiptSnapshot = await getDocs(receiptsCollection);
      const receiptsList = receiptSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReceipts(receiptsList);
      console.log("Successfully fetched receipts:", receiptsList); // Log success
    } catch (error) {
      console.error("Error fetching receipts from Firestore:", error);
      // Log the full error object for more details
      if (error.code) console.error("Firestore Error Code:", error.code);
      if (error.message) console.error("Firestore Error Message:", error.message);
      if (error.stack) console.error("Firestore Error Stack:", error.stack);
      alert(`Error loading receipts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts(); // Load receipts on component mount
  }, []);

  useEffect(() => {
    // Calculate total expenses
    const total = receipts.reduce((sum, receipt) => sum + parseFloat(receipt.amount), 0);
    setTotalExpenses(total);

    // Calculate category totals
    const categorySums = receipts.reduce((acc, receipt) => {
      const cat = receipt.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + parseFloat(receipt.amount);
      return acc;
    }, {});
    setCategoryTotals(categorySums);
  }, [receipts]);

  const handleOCR = async (file) => {
    try {
      setLoading(true);
      
      // Check if API key is available
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key is not set in environment variables');
      }

      // Convert file to base64
      const base64 = await toBase64(file);
      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      // Remove the data URL prefix and get the base64 data
      const base64Data = base64.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid base64 data format');
      }

      console.log('Sending request to OpenAI API...');
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "Extract the store name, total amount, date, subtotal, payment method, and a list of individual items with their names and prices from this receipt image. Format your response as a JSON object with these exact keys: 'store', 'amount', 'date', 'subtotal', 'payment_method', and 'items'. The 'items' key should be an array of objects, each with 'name' (string) and 'price' (string). Example response format:\n```json\n{\"store\": \"Lidl\", \"amount\": \"23.50\", \"date\": \"13/06/2025\", \"subtotal\": \"20.00\", \"payment_method\": \"Credit Card\", \"category\": \"Groceries\", \"items\": [{\"name\":\"Milk\",\"price\":\"3.00\"}, {\"name\":\"Bread\",\"price\":\"2.50\"}]}\n```" 
                },
                { 
                  type: "image_url", 
                  image_url: { 
                    url: `data:image/jpeg;base64,${base64Data}`,
                    detail: "high"
                  } 
                }
              ]
            }
          ],
          max_tokens: 1000 // Increased max_tokens for more detailed response
        })
      });

      // Check if the response is ok
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

      // Check if we have a valid response
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid API response structure:', data);
        throw new Error('Invalid API response structure');
      }

      const replyText = data.choices[0].message.content;
      console.log("Raw API Response Text:", replyText);

      // Try to find JSON in the response
      let jsonMatch = replyText.match(/```json\s*({[\s\S]*?})\s*```/i);
      if (!jsonMatch) {
        // If no JSON block found, try to parse the entire response as JSON
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

      // Clean the JSON string by removing any markdown formatting and extra whitespace
      const jsonStr = jsonMatch[1].replace(/```json\n|\n```/g, '').trim();
      const parsedJSON = JSON.parse(jsonStr);
      console.log("Parsed JSON:", parsedJSON);

      // Validate the parsed JSON has the required fields (category is optional from API, but we'll default it)
      if (!parsedJSON.store || !parsedJSON.amount || !parsedJSON.date || !parsedJSON.subtotal || !parsedJSON.payment_method || !parsedJSON.items) {
        console.error("Missing required fields in JSON:", parsedJSON);
        throw new Error("Missing required fields in the response");
      }

      if (parsedJSON.amount) {
        const cleanAmount = parsedJSON.amount.replace(/[^\d.,]/g, '').replace(',', '.');
        setAmount(cleanAmount);
      }
      if (parsedJSON.store) setStore(parsedJSON.store);
      if (parsedJSON.date) {
        const rawDate = parsedJSON.date.trim();
        const normalizedDate = normalizeDate(rawDate);
        if (normalizedDate) setDate(normalizedDate);
      }
      // Category is optional from API, will default to 'Other' if not provided
      if (parsedJSON.category) {
        const matchedCategory = categories.find(cat => cat.toLowerCase() === parsedJSON.category.toLowerCase());
        setCategory(matchedCategory || 'Other');
      } else {
        setCategory('Other'); // Explicitly set to 'Other' if API doesn't return a category
      }
      if (parsedJSON.subtotal) {
        const cleanSubtotal = parsedJSON.subtotal.replace(/[^\d.,]/g, '').replace(',', '.');
        setSubtotal(cleanSubtotal);
      }
      if (parsedJSON.payment_method) setPaymentMethod(parsedJSON.payment_method);
      if (parsedJSON.items) setItems(parsedJSON.items);

    } catch (err) {
      console.error('OCR error:', err);
      alert(`Error processing receipt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const normalizeDate = (input) => {
    // Try different date formats
    const formats = [
      /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/, // YYYY/MM/DD or YYYY-MM/DD
      /(\d{2})[\/\-](\d{2})[\/\-](\d{2})/  // MM/DD/YY or MM-DD-YY
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
      console.error('Date parsing error:', e);
    }

    return '';
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handleUpload = async () => {
    if (file && amount && store && date) {
      const newReceipt = { 
        file: file.name, // Store file name instead of full File object
        amount, 
        store, 
        date,
        category: category || 'Uncategorized',
        subtotal: subtotal || 'N/A',
        paymentMethod: paymentMethod || 'N/A',
        items: items // Include items in the new receipt object
      };

      try {
        // Add a new document with a generated ID
        const docRef = await addDoc(collection(db, "receipts"), newReceipt);
        console.log("Document written with ID: ", docRef.id);
        setReceipts([...receipts, { id: docRef.id, ...newReceipt }]);
      } catch (e) {
        console.error("Error adding document: ", e);
        alert(`Error saving receipt: ${e.message}`);
      }

      setFile(null);
      setAmount('');
      setStore('');
      setDate('');
      setCategory('');
      setSubtotal('');
      setPaymentMethod('');
      setItems([]); // Clear items after upload
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "receipts", id));
      setReceipts(receipts.filter(receipt => receipt.id !== id));
    } catch (e) {
      console.error("Error removing document: ", e);
      alert(`Error deleting receipt: ${e.message}`);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
        <div className="text-xl font-semibold">
          Total Expenses: €{totalExpenses.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file">Upload Receipt</Label>
              <Input
                type="file"
                id="file"
                accept="image/*"
                onChange={(e) => {
                  const selectedFile = e.target.files[0];
                  setFile(selectedFile);
                  if (selectedFile) {
                    handleOCR(selectedFile);
                  }
                }}
              />
            </div>

            <div>
              <Label htmlFor="store">Store</Label>
              <div className="flex gap-2">
                <Store className="w-4 h-4 mt-2" />
                <Input
                  id="store"
                  placeholder="e.g., Lidl"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="amount">Amount (€)</Label>
              <div className="flex gap-2">
                <DollarSign className="w-4 h-4 mt-2" />
                <Input
                  id="amount"
                  placeholder="e.g., 23.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="date">Date</Label>
              <div className="flex gap-2">
                <Calendar className="w-4 h-4 mt-2" />
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <div className="flex gap-2">
                <Tag className="w-4 h-4 mt-2" />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="subtotal">Subtotal (€)</Label>
              <div className="flex gap-2">
                <DollarSign className="w-4 h-4 mt-2" />
                <Input
                  id="subtotal"
                  placeholder="e.g., 20.00"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <div className="flex gap-2">
                <CreditCard className="w-4 h-4 mt-2" />
                <Input
                  id="paymentMethod"
                  placeholder="e.g., Credit Card"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleUpload} className="w-full" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" /> {loading ? 'Processing...' : 'Add Expense'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Category Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(categoryTotals).map(([category, total]) => (
                  <div key={category} className="flex justify-between items-center">
                    <span className="font-medium">{category}</span>
                    <span>€{total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <Card key={receipt.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4" />
                            <span className="font-medium">{receipt.store}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>Amount: €{receipt.amount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Date: {receipt.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            <span>Category: {receipt.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>Subtotal: €{receipt.subtotal}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            <span>Payment: {receipt.paymentMethod}</span>
                          </div>
                          {receipt.items && receipt.items.length > 0 && (
                            <div className="space-y-1 mt-2 p-2 border rounded-md bg-muted/20">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                <List className="w-4 h-4" />
                                <span>Items:</span>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 text-xs">
                                {receipt.items.map((item, index) => (
                                  <li key={index} className="flex justify-between">
                                    <span>{item.name}</span>
                                    <span>€{parseFloat(item.price).toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(receipt.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}