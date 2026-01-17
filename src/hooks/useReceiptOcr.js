import { useCallback } from 'react';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { queueReceipt } from '@/data/storage';
import { metrics, startTimer, endTimerMs } from '@/lib/analytics';
import { extractAddressFromText, parseAddress, rateLimitedGeocode } from '@/utils/geocodingUtils';
import { toBase64 } from '@/utils/ocrPreviewUtils';

const OCR_PROMPT = `You are an expert receipt analysis system with specialized expertise in date detection, address extraction, and parsing. Analyze this receipt image and extract the following information in JSON format with particular attention to DATE DETECTION and ADDRESS EXTRACTION.

## EXPERT DATE DETECTION INSTRUCTIONS:

### 1. DATE LOCATION PRIORITY (in order of preference):
- **Header/Logo area**: Often contains the most reliable date
- **Transaction date line**: Usually near the top, labeled "Date:", "Datum:", "Fecha:", "Data:", etc.
- **Timestamp**: Look for "Time:", "Uhrzeit:", "Hora:", "Ora:", etc. (use date portion)
- **Footer area**: Sometimes contains date information
- **Receipt number line**: Often includes date (e.g., "Receipt #12345 - 15/06/2024")
- **Cashier/terminal info**: May include date stamps

### 2. DATE FORMAT RECOGNITION:
Recognize and handle these formats intelligently:
- **European**: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, DD MM YYYY
- **American**: MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY
- **ISO**: YYYY-MM-DD, YYYY/MM/DD
- **Text formats**: "15th June 2024", "June 15, 2024", "15 Jun 2024"
- **Abbreviated**: "15/06/24", "06/15/24", "15.06.24"
- **Mixed separators**: "15-06.2024", "15/06-2024"

### 3. AMBIGUOUS DATE RESOLUTION:
- **DD/MM vs MM/DD**: Use context clues (currency, language, store location)
- **Year ambiguity**: "24" - assume "2024" for recent receipts
- **Missing year**: Use current year if not specified
- **Multiple dates**: Choose the transaction date over print date, issue date, etc.

### 4. RELATIVE DATE HANDLING:
- "Today", "Heute", "Hoy", "Oggi" - current date
- "Yesterday", "Gestern", "Ayer", "Ieri" - yesterday's date
- "Last week", "Letzte Woche", "La semana pasada" - calculate relative date

### 5. LANGUAGE-SPECIFIC DATE PATTERNS:
- **German**: "Datum:", "Ausgestellt am:", "Druckdatum:"
- **Spanish**: "Fecha:", "Fecha de emision:", "Fecha de impresion:"
- **French**: "Date:", "Date d'emission:", "Date d'impression:"
- **Italian**: "Data:", "Data di emissione:", "Data di stampa:"
- **Portuguese**: "Data:", "Data de emissao:", "Data de impressao:"
- **Dutch**: "Datum:", "Uitgegeven op:", "Drukdatum:"

### 6. EDGE CASES:
- **Handwritten dates**: Look for clear, legible handwritten dates
- **Stamped dates**: Often in receipt footer or margins
- **Thermal print dates**: May be faint or partially printed
- **Multiple timezones**: Use the local timezone of the receipt
- **Future dates**: Flag if date appears to be in the future (likely error)

### 7. DATE VALIDATION:
- Ensure the date is reasonable (not in distant past/future)
- Check for obvious OCR errors (e.g., "2024" vs "202A")
- Validate day/month ranges (1-31 for days, 1-12 for months)
- Handle leap years correctly

## EXPERT ADDRESS EXTRACTION INSTRUCTIONS:

### 1. ADDRESS LOCATION PRIORITY (in order of preference):
- **Store header/logo area**: Often contains the main business address
- **Contact information section**: Usually near the top or bottom
- **Footer area**: May contain address details
- **Tax information**: Sometimes includes business address
- **Return policy section**: May include store location
- **Website/phone area**: Often near address information

### 2. ADDRESS COMPONENTS TO EXTRACT:
Look for and extract these address elements:
- **Street number and name**: "123 Main Street", "456 Avenue des Champs-Elysees"
- **City**: "Paris", "London", "New York", "Berlin"
- **Postal/ZIP code**: "75001", "SW1A 1AA", "10001", "10115"
- **State/Province**: "California", "Bavaria", "Ile-de-France"
- **Country**: "France", "Germany", "United States", "United Kingdom"
- **Phone numbers**: Often near address information
- **Website/email**: May indicate business location

### 3. MULTILINGUAL ADDRESS PATTERNS:
Recognize address keywords in multiple languages:
- **English**: "Address:", "Location:", "Store:", "Branch:"
- **German**: "Adresse:", "Standort:", "Filiale:", "Geschaft:"
- **French**: "Adresse:", "Localisation:", "Magasin:", "Succursale:"
- **Spanish**: "Direccion:", "Ubicacion:", "Tienda:", "Sucursal:"
- **Italian**: "Indirizzo:", "Posizione:", "Negozio:", "Filiale:"
- **Portuguese**: "Endereco:", "Localizacao:", "Loja:", "Filial:"
- **Dutch**: "Adres:", "Locatie:", "Winkel:", "Filiaal:"

### 4. ADDRESS FORMAT RECOGNITION:
Handle various address formats:
- **European**: "123 Rue de la Paix, 75001 Paris, France"
- **American**: "456 Main St, New York, NY 10001"
- **British**: "789 Oxford Street, London W1D 1BS"
- **International**: "123 Champs-Elysees, 75008 Paris, France"

### 5. ADDRESS VALIDATION:
- Look for complete address lines (street + city + postal code)
- Prefer addresses with postal codes (more precise for geocoding)
- Avoid partial addresses or just phone numbers
- Check for business names that might be confused with addresses

### 6. ADDRESS CONFIDENCE SCORING:
- **High confidence (0.8-1.0)**: Complete address with postal code
- **Medium confidence (0.5-0.8)**: Address with city and country
- **Low confidence (0.2-0.5)**: Partial address or just city
- **No confidence (0.0-0.2)**: No address found or just phone number

## COMPLETE RECEIPT ANALYSIS:

Extract the following information in JSON format:

1. **Store/Merchant name** - The business name
2. **Total amount** - The final total to be paid
3. **Subtotal** - Amount before tax (if present)
4. **Date** - Use expert date detection above (return in YYYY-MM-DD format)
5. **Category** - Choose from: Groceries, Dining, Transportation, Shopping, Bills, Entertainment, Health, Other
6. **Payment Method** - Most likely payment method with confidence score
7. **Currency** - 3-letter currency code (EUR, USD, GBP, etc.)
8. **Items** - List of items with prices (include discounts as negative items)
9. **Address** - Complete business address if found (for location mapping)

## DATE DETECTION CONFIDENCE:

For the date field, also include:
- **date_confidence**: 0-1 score indicating confidence in date detection
- **date_source**: Where the date was found (e.g., "header", "transaction_line", "footer")
- **date_format_detected**: The original format detected (e.g., "DD/MM/YYYY", "MM/DD/YYYY")
- **date_notes**: Any relevant notes about date detection (e.g., "ambiguous format resolved using currency context")

## ADDRESS DETECTION CONFIDENCE:

For the address field, also include:
- **address_confidence**: 0-1 score indicating confidence in address detection
- **address_source**: Where the address was found (e.g., "header", "footer", "contact_info")
- **address_components**: Breakdown of address parts found (e.g., {"street": "123 Main St", "city": "Paris", "postcode": "75001"})
- **address_notes**: Any relevant notes about address detection (e.g., "complete address with postal code found")

## RESPONSE FORMAT:

Reply with a JSON object enclosed in triple backticks:

\`\`\`json
{
  "store": "Store Name",
  "amount": "23.50",
  "subtotal": "20.00",
  "date": "2024-06-15",
  "date_confidence": 0.95,
  "date_source": "transaction_line",
  "date_format_detected": "DD/MM/YYYY",
  "date_notes": "Clear date found in transaction line",
  "category": "Groceries",
  "payment_method": "Credit Card",
  "payment_method_alternatives": ["Cash"],
  "payment_method_reason": "VISA card number detected",
  "payment_method_confidence": 0.9,
  "currency": "EUR",
  "address": "123 Main Street, 75001 Paris, France",
  "address_confidence": 0.9,
  "address_source": "header",
  "address_components": {
    "street": "123 Main Street",
    "city": "Paris",
    "postcode": "75001",
    "country": "France"
  },
  "address_notes": "Complete address found in store header",
  "items": [
    {"name": "Item 1", "price": "10.00"},
    {"name": "Discount", "price": "-2.00"},
    {"name": "Item 2", "price": "13.50"}
  ]
}
\`\`\`

**CRITICAL**: Always return the date in YYYY-MM-DD format regardless of how it appears on the receipt. Use your expert date detection skills to handle any format, language, or edge case. For addresses, provide the most complete and accurate address information available for location mapping.`;

const useReceiptOcr = ({
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
}) => {
  const normalizeMerchant = (value) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\\s]/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
  };

  const tokenSimilarity = (a, b) => {
    if (!a || !b) return 0;
    const aTokens = new Set(a.split(' ').filter(Boolean));
    const bTokens = new Set(b.split(' ').filter(Boolean));
    if (!aTokens.size || !bTokens.size) return 0;
    let intersection = 0;
    aTokens.forEach((token) => {
      if (bTokens.has(token)) intersection += 1;
    });
    const union = aTokens.size + bTokens.size - intersection;
    return union ? intersection / union : 0;
  };

  const normalizeAmount = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const toDateOnly = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    const dateObj = new Date(value);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj;
  };

  const diffInDays = (a, b) => {
    if (!a || !b) return null;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.abs((utcA - utcB) / 86400000);
  };

  const isLikelyDuplicate = (candidate) => {
    if (!candidate || !Array.isArray(receipts) || receipts.length === 0) return null;
    const candidateMerchant = normalizeMerchant(candidate.merchant);
    const candidateAmount = normalizeAmount(candidate.total);
    const candidateDate = toDateOnly(candidate.date);

    let bestMatch = null;
    let bestScore = 0;

    receipts.forEach((receipt) => {
      const receiptMerchant = normalizeMerchant(receipt.merchant);
      const receiptAmount = normalizeAmount(receipt.total);
      const receiptDate = toDateOnly(receipt.transactionDate || receipt.date);

      const amountTolerance = Math.max(0.5, candidateAmount * 0.01);
      const amountMatch = Math.abs(candidateAmount - receiptAmount) <= amountTolerance ? 1 : 0;
      const dateDiff = diffInDays(candidateDate, receiptDate);
      const dateMatch = dateDiff !== null && dateDiff <= 1 ? 1 : 0;
      const merchantScore = tokenSimilarity(candidateMerchant, receiptMerchant);
      const merchantMatch = merchantScore >= 0.7 ? 1 : merchantScore;

      if (!dateMatch || !amountMatch) {
        return;
      }

      const score = amountMatch * 0.4 + dateMatch * 0.3 + merchantMatch * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = receipt;
      }
    });

    if (bestScore >= 0.8) {
      return { receipt: bestMatch, score: bestScore };
    }
    return null;
  };

  const autoSaveReceipt = useCallback(async (ocrData) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save receipts.",
        variant: "destructive",
      });
      return;
    }

    setIsBusy(true);

    try {
      const receiptData = {
        userId: user.uid,
        merchant: ocrData.merchant || '',
        date: serverTimestamp(),
        transactionDate: ocrData.date ? Timestamp.fromDate(new Date(ocrData.date)) : serverTimestamp(),
        total: parseFloat(ocrData.total) || 0,
        subtotal: parseFloat(ocrData.subtotal) || 0,
        tax: parseFloat(ocrData.tax) || 0,
        paymentMethod: ocrData.paymentMethod || 'Other',
        currency: ocrData.currency || 'EUR',
        items: (ocrData.items || [])
          .filter(item => item.name && !isNaN(parseFloat(item.price)))
          .map(item => ({
            name: item.name,
            price: parseFloat(item.price),
          })),
        imageUrl: '',
        category: ocrData.category || 'Uncategorized',
        createdAt: serverTimestamp(),
        groupId: ocrData.groupId || null,
        addressRaw: ocrData.addressRaw,
        addressParsed: ocrData.addressParsed,
        addressHash: ocrData.addressHash,
        geocodeStatus: ocrData.geocodeStatus,
        location: ocrData.location,
        place: ocrData.place,
        addressFromOCR: ocrData.addressFromOCR,
        addressConfidence: ocrData.addressConfidence,
        addressSource: ocrData.addressSource,
        addressComponents: ocrData.addressComponents,
        addressNotes: ocrData.addressNotes,
      };

      const duplicate = isLikelyDuplicate({
        merchant: receiptData.merchant,
        total: receiptData.total,
        date: ocrData.date,
      });

      if (duplicate) {
        toast({
          title: "Possible Duplicate",
          description: "This receipt looks like one you already saved. If it is new, you can edit and save it manually.",
        });
        setIsLoading(false);
        setIsOcrProcessing(false);
        setFile(null);
        setPreviewImageSrc(null);
        setCurrentStep('upload_options');
        return;
      }

      await createReceipt(receiptData);

      toast({
        title: "Saved",
        description: "Saved. Ready for export.",
      });

      setIsLoading(false);
      setIsOcrProcessing(false);

      setShowSuccessState(true);
      setTimeout(() => {
        setShowSuccessState(false);
        setFile(null);
        setPreviewImageSrc(null);
        setCurrentStep('upload_options');
        fetchReceipts();

        if (onTabChange) {
          if (ocrData.groupId) {
            try {
              window.__GROUP_PREFILL__ = {
                groupId: ocrData.groupId,
                label: ocrData.merchant || 'Receipt',
                amount: (parseFloat(ocrData.total) || 0).toFixed(2),
                date: ocrData.date,
                currency: ocrData.currency || 'EUR',
                photo: previewImageSrc || null,
                splitEnabled: true,
              };
            } catch {}
            onTabChange('group');
          } else {
            onTabChange('expenses');
          }
        }
      }, 1500);
    } catch (error) {
      console.error("Error auto-saving receipt:", error);
      toast({
        title: "Error Saving Receipt",
        description: `There was an issue saving your receipt: ${error.message}`,
        variant: "destructive",
      });
      setIsLoading(false);
      setIsOcrProcessing(false);
    } finally {
      setIsBusy(false);
    }
  }, [
    createReceipt,
    fetchReceipts,
    onTabChange,
    previewImageSrc,
    setCurrentStep,
    setFile,
    setIsBusy,
    setIsLoading,
    setIsOcrProcessing,
    setPreviewImageSrc,
    setShowSuccessState,
    toast,
    user,
  ], [
    createReceipt,
    fetchReceipts,
    onTabChange,
    previewImageSrc,
    setCurrentStep,
    setFile,
    setIsBusy,
    setIsLoading,
    setIsOcrProcessing,
    setPreviewImageSrc,
    setShowSuccessState,
    toast,
    user,
    receipts,
  ]);

  const processOCR = useCallback(async (file) => {
    const t = startTimer();
    setIsLoading(true);
    try {
      setIsOcrProcessing(true);
      setOcrError(null);
      const base64 = await toBase64(file);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: OCR_PROMPT },
                { type: "image_url", image_url: { url: base64 } },
              ],
            },
          ],
          max_tokens: 800,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const apiMessage = data?.error?.message || "OCR request failed.";
        throw new Error(apiMessage);
      }
      const replyText = data?.choices?.[0]?.message?.content || '';

      let parsedJSON = null;
      const jsonMatch = replyText.match(/```json\\s*({[\\s\\S]*?})\\s*```/i);
      if (jsonMatch && jsonMatch[1]) {
        parsedJSON = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = replyText.match(/\\{[\\s\\S]*\\}/);
        if (objectMatch && objectMatch[0]) {
          parsedJSON = JSON.parse(objectMatch[0]);
        } else {
          try {
            parsedJSON = JSON.parse(replyText);
          } catch {
            const firstBrace = replyText.indexOf("{");
            const lastBrace = replyText.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              try {
                parsedJSON = JSON.parse(replyText.slice(firstBrace, lastBrace + 1));
              } catch {
                console.error("OCR parsing error: No valid JSON block found in the response.", replyText);
                throw new Error("No valid JSON block found in the OCR response.");
              }
            } else {
              console.error("OCR parsing error: No valid JSON block found in the response.", replyText);
              throw new Error("No valid JSON block found in the OCR response.");
            }
            if (!parsedJSON) {
              throw new Error("No valid JSON block found in the OCR response.");
            }
          }
        }
      }

      let addressRaw = null;
      let geocodeResult = null;

      try {
        if (parsedJSON.address && parsedJSON.address_confidence > 0.5) {
          addressRaw = parsedJSON.address;
          console.log('Address found in OCR response:', addressRaw, 'Confidence:', parsedJSON.address_confidence);
        } else {
          addressRaw = extractAddressFromText(replyText);
          console.log('Address extracted from OCR text:', addressRaw);
        }

        if (addressRaw) {
          const addressParsed = parseAddress(addressRaw);
          geocodeResult = await rateLimitedGeocode(addressRaw, addressParsed);

          if (geocodeResult) {
            console.log('Geocoding successful:', geocodeResult.geocodeStatus, geocodeResult.location);
          }
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed:', geocodeError);
      }

      let normalizedDate = parsedJSON.date;
      if (normalizedDate) {
        try {
          normalizedDate = normalizeDate(normalizedDate);
          const dateObj = new Date(normalizedDate);
          if (isNaN(dateObj.getTime())) {
            console.warn("Invalid date after normalization:", parsedJSON.date, "->", normalizedDate);
            normalizedDate = new Date().toISOString().split('T')[0];
          } else {
            const now = new Date();
            const diffYears = Math.abs(now.getFullYear() - dateObj.getFullYear());
            if (diffYears > 10) {
              console.warn("Date seems unreasonable (too far in past/future):", normalizedDate);
            }
          }
        } catch (error) {
          console.error("Date normalization error:", error);
          normalizedDate = new Date().toISOString().split('T')[0];
        }
      } else {
        normalizedDate = new Date().toISOString().split('T')[0];
      }

      const discountKeywords = [
        'discount', 'rabatt', 'descuento', 'remise', 'sconto', 'desconto', 'skonto',
      ];
      const normalizedItems = (parsedJSON.items || []).map(item => {
        if (!item.name) return item;
        const nameLower = item.name.toLowerCase();
        const isDiscount = discountKeywords.some(keyword => nameLower.includes(keyword));
        let price = item.price;
        if (isDiscount && price) {
          let num = parseFloat(price.toString().replace(/[^\\d.-]/g, ''));
          if (isNaN(num)) return item;
          if (num > 0) num = -num;
          price = num.toFixed(2);
        }
        return { ...item, price };
      });

      let normalizedTax = 0;
      if (parsedJSON.tax) {
        const cleanedTax = parsedJSON.tax.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
        normalizedTax = parseFloat(cleanedTax) || 0;
      } else if (parsedJSON.subtotal && parsedJSON.amount) {
        const subtotalVal = parseFloat(parsedJSON.subtotal.toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        const totalVal = parseFloat(parsedJSON.amount.toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        const diff = totalVal - subtotalVal;
        normalizedTax = diff > 0 ? diff : 0;
      }

      const ocrData = {
        merchant: parsedJSON.store || '',
        total: parsedJSON.amount ? parsedJSON.amount.replace(/[^\\d.,]/g, '').replace(',', '.') : '',
        date: normalizedDate,
        category: parsedJSON.category || '',
        paymentMethod: parsedJSON.payment_method || '',
        currency: parsedJSON.currency || 'EUR',
        items: normalizedItems,
        subtotal: parsedJSON.subtotal ? parsedJSON.subtotal.replace(/[^\\d.,]/g, '').replace(',', '.') : '',
        tax: normalizedTax,
        addressRaw: addressRaw,
        addressParsed: geocodeResult?.addressParsed,
        addressHash: geocodeResult?.addressHash,
        geocodeStatus: geocodeResult?.geocodeStatus || 'pending',
        addressFromOCR: parsedJSON.address || null,
        addressConfidence: parsedJSON.address_confidence || 0,
        addressSource: parsedJSON.address_source || null,
        addressComponents: parsedJSON.address_components || null,
        addressNotes: parsedJSON.address_notes || null,
        location: geocodeResult?.location,
        place: geocodeResult?.place,
      };

      if (!navigator.onLine) {
        const localId = crypto.randomUUID();
        await queueReceipt({
          id: localId,
          userId: user?.uid || 'anonymous',
          type: selectedGroupId ? 'group' : 'personal',
          payload: {
            merchant: ocrData.merchant,
            date: ocrData.date,
            total: parseFloat(ocrData.total) || 0,
            subtotal: parseFloat(ocrData.subtotal) || 0,
            vatAmount: undefined,
            category: ocrData.category,
            paymentMethod: ocrData.paymentMethod,
            currency: ocrData.currency,
            note: '',
            imagePath: '',
            source: 'camera',
            status: 'queued',
            groupId: selectedGroupId || null,
          },
          imageDataUrl: previewImageSrc,
          status: 'queued',
        });
        toast({ title: 'Saved offline', description: 'Saved offline. Will sync when online.' });
      } else {
        if (selectedGroupId) {
          try {
            window.__GROUP_PREFILL__ = {
              groupId: selectedGroupId,
              label: ocrData.merchant || 'Receipt',
              amount: (parseFloat(ocrData.total) || 0).toFixed(2),
              date: ocrData.date,
              currency: ocrData.currency || 'EUR',
              photo: previewImageSrc || null,
              splitEnabled: true,
              ocrJson: ocrData,
            };
            try { sessionStorage.setItem(`group_prefill_${selectedGroupId}`, JSON.stringify(window.__GROUP_PREFILL__)); } catch {}
          } catch {}
          toast({ title: 'Scanned', description: 'Ready to add to group.' });
          try {
            const url = `/group/${selectedGroupId}/expenses?add=1`;
            window.location.assign(url);
          } catch {
            if (onTabChange) onTabChange('group');
          }
        } else {
          await autoSaveReceipt({ ...ocrData, groupId: null });
        }
        if (selectedGroupId) {
          try {
            setRecentGroups(prev => prev.map(g => g.id === selectedGroupId ? { ...g, uses: (g.uses || 0) + 1 } : g));
          } catch {}
        }
      }
    } catch (error) {
      console.error('OCR error:', error);
      setOcrError('Failed to process receipt. Please try again or enter manually.');
      toast({
        title: "OCR Processing Error",
        description: "Failed to process the receipt. Please try again or enter the details manually.",
        variant: "destructive",
      });
    } finally {
      const ms = endTimerMs(t);
      metrics.recordTimeToParsed(ms);
      setIsOcrProcessing(false);
      setIsLoading(false);
    }
  }, [
    autoSaveReceipt,
    normalizeDate,
    onTabChange,
    previewImageSrc,
    selectedGroupId,
    setIsLoading,
    setIsOcrProcessing,
    setOcrError,
    setRecentGroups,
    toast,
    user,
    receipts,
  ]);

  return { processOCR };
};

export default useReceiptOcr;
