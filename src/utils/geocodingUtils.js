import CryptoJS from 'crypto-js';
import { db } from '@/firebase';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Address extraction heuristics
const ADDRESS_KEYWORDS = [
  'address', 'adresse', 'dirección', 'indirizzo', 'endereço', 'adres',
  'street', 'straße', 'calle', 'via', 'rua', 'straat',
  'road', 'weg', 'carretera', 'strada', 'estrada', 'weg',
  'avenue', 'avenida', 'avenue', 'viale', 'avenida', 'laan',
  'boulevard', 'boulevard', 'bulevar', 'viale', 'avenida', 'boulevard'
];

const POSTCODE_PATTERNS = [
  /[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}/i,  // UK: SW1A 1AA
  /\d{5}/,                            // US: 12345
  /\d{4}\s?[A-Z]{2}/i,               // NL: 1234 AB
  /\d{5}\s?\d{4}/,                   // BR: 12345-6789
  /\d{4,5}/,                         // Generic 4-5 digits
];

const PHONE_PATTERNS = [
  /[\+]?[1-9][\d]{0,15}/,            // International phone
  /\(\d{3}\)\s?\d{3}-\d{4}/,         // US: (123) 456-7890
  /\d{3}-\d{3}-\d{4}/,               // US: 123-456-7890
  /\d{3}\s\d{3}\s\d{4}/,             // US: 123 456 7890
];

// Extract address from OCR text using heuristics
export function extractAddressFromText(text) {
  if (!text || typeof text !== 'string') return null;
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const candidateLines = [];
  
  // Take top 10 non-empty lines
  const topLines = lines.slice(0, 10);
  
  for (const line of topLines) {
    const trimmedLine = line.trim();
    
    // Skip lines that are likely amounts or line items
    if (trimmedLine.match(/^\d+[.,]\d{2}$/) || // Price: 12.34
        trimmedLine.match(/^\d+\s*[xX]\s*\d+[.,]\d{2}$/) || // Quantity x price
        trimmedLine.match(/^[A-Za-z\s]+\s+\d+[.,]\d{2}$/)) { // Item price
      continue;
    }
    
    // Look for address indicators
    const hasAddressKeyword = ADDRESS_KEYWORDS.some(keyword => 
      trimmedLine.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const hasPostcode = POSTCODE_PATTERNS.some(pattern => pattern.test(trimmedLine));
    const hasPhone = PHONE_PATTERNS.some(pattern => pattern.test(trimmedLine));
    const hasDigitsAndLetters = /\d/.test(trimmedLine) && /[A-Za-z]/.test(trimmedLine);
    
    // Score the line
    let score = 0;
    if (hasAddressKeyword) score += 3;
    if (hasPostcode) score += 4;
    if (hasPhone) score += 2;
    if (hasDigitsAndLetters) score += 1;
    
    if (score > 0) {
      candidateLines.push({ line: trimmedLine, score });
    }
  }
  
  // Sort by score and take the best candidates
  candidateLines.sort((a, b) => b.score - a.score);
  
  // Combine top candidates into a single address string
  const addressLines = candidateLines.slice(0, 3).map(c => c.line);
  return addressLines.length > 0 ? addressLines.join(', ') : null;
}

// Normalize address using libpostal-like parsing (simplified)
export function parseAddress(addressRaw) {
  if (!addressRaw) return null;
  
  const address = addressRaw.trim();
  const parts = {
    house_number: '',
    road: '',
    city: '',
    state: '',
    postcode: '',
    country: '',
    country_code: ''
  };
  
  // Extract postcode
  const postcodeMatch = address.match(/(\d{4,5})/);
  if (postcodeMatch) {
    parts.postcode = postcodeMatch[1];
  }
  
  // Country detection: prefer explicit US mentions, avoid mistaking state codes as country codes
  const explicitUS = /(USA|United States|US)/i.test(address);
  if (explicitUS) {
    parts.country_code = 'US';
  } else {
    const countryMatch = address.match(/\b([A-Z]{2})\b$/);
    if (countryMatch) {
      const cc = countryMatch[1];
      // Avoid common state codes when at the end of US addresses
      const likelyStates = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']);
      if (!likelyStates.has(cc)) {
        parts.country_code = cc;
      }
    }
  }
  
  // Simple city extraction (look for capitalized words that might be cities)
  const words = address.split(/[,\s]+/);
  const cityCandidates = words.filter(word => 
    word.length > 2 && 
    word[0] === word[0].toUpperCase() && 
    !/\d/.test(word) &&
    !ADDRESS_KEYWORDS.some(keyword => word.toLowerCase().includes(keyword.toLowerCase()))
  );
  
  if (cityCandidates.length > 0) {
    parts.city = cityCandidates[0];
  }
  
  // Extract house number
  const houseNumberMatch = address.match(/^(\d+)/);
  if (houseNumberMatch) {
    parts.house_number = houseNumberMatch[1];
  }
  
  // Extract road name (simplified)
  const roadMatch = address.match(/([A-Za-z\s]+(?:street|road|avenue|boulevard|way|drive|lane|close|place|terrace|court|gardens|hill|park|view|mews|walk|rise|grove|mead|end|green|row|yard|square|circus|crescent|quay|wharf|bridge|gate|hall|house|manor|moor|mount|north|south|east|west|northern|southern|eastern|western|upper|lower|high|low|new|old|great|little|long|short|wide|narrow|main|side|back|front|top|bottom|middle|central|inner|outer|inner|outer|north|south|east|west|northern|southern|eastern|western|upper|lower|high|low|new|old|great|little|long|short|wide|narrow|main|side|back|front|top|bottom|middle|central|inner|outer))/i);
  if (roadMatch) {
    parts.road = roadMatch[1].trim();
  }
  
  return parts;
}

// Create normalized address string for hashing
export function createNormalizedAddress(addressParsed) {
  if (!addressParsed) return '';
  
  const parts = [];
  
  if (addressParsed.house_number) parts.push(addressParsed.house_number);
  if (addressParsed.road) parts.push(addressParsed.road);
  if (addressParsed.postcode) parts.push(addressParsed.postcode);
  if (addressParsed.city) parts.push(addressParsed.city);
  if (addressParsed.country) parts.push(addressParsed.country);
  
  return parts.join(', ').toLowerCase().trim();
}

// Generate address hash for deduplication
export function generateAddressHash(normalizedAddress) {
  if (!normalizedAddress) return null;
  return CryptoJS.SHA256(normalizedAddress).toString();
}

// Calculate confidence score for address parsing
export function calculateAddressConfidence(addressParsed) {
  if (!addressParsed) return 0;
  
  let score = 0;
  if (addressParsed.house_number) score += 1;
  if (addressParsed.postcode) score += 1;
  if (addressParsed.city && addressParsed.country_code) score += 1;
  if (addressParsed.road) score += 1;
  
  return Math.min(score / 4, 1); // Normalize to 0-1
}

// Check geocode cache
export async function checkGeocodeCache(addressHash) {
  if (!addressHash) return null;
  
  try {
    const cacheRef = doc(db, 'geocodeCache', addressHash);
    const cacheSnap = await getDoc(cacheRef);
    
    if (cacheSnap.exists()) {
      const data = cacheSnap.data();
      return {
        ...data,
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Geocode cache not available (continuing without cache):', error.message);
    // Continue without cache - this is not critical for functionality
    return null;
  }
}

// Save to geocode cache
export async function saveToGeocodeCache(addressHash, data) {
  if (!addressHash) return;
  
  try {
    const cacheRef = doc(db, 'geocodeCache', addressHash);
    await setDoc(cacheRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Could not save to geocode cache (continuing without cache):', error.message);
    // Continue without caching - this is not critical for functionality
  }
}

// Geocode using Nominatim (OpenStreetMap)
export async function geocodeWithNominatim(address, countryCode = null, postcode = null) {
  try {
    console.log('[Geocode] Start nominatim', { address, countryCode, postcode });
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: 1,
      addressdetails: 1,
      'accept-language': 'en'
    });
    
    // If countryCode is a likely US state (PA, CA, etc.), replace with US
    const likelyStates = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']);
    let cc = countryCode;
    if (cc && likelyStates.has(cc.toUpperCase())) {
      cc = 'US';
    }
    if (cc) {
      params.append('countrycodes', cc);
    }
    
    if (postcode) {
      params.append('postalcode', postcode);
    }
    
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ReceiptTrack/1.0 (expense-tracker@example.com)',
        'Accept': 'application/json'
      }
    });
    console.log('[Geocode] Response status', response.status);
    
    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Geocode] Results', data);
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        place: {
          provider: 'osm',
          osm_id: result.osm_id,
          osm_type: result.osm_type,
          display_name: result.display_name,
          importance: result.importance || 0
        },
        quality: 'ok'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding with Nominatim:', error);
    return null;
  }
}

// Get postcode centroid (simplified - in production you'd have a database)
export async function getPostcodeCentroid(countryCode, postcode) {
  if (!countryCode || !postcode) return null;
  
  try {
    // For now, we'll use a simple fallback to Nominatim with just postcode
    const address = `${postcode}, ${countryCode}`;
    const result = await geocodeWithNominatim(address, countryCode);
    
    if (result) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        quality: 'approx'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting postcode centroid:', error);
    return null;
  }
}

// Main geocoding function with caching and fallbacks
export async function geocodeAddress(addressRaw, addressParsed = null) {
  if (!addressRaw) return null;
  
  // Parse address if not provided
  if (!addressParsed) {
    addressParsed = parseAddress(addressRaw);
  }
  
  if (!addressParsed) return null;
  
  // Create normalized address and hash
  const normalizedAddress = createNormalizedAddress(addressParsed);
  const addressHash = generateAddressHash(normalizedAddress);
  
  if (!addressHash) return null;
  
  // Check cache first
  const cached = await checkGeocodeCache(addressHash);
  if (cached) {
    return {
      addressHash,
      addressParsed,
      location: cached.location,
      place: cached.place,
      geocodeStatus: cached.quality === 'ok' ? 'ok' : 'approx',
      source: 'cache'
    };
  }
  
  // Try precise geocoding first
  const preciseResult = await geocodeWithNominatim(
    normalizedAddress, 
    addressParsed.country_code, 
    addressParsed.postcode
  );
  
  if (preciseResult) {
    const result = {
      addressHash,
      addressParsed,
      location: preciseResult.latitude && preciseResult.longitude ? {
        latitude: preciseResult.latitude,
        longitude: preciseResult.longitude
      } : null,
      place: preciseResult.place,
      geocodeStatus: preciseResult.quality === 'ok' ? 'ok' : 'approx',
      source: 'nominatim'
    };
    
    // Cache the result
    await saveToGeocodeCache(addressHash, {
      addressParsed,
      location: result.location,
      place: result.place,
      source: 'osm',
      quality: preciseResult.quality
    });
    
    return result;
  }
  
  // Fallback to postcode centroid
  if (addressParsed.postcode && addressParsed.country_code) {
    const centroidResult = await getPostcodeCentroid(
      addressParsed.country_code, 
      addressParsed.postcode
    );
    
    if (centroidResult) {
      const result = {
        addressHash,
        addressParsed,
        location: {
          latitude: centroidResult.latitude,
          longitude: centroidResult.longitude
        },
        place: null,
        geocodeStatus: 'approx',
        source: 'postcode_centroid'
      };
      
      // Cache the approximate result
      await saveToGeocodeCache(addressHash, {
        addressParsed,
        location: result.location,
        place: null,
        source: 'postcode_centroid',
        quality: 'approx'
      });
      
      return result;
    }
  }
  
  // Failed to geocode
  return {
    addressHash,
    addressParsed,
    location: null,
    place: null,
    geocodeStatus: 'failed',
    source: 'none'
  };
}

// Rate limiting for geocoding requests
let lastGeocodeRequest = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

export async function rateLimitedGeocode(addressRaw, addressParsed = null) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodeRequest;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  lastGeocodeRequest = Date.now();
  return geocodeAddress(addressRaw, addressParsed);
}
