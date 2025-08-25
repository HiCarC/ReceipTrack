import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { formatCurrency } from '@/utils/currencyUtils';
import { loadSettings } from '@/utils/settingsUtils';
import { rateLimitedGeocode } from '@/utils/geocodingUtils';

export default function MapWidget({ className = '', onViewMap }) {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

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
        
        console.log('MapWidget - Loaded receipts:', receiptsData.length);
        
        // Check if any receipts have address data but no location
        const receiptsWithAddressButNoLocation = receiptsData.filter(receipt => 
          (receipt.addressRaw || receipt.addressFromOCR) && 
          !receipt.location
        );
        
        if (receiptsWithAddressButNoLocation.length > 0) {
          console.log('Receipts with address but no location:', receiptsWithAddressButNoLocation);
        }
        
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
      
      console.log(`Attempting to geocode ${receiptsWithAddressButNoLocation.length} receipts...`);
      
      for (const receipt of receiptsWithAddressButNoLocation.slice(0, 5)) { // Limit to 5 to avoid rate limits
        try {
          const addressRaw = receipt.addressRaw || receipt.addressFromOCR;
          if (!addressRaw) continue;
          
          console.log(`Geocoding receipt ${receipt.id}:`, addressRaw);
          
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
            
            console.log(`Successfully geocoded receipt ${receipt.id}`);
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

  // Calculate map statistics
  const mapStats = useMemo(() => {
    if (receipts.length === 0) return null;
    
    // Debug: Log receipt data to see structure
    console.log('MapWidget - Receipts data:', receipts);
    
    const locatedReceipts = receipts.filter(receipt => {
      // Accept either nested location { latitude, longitude } or top-level latitude/longitude
      const hasLocation = receipt && receipt.location 
        && typeof receipt.location.latitude === 'number' 
        && typeof receipt.location.longitude === 'number';
      
      // Also check for alternative location formats
      const hasAltLocation = receipt 
        && typeof receipt.latitude === 'number' 
        && typeof receipt.longitude === 'number';
      const hasAddressData = receipt.addressRaw || receipt.addressFromOCR;
      
      console.log(`Receipt ${receipt.id}:`, {
        hasLocation,
        hasAltLocation,
        hasAddressData,
        location: receipt.location,
        addressRaw: receipt.addressRaw,
        addressFromOCR: receipt.addressFromOCR
      });
      
      return hasLocation || hasAltLocation;
    });

    console.log('Located receipts:', locatedReceipts.length, 'out of', receipts.length);

    if (locatedReceipts.length === 0) return null;

    const totalAmount = locatedReceipts.reduce((sum, receipt) => {
      return sum + (parseFloat(receipt.total) || 0);
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
  }, [receipts]);

  // Get recent locations for preview
  const recentLocations = useMemo(() => {
    if (!mapStats) return [];
    
    const locatedReceipts = receipts.filter(receipt => 
      receipt.location && 
      receipt.location.latitude && 
      receipt.location.longitude
    );

    // Get unique locations (by place name or city)
    const locationMap = new Map();
    locatedReceipts.slice(0, 10).forEach(receipt => {
      const locationKey = receipt.place?.display_name || receipt.addressParsed?.city || 'Unknown';
      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          name: locationKey,
          count: 1,
          totalAmount: parseFloat(receipt.total) || 0,
          lastVisit: receipt.transactionDate?.toDate?.() || new Date(receipt.date)
        });
      } else {
        const existing = locationMap.get(locationKey);
        existing.count += 1;
        existing.totalAmount += parseFloat(receipt.total) || 0;
        const receiptDate = receipt.transactionDate?.toDate?.() || new Date(receipt.date);
        if (receiptDate > existing.lastVisit) {
          existing.lastVisit = receiptDate;
        }
      }
    });

    return Array.from(locationMap.values())
      .sort((a, b) => b.lastVisit - a.lastVisit)
      .slice(0, 3);
  }, [receipts, mapStats]);

  if (isLoading) {
    return (
      <Card className={`bg-slate-800/30 backdrop-blur-sm border-slate-700/30 ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Spending Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-32 bg-slate-700/30 rounded-lg mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-700/30 rounded w-3/4"></div>
              <div className="h-4 bg-slate-700/30 rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!mapStats) {
    return (
      <Card className={`bg-slate-800/30 backdrop-blur-sm border-slate-700/30 ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Spending Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Location Data</h3>
            <p className="text-sm text-gray-400 mb-4">
              Scan receipts to automatically add locations and see your spending map!
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => {
                  if (onViewMap) {
                    onViewMap();
                  } else {
                    console.warn('onViewMap function not available');
                  }
                }}
                variant="outline"
                size="sm"
                className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50"
              >
                <MapPin className="h-4 w-4 mr-2" />
                View Map
              </Button>
              
              {receipts.length > 0 && (
                <Button
                  onClick={geocodeReceipts}
                  disabled={isGeocoding}
                  variant="outline"
                  size="sm"
                  className="bg-green-700/50 border-green-600 text-white hover:bg-green-600/50"
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
    <Card className={`bg-slate-800/30 backdrop-blur-sm border-slate-700/30 ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-400" />
          Spending Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Map Preview */}
        <div className="bg-slate-700/30 rounded-lg p-4 mb-4 h-32 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-2">🗺️</div>
            <div className="text-sm text-blue-300">
              {mapStats.totalReceipts} receipts across {mapStats.countries} countries
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="text-blue-300 text-xs">Total Spent</div>
            <div className="text-lg font-bold">
              {formatCurrency(mapStats.totalAmount, settings?.baseCurrency || 'EUR')}
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="text-blue-300 text-xs">Coverage</div>
            <div className="text-lg font-bold">{mapStats.coveragePercentage.toFixed(1)}%</div>
          </div>
        </div>

        {/* Recent Locations */}
        {recentLocations.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-blue-200 mb-2">Recent Locations</h4>
            <div className="space-y-2">
              {recentLocations.map((location, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{location.name}</div>
                    <div className="text-blue-300 text-xs">
                      {location.count} visits • {formatCurrency(location.totalAmount, settings?.baseCurrency || 'EUR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Full Map Button */}
        <Button
          onClick={() => {
            if (onViewMap) {
              onViewMap();
            } else {
              console.warn('onViewMap function not available');
            }
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <MapPin className="h-4 w-4 mr-2" />
          View Full Map
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
