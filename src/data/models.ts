export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | '';

export type ReceiptStatus = 'queued' | 'processing' | 'done' | 'needs_fix';

export type ReceiptSource = 'camera' | 'email';

export type GeocodeStatus = 'pending' | 'approx' | 'ok' | 'failed';

export type LineItem = {
  text?: string;
  name?: string;
  qty?: number;
  unit?: string;
  price?: number; // unit price or line price depending on context
};

export type AddressParsed = {
  house_number?: string;
  road?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

export type Place = {
  provider: 'osm';
  osm_id: string;
  osm_type: string;
  display_name: string;
  importance: number;
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
  // Location-based fields for mapping
  addressRaw?: string;      // Raw address from OCR
  addressParsed?: AddressParsed; // Normalized address via libpostal
  addressHash?: string;     // SHA256 hash of normalized address for deduplication
  geocodeStatus?: GeocodeStatus; // Status of geocoding process
  location?: {              // GeoPoint coordinates
    latitude: number;
    longitude: number;
  };
  place?: Place;            // OSM place information
  // Enhanced address information from OCR
  addressFromOCR?: string;  // Structured address from OCR response
  addressConfidence?: number; // Confidence score (0-1) from OCR
  addressSource?: string;   // Where address was found (header, footer, etc.)
  addressComponents?: {     // Breakdown of address parts
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
    state?: string;
  };
  addressNotes?: string;    // Notes about address detection
};

export type GeocodeCache = {
  addressHash: string;
  addressParsed: AddressParsed;
  location: {
    latitude: number;
    longitude: number;
  };
  place?: Place;
  source: 'osm' | 'postcode_centroid';
  updatedAt: Date;
  quality: 'approx' | 'ok';
};

export type PostcodeCentroid = {
  country_code: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

export function computeNet(total?: number, vatAmount?: number): number | undefined {
  if (typeof total !== 'number') return undefined;
  if (typeof vatAmount !== 'number') return total; // assume no VAT component provided
  return Number((total - vatAmount).toFixed(2));
}


