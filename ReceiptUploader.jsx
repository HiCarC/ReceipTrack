import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';

export default function MakeMeApp() {
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState('');
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleOCR = async (file) => {
    try {
      setLoading(true);
      const base64 = await toBase64(file);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": 'Bearer ' + process.env.VITE_OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the store, amount, and date from this receipt image. Only reply with a JSON object enclosed in triple backticks like this:\n```json\n{ \"store\": \"Lidl\", \"amount\": \"23.50\", \"date\": \"13/06/2025\" }\n```" },
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

    } catch (err) {
      console.error('OCR error:', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeDate = (input) => {
    const parts = input.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (!parts) return '';
    const [_, day, month, year] = parts;
    return `${year}-${month}-${day}`;
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handleUpload = () => {
    if (file && amount && store && date) {
      const newReceipt = { file, amount, store, date };
      setReceipts([...receipts, newReceipt]);
      setFile(null);
      setAmount('');
      setStore('');
      setDate('');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">MakeMe MVP - Expense Tracker</h1>

      <Card className="mb-4">
        <CardContent className="space-y-4 p-4">
          <Label htmlFor="file">Upload Receipt</Label>
          <Input
            type="file"
            id="file"
            accept="image/*"
            onChange={(e) => {
              const selectedFile = e.target.files[0];
              setFile(selectedFile);
              handleOCR(selectedFile);
            }}
          />

          <Label htmlFor="store">Store</Label>
          <Input
            id="store"
            placeholder="e.g., Lidl"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />

          <Label htmlFor="amount">Amount (€)</Label>
          <Input
            id="amount"
            placeholder="e.g., 23.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <Button onClick={handleUpload} className="w-full" disabled={loading}>
            <Upload className="mr-2 h-4 w-4" /> {loading ? 'Processing...' : 'Upload Receipt'}
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-2">Uploaded Receipts</h2>
      <div className="space-y-2">
        {receipts.map((r, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-sm">
              <p><strong>Store:</strong> {r.store}</p>
              <p><strong>Amount:</strong> €{r.amount}</p>
              <p><strong>Date:</strong> {r.date}</p>
              <p><strong>File:</strong> {r.file?.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
