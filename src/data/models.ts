export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | '';

export type ReceiptStatus = 'queued' | 'processing' | 'done' | 'needs_fix';

export type ReceiptSource = 'camera' | 'email';

export type LineItem = {
  text?: string;
  name?: string;
  qty?: number;
  unit?: string;
  price?: number; // unit price or line price depending on context
};

export type Receipt = {
  id: string;               // UUID / Firestore doc id
  merchant: string;
  ico?: string;             // supplier IČO
  icDph?: string;           // IČ DPH (VAT ID)
  date: string;             // ISO date (YYYY-MM-DD)
  dueDate?: string;         // for invoices
  variableSymbol?: string;  // VS if present
  currency: 'EUR' | 'CZK' | string;
  total: number;            // gross
  vatRate?: number;         // e.g., 20
  vatAmount?: number;
  net?: number;             // computed
  category?: string;
  paymentMethod?: PaymentMethod;
  note?: string;
  imagePath: string;
  status: ReceiptStatus;
  source: ReceiptSource;
  // Optional extras used in app
  items?: LineItem[];
};

export function computeNet(total?: number, vatAmount?: number): number | undefined {
  if (typeof total !== 'number') return undefined;
  if (typeof vatAmount !== 'number') return total; // assume no VAT component provided
  return Number((total - vatAmount).toFixed(2));
}


