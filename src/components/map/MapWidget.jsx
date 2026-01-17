import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, RefreshCw, Calendar, DollarSign, Store, Tag, ChevronDown, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { convertToBaseCurrency, formatCurrency } from '@/utils/currencyUtils';
import { loadSettings } from '@/utils/settingsUtils';
import { rateLimitedGeocode } from '@/utils/geocodingUtils';

const FILTER_CHIPS = [
  { label: 'Category', Icon: Tag },
];

const getMarkerPosition = (seed, index) => {
  const source = `${seed || 'receipt'}-${index}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 1000;
  }
  const left = 12 + (hash % 76);
  const top = 28 + ((hash * 3) % 45);
  return { left: `${left}%`, top: `${top}%` };
};

const getReceiptTitle = (receipt) => {
  return receipt.merchant || receipt.place?.display_name || receipt.addressParsed?.city || 'Unknown';
};

const formatReceiptDateTime = (receipt) => {
  const rawDate = receipt.transactionDate?.toDate?.() || (receipt.date ? new Date(receipt.date) : null);
  if (!rawDate || Number.isNaN(rawDate.getTime())) {
    return 'Unknown date';
  }
  const now = new Date();
  const isToday = rawDate.toDateString() === now.toDateString();
  const timeLabel = rawDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dateLabel = rawDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return isToday ? `Today, ${timeLabel}` : `${dateLabel} ${timeLabel}`;
};

export const _test = {
  getMarkerPosition,
  getReceiptTitle,
  formatReceiptDateTime,
};

export default function MapWidget({ className = '', onViewMap }) {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [baseAmountById, setBaseAmountById] = useState({});

  // Load settings
  useEffect(() => {
    const loadAppSettings = () => {
      try {
        const appSettings = loadSettings();
        setSettings(appSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        setSettings({ baseCurrency: 'EUR' });
      }
    };
    loadAppSettings();
  }, []);

  // Load recent receipts with locations
  useEffect(() => {
    const loadReceipts = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const receiptsRef = collection(db, 'users', user.uid, 'receipts');
        const receiptsQuery = query(
          receiptsRef, 
          orderBy('transactionDate', 'desc'),
          limit(50) // Load last 50 receipts for location analysis
        );
        const snapshot = await getDocs(receiptsQuery);
        
        const receiptsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Debug logs removed to reduce render overhead
        
        setReceipts(receiptsData);
      } catch (error) {
        console.error('Error loading receipts for map widget:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadReceipts();
  }, [user]);

  // Function to manually geocode receipts with address data but no location
  const geocodeReceipts = async () => {
    if (!user) return;
    
    setIsGeocoding(true);
    try {
      const receiptsWithAddressButNoLocation = receipts.filter(receipt => 
        (receipt.addressRaw || receipt.addressFromOCR) && 
        !receipt.location
      );
      
      // Debug log removed to reduce render overhead
      
      for (const receipt of receiptsWithAddressButNoLocation.slice(0, 5)) { // Limit to 5 to avoid rate limits
        try {
          const addressRaw = receipt.addressRaw || receipt.addressFromOCR;
          if (!addressRaw) continue;
          
          // Debug log removed to reduce render overhead
          
          const geocodeResult = await rateLimitedGeocode(addressRaw);
          
          if (geocodeResult && geocodeResult.location) {
            // Update the receipt with location data
            const receiptRef = doc(db, 'users', user.uid, 'receipts', receipt.id);
            await updateDoc(receiptRef, {
              location: geocodeResult.location,
              place: geocodeResult.place,
              geocodeStatus: geocodeResult.geocodeStatus,
              addressHash: geocodeResult.addressHash,
              addressParsed: geocodeResult.addressParsed
            });
            
            // Debug log removed to reduce render overhead
          }
        } catch (error) {
          console.error(`Error geocoding receipt ${receipt.id}:`, error);
        }
      }
      
      // Reload receipts to show updated data
      const receiptsRef = collection(db, 'users', user.uid, 'receipts');
      const receiptsQuery = query(
        receiptsRef, 
        orderBy('transactionDate', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(receiptsQuery);
      
      const receiptsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setReceipts(receiptsData);
      
    } catch (error) {
      console.error('Error during batch geocoding:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const locatedReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      const hasLocation = receipt?.location
        && typeof receipt.location.latitude === 'number'
        && typeof receipt.location.longitude === 'number';
      const hasAltLocation = typeof receipt?.latitude === 'number' && typeof receipt?.longitude === 'number';
      return hasLocation || hasAltLocation;
    });
  }, [receipts]);

  useEffect(() => {
    let isMounted = true;
    const loadBaseAmounts = async () => {
      if (!receipts.length) {
        if (isMounted) setBaseAmountById({});
        return;
      }
      const entries = await Promise.all(
        receipts.map(async (receipt) => {
          const amount = await convertToBaseCurrency(
            receipt.total,
            receipt.currency || settings?.baseCurrency || 'EUR',
            receipt.transactionDate || receipt.date
          );
          return [receipt.id, Math.abs(amount)];
        })
      );
      if (!isMounted) return;
      const next = {};
      entries.forEach(([key, value]) => {
        if (key) next[key] = value;
      });
      setBaseAmountById(next);
    };
    loadBaseAmounts();
    return () => {
      isMounted = false;
    };
  }, [receipts, settings?.baseCurrency]);

  const getBaseAmount = (receipt) => {
    if (receipt?.id && baseAmountById[receipt.id] !== undefined) {
      return baseAmountById[receipt.id];
    }
    return Math.abs(parseFloat(receipt?.total) || 0);
  };

  // Calculate map statistics
  const mapStats = useMemo(() => {
    if (receipts.length === 0) return null;
    if (locatedReceipts.length === 0) return null;

    const totalAmount = locatedReceipts.reduce((sum, receipt) => {
      return sum + getBaseAmount(receipt);
    }, 0);

    const uniqueMerchants = new Set(locatedReceipts.map(r => r.merchant)).size;
    const countries = new Set(locatedReceipts.map(r => r.addressParsed?.country_code).filter(Boolean)).size;
    const cities = new Set(locatedReceipts.map(r => r.addressParsed?.city).filter(Boolean)).size;

    return {
      totalReceipts: locatedReceipts.length,
      totalAmount,
      uniqueMerchants,
      countries,
      cities,
      coveragePercentage: (locatedReceipts.length / receipts.length) * 100
    };
  }, [receipts, locatedReceipts]);

  const previewMarkers = useMemo(() => {
    const palette = ['text-rose-500', 'text-purple-400', 'text-amber-400'];
    return locatedReceipts.slice(0, 3).map((receipt, index) => ({
      receipt,
      position: getMarkerPosition(receipt.id, index),
      color: palette[index % palette.length],
      isActive: index === 0
    }));
  }, [locatedReceipts]);

  const focusReceipt = previewMarkers.find(marker => marker.isActive)?.receipt || null;
  const canViewMap = typeof onViewMap === 'function';
  const handleViewMap = () => {
    if (canViewMap) {
      onViewMap();
    } else {
      console.warn('onViewMap function not available');
    }
  };

  if (isLoading) {
    return (
      <Card className={`bg-[#1C232E] border border-white/5 text-white rounded-2xl ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold">Spending Map</CardTitle>
          <button
            type="button"
            disabled
            className="text-xs font-semibold text-slate-500 disabled:opacity-100"
          >
            Expand
          </button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse">
            <div className="h-[260px] rounded-xl bg-[#141b26] border border-white/5"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!mapStats) {
    return (
      <Card className={`bg-[#1C232E] border border-white/5 text-white rounded-2xl ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold">Spending Map</CardTitle>
          <button
            type="button"
            onClick={handleViewMap}
            disabled={!canViewMap}
            className="text-xs font-semibold text-[#135bec] disabled:opacity-50"
          >
            Expand
          </button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px] rounded-xl bg-[#141b26] border border-white/5 flex flex-col items-center justify-center text-center px-6">
            <MapPin className="h-10 w-10 text-slate-500 mb-3" />
            <h3 className="text-sm font-semibold text-white mb-1">No location data yet</h3>
            <p className="text-xs text-slate-400 mb-4">
              Scan receipts to add locations and reveal your spending map.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <Button
                onClick={handleViewMap}
                disabled={!canViewMap}
                size="sm"
                className="w-full bg-[#135bec] hover:bg-[#0f4bd1] text-white"
              >
                View Map
              </Button>
              {receipts.length > 0 && (
                <Button
                  onClick={geocodeReceipts}
                  disabled={isGeocoding}
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-white hover:bg-white/5"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isGeocoding ? 'animate-spin' : ''}`} />
                  {isGeocoding ? 'Geocoding...' : 'Add Locations'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-[#1C232E] border border-white/5 text-white rounded-2xl ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-bold">Spending Map</CardTitle>
        <button
          type="button"
          onClick={handleViewMap}
          disabled={!canViewMap}
          className="text-xs font-semibold text-[#135bec] disabled:opacity-50"
        >
          Expand
        </button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative w-full h-[260px] rounded-xl overflow-hidden border border-white/5 bg-transparent">

          <div className="absolute top-3 left-3 right-3 z-10 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2">
              {FILTER_CHIPS.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={handleViewMap}
                  className="flex items-center gap-1.5 bg-[#1C232E]/90 px-3 py-1.5 rounded-lg shadow-sm border border-white/10 text-xs font-semibold text-slate-200 hover:bg-[#232c3a] transition"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{label}</span>
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          {previewMarkers.map((marker, index) => (
            <div
              key={marker.receipt.id || index}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={marker.position}
            >
              {marker.isActive ? (
                <div className="relative flex flex-col items-center">
                  {focusReceipt && (
                    <div className="absolute bottom-full mb-2 bg-[#1C232E] p-2.5 rounded-xl shadow-xl border border-white/10 w-32">
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#135bec]/20 flex items-center justify-center shrink-0 text-[#135bec]">
                          <Store className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-white truncate">{getReceiptTitle(focusReceipt)}</p>
                          <p className="text-[10px] font-medium text-slate-400">{formatReceiptDateTime(focusReceipt)}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-white/5 flex justify-between items-end">
                        <span className="text-[10px] text-slate-400">Spent</span>
                        <span className="text-xs font-bold text-white">
                          {formatCurrency(getBaseAmount(focusReceipt), settings?.baseCurrency || "EUR")}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1C232E] rotate-45 border-r border-b border-white/10" />
                    </div>
                  )}
                  <MapPin className="h-6 w-6 text-[#135bec] drop-shadow-lg" />
                  <div className="absolute -bottom-1 w-6 h-1 bg-[#135bec] rounded-full blur-[2px] opacity-60" />
                </div>
              ) : (
                <MapPin className={`h-5 w-5 ${marker.color} drop-shadow-md`} />
              )}
            </div>
          ))}

          <div className="absolute bottom-3 right-3">
            <button
              type="button"
              disabled
              className="size-8 bg-[#1C232E]/90 rounded-full shadow-md flex items-center justify-center text-slate-200 border border-white/10 disabled:opacity-80"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
