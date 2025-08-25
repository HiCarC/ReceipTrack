import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { MapPin, Map as MapIcon, ZoomIn, ZoomOut, Navigation, Layers, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/currencyUtils';
import { loadSettings } from '@/utils/settingsUtils';
import 'maplibre-gl/dist/maplibre-gl.css';

// Map configuration
const MAP_CONFIG = {
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', // Free CartoDB tiles
  center: [0, 0],
  zoom: 2,
  maxZoom: 18,
  minZoom: 1
};

// Cluster configuration
const CLUSTER_CONFIG = {
  radius: 40,
  maxZoom: 16,
  minPoints: 2
};

// Custom map styles
const mapStyles = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
};

export default function ReceiptMap({ receipts = [], className = '', onReceiptClick }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const cluster = useRef(null);
  const markers = useRef(new window.Map());
  const { toast } = useToast();
  
  const [mapStyle, setMapStyle] = useState('positron');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [settings, setSettings] = useState(null);

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

  // Filter receipts with location data
  const locatedReceipts = useMemo(() => {
    const filtered = receipts.filter(receipt => 
      receipt && receipt.location && 
      typeof receipt.location.latitude === 'number' &&
      typeof receipt.location.longitude === 'number' &&
      !isNaN(receipt.location.latitude) && 
      !isNaN(receipt.location.longitude)
    );
    
    console.log('[ReceiptMap] Filtered receipts:', {
      total: receipts.length,
      withLocation: filtered.length,
      locations: filtered.map(r => ({
        id: r.id,
        lat: r.location.latitude,
        lng: r.location.longitude,
        merchant: r.merchant
      }))
    });
    
    return filtered;
  }, [receipts]);

  // Prepare data for clustering
  const clusterData = useMemo(() => {
    return locatedReceipts.map(receipt => ({
      type: 'Feature',
      properties: {
        id: receipt.id,
        receipt: receipt,
        cluster: false
      },
      geometry: {
        type: 'Point',
        coordinates: [receipt.location.longitude, receipt.location.latitude]
      }
    }));
  }, [locatedReceipts]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('[ReceiptMap] Initializing map with', locatedReceipts.length, 'receipts');
    
    let mapInstance = null;
    
    try {
      // Check if maplibregl is available
      if (typeof maplibregl === 'undefined') {
        console.error('[ReceiptMap] maplibregl is not available');
        return;
      }
      
      mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: mapStyles[mapStyle],
        center: MAP_CONFIG.center,
        zoom: MAP_CONFIG.zoom,
        maxZoom: MAP_CONFIG.maxZoom,
        minZoom: MAP_CONFIG.minZoom,
        attributionControl: true,
        customAttribution: '© OpenStreetMap contributors, © CARTO'
      });
      
      map.current = mapInstance;
      console.log('[ReceiptMap] Map instance created successfully');
    } catch (error) {
      console.error('[ReceiptMap] Error creating map:', error);
      return;
    }

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add fullscreen control
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Handle map load
    map.current.on('load', () => {
      setIsMapLoaded(true);
      console.log('[ReceiptMap] Map loaded, initializing clustering');
      
      // Initialize clustering
      cluster.current = new Supercluster({
        radius: CLUSTER_CONFIG.radius,
        maxZoom: CLUSTER_CONFIG.maxZoom,
        minPoints: CLUSTER_CONFIG.minPoints
      });
      
      // Force update markers after a short delay to ensure data is ready
      setTimeout(() => {
        if (clusterData.length > 0) {
          console.log('[ReceiptMap] Loading cluster data:', clusterData.length, 'points');
          cluster.current.load(clusterData);
          updateMapMarkers();
          
          // Auto-fit map to show all markers
          setTimeout(() => {
            if (map.current && locatedReceipts.length > 0) {
              console.log('[ReceiptMap] Auto-fitting map to data');
              fitMapToData();
            }
          }, 200);
        } else {
          console.log('[ReceiptMap] No cluster data available yet');
        }
      }, 100);
    });

    // Handle map bounds change
    map.current.on('moveend', () => {
      if (map.current) {
        const bounds = map.current.getBounds();
        setMapBounds(bounds);
        updateMapMarkers();
      }
    });

    // Handle map style change
    map.current.on('styledata', () => {
      updateMapMarkers();
    });

    return () => {
      if (map.current) {
        try {
          console.log('[ReceiptMap] Cleaning up map');
          
          // Remove all event listeners to prevent errors
          const events = ['load', 'moveend', 'styledata', 'error', 'data', 'render'];
          events.forEach(event => {
            try {
              map.current.off(event);
            } catch (e) {
              // Ignore errors when removing listeners
            }
          });
          
          // Remove controls first
          try {
            if (map.current.getContainer()) {
              map.current.remove();
            }
          } catch (error) {
            console.warn('[ReceiptMap] Error during map removal:', error);
          }
        } catch (error) {
          console.warn('[ReceiptMap] Error during map cleanup:', error);
        }
        map.current = null;
      }
    };
  }, [mapStyle, clusterData.length]);

  // Update map style
  useEffect(() => {
    if (map.current && isMapLoaded) {
      try {
        // Check if map is still valid before changing style
        if (map.current.isStyleLoaded()) {
          map.current.setStyle(mapStyles[mapStyle]);
        }
      } catch (error) {
        console.warn('[ReceiptMap] Error setting map style:', error);
      }
    }
  }, [mapStyle, isMapLoaded]);

  // Update markers when data changes
  useEffect(() => {
    if (isMapLoaded && cluster.current) {
      console.log('[ReceiptMap] Updating markers for', clusterData.length, 'points');
      cluster.current.load(clusterData);
      updateMapMarkers();
    }
  }, [clusterData, isMapLoaded]);

  // Update map markers based on current view
  const updateMapMarkers = useCallback(() => {
    if (!map.current || !cluster.current || !isMapLoaded) return;

    console.log('[ReceiptMap] Updating map markers');
    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    const bounds = map.current.getBounds();
    const zoom = Math.floor(map.current.getZoom());
    
    // Get clusters and points for current view
    const clusters = cluster.current.getClusters(bounds, zoom);
    console.log('[ReceiptMap] Found', clusters.length, 'clusters/points');

    clusters.forEach((feature, index) => {
      console.log(`[ReceiptMap] Processing feature ${index}:`, {
        type: feature.properties.cluster ? 'cluster' : 'receipt',
        id: feature.properties.id || feature.properties.cluster_id,
        coordinates: feature.geometry.coordinates,
        properties: feature.properties
      });
      
      const coordinates = feature.geometry.coordinates;
      const el = document.createElement('div');
      
      if (feature.properties.cluster) {
        // Render cluster
        const pointCount = feature.properties.point_count;
        const size = Math.min(pointCount * 3 + 20, 60);
        
        el.className = 'cluster-marker';
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${Math.min(size / 3, 16)}px;
          cursor: pointer;
          transition: all 0.2s ease;
        `;
        el.textContent = pointCount;
        
        // Add tooltip for cluster
        el.title = `${pointCount} receipts in this area - click to zoom in`;
        
        // Add hover effects
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.1)';
          el.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
        });
        
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        
        // Handle cluster click
        el.addEventListener('click', () => {
          const expansionZoom = Math.min(
            cluster.current.getClusterExpansionZoom(feature.properties.cluster_id),
            MAP_CONFIG.maxZoom
          );
          map.current.flyTo({
            center: coordinates,
            zoom: expansionZoom
          });
        });
        
      } else {
        // Render individual receipt marker
        const receipt = feature.properties.receipt;
        const amount = parseFloat(receipt.total) || 0;
        const isNegative = amount < 0;
        
        console.log(`[ReceiptMap] Creating receipt marker for:`, {
          merchant: receipt.merchant,
          amount: receipt.total,
          coordinates: coordinates
        });
        
        el.className = 'receipt-marker';
        el.style.cssText = `
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${isNegative ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'};
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        `;
        
        // Add tooltip with merchant name
        el.title = `${receipt.merchant} - ${formatCurrency(parseFloat(receipt.total) || 0, receipt.currency || 'EUR')}`;
        
        // Add receipt icon - using 📍 for better location visibility
        const icon = document.createElement('div');
        icon.innerHTML = '📍';
        icon.style.fontSize = '20px';
        icon.style.lineHeight = '1';
        el.appendChild(icon);
        
        // Add hover effects
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)';
          el.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
          el.style.zIndex = '1000';
        });
        
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          el.style.zIndex = 'auto';
        });
        
        // Handle receipt click
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedReceipt(receipt);
          if (onReceiptClick) {
            onReceiptClick(receipt);
          }
        });
      }
      
             // Add marker to map
       try {
         console.log(`[ReceiptMap] Adding marker to map at coordinates:`, coordinates);
         
         if (!map.current) {
           console.warn('[ReceiptMap] Map not available for marker');
           return;
         }
         
         const marker = new maplibregl.Marker(el)
           .setLngLat(coordinates)
           .addTo(map.current);
         markers.current.set(feature.properties.id || feature.properties.cluster_id, marker);
         console.log(`[ReceiptMap] Marker added successfully`);
       } catch (error) {
         console.error('[ReceiptMap] Error adding marker:', error);
       }
    });
  }, [isMapLoaded, onReceiptClick]);

  // Auto-fit map to data
  const fitMapToData = useCallback(() => {
    if (!map.current || locatedReceipts.length === 0) return;
    
    const bounds = new maplibregl.LngLatBounds();
    locatedReceipts.forEach(receipt => {
      bounds.extend([receipt.location.longitude, receipt.location.latitude]);
    });
    
    map.current.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15
    });
  }, [locatedReceipts]);

  // Handle map style change
  const handleStyleChange = (newStyle) => {
    setMapStyle(newStyle);
  };

  // Calculate map statistics
  const mapStats = useMemo(() => {
    if (locatedReceipts.length === 0) return null;
    
    const totalAmount = locatedReceipts.reduce((sum, receipt) => {
      return sum + (parseFloat(receipt.total) || 0);
    }, 0);
    
    const uniqueMerchants = new Set(locatedReceipts.map(r => r.merchant)).size;
    
    // Better country detection - look at multiple sources
    const countries = new Set();
    locatedReceipts.forEach(receipt => {
      // Try multiple sources for country information
      if (receipt.addressParsed?.country_code) {
        countries.add(receipt.addressParsed.country_code);
      } else if (receipt.addressParsed?.country) {
        countries.add(receipt.addressParsed.country);
      } else if (receipt.place?.display_name) {
        // Extract country from display name (usually last part)
        const parts = receipt.place.display_name.split(', ');
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          if (lastPart && lastPart.length > 2) { // Avoid very short strings
            countries.add(lastPart);
          }
        }
      } else if (receipt.addressRaw) {
        // Try to extract country from raw address
        const addressParts = receipt.addressRaw.split(', ');
        if (addressParts.length > 0) {
          const lastPart = addressParts[addressParts.length - 1];
          if (lastPart && lastPart.length > 2) {
            countries.add(lastPart);
          }
        }
      }
    });
    
    console.log('[ReceiptMap] Country detection:', {
      receipts: locatedReceipts.map(r => ({
        id: r.id,
        merchant: r.merchant,
        addressParsed: r.addressParsed,
        place: r.place?.display_name,
        addressRaw: r.addressRaw
      })),
      detectedCountries: Array.from(countries)
    });
    
    return {
      totalReceipts: locatedReceipts.length,
      totalAmount,
      uniqueMerchants,
      countries: countries.size
    };
  }, [locatedReceipts]);

  // Format receipt info for display
  const formatReceiptInfo = (receipt) => {
    if (!receipt) return null;
    
    const amount = parseFloat(receipt.total) || 0;
    const formattedAmount = formatCurrency(amount, receipt.currency || settings?.baseCurrency || 'EUR');
    const date = receipt.transactionDate?.toDate?.() || new Date(receipt.date);
    const formattedDate = date.toLocaleDateString();
    
    return {
      merchant: receipt.merchant,
      amount: formattedAmount,
      date: formattedDate,
      category: receipt.category || 'Uncategorized',
      address: receipt.place?.display_name || receipt.addressRaw || 'Address not available',
      geocodeStatus: receipt.geocodeStatus || 'unknown'
    };
  };

  const receiptInfo = formatReceiptInfo(selectedReceipt);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-xl overflow-hidden shadow-lg"
        style={{ minHeight: '400px' }}
      />
      
             {/* Map Controls */}
       <div className="absolute top-2 md:top-4 left-2 md:left-4 flex flex-col gap-2">
                  <Button
            onClick={fitMapToData}
            size="sm"
            variant="secondary"
            className="bg-white/90 hover:bg-white shadow-lg text-xs md:text-sm"
            disabled={locatedReceipts.length === 0}
          >
            <Navigation className="h-3 w-3 md:h-4 md:w-4 mr-1" />
            <span className="hidden sm:inline">Fit Data</span>
            <span className="sm:hidden">Fit</span>
          </Button>
          
          <Button
            onClick={() => {
              console.log('[ReceiptMap] Force refresh markers');
              if (cluster.current && clusterData.length > 0) {
                cluster.current.load(clusterData);
                updateMapMarkers();
              }
            }}
            size="sm"
            variant="secondary"
            className="bg-white/90 hover:bg-white shadow-lg text-xs md:text-sm"
            disabled={!cluster.current || clusterData.length === 0}
          >
            <MapIcon className="h-3 w-3 md:h-4 md:w-4 mr-1" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">↻</span>
          </Button>
          
         <div className="flex gap-1">
           <Button
             onClick={() => map.current?.zoomIn()}
             size="sm"
             variant="secondary"
             className="bg-white/90 hover:bg-white shadow-lg"
           >
             <ZoomIn className="h-3 w-3 md:h-4 md:w-4" />
           </Button>
           <Button
             onClick={() => map.current?.zoomOut()}
             size="sm"
             variant="secondary"
             className="bg-white/90 hover:bg-white shadow-lg"
           >
             <ZoomOut className="h-3 w-3 md:h-4 md:w-4" />
           </Button>
         </div>
       </div>
      
             {/* Style Selector */}
       <div className="absolute top-2 md:top-4 right-2 md:right-4">
         <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-lg">
           {Object.entries(mapStyles).map(([styleName, styleUrl]) => (
             <Button
               key={styleName}
               onClick={() => handleStyleChange(styleName)}
               size="sm"
               variant={mapStyle === styleName ? "default" : "ghost"}
               className="text-xs capitalize"
             >
               <span className="hidden sm:inline">{styleName}</span>
               <span className="sm:hidden">{styleName.charAt(0).toUpperCase()}</span>
             </Button>
           ))}
         </div>
       </div>
      
                           {/* Map Statistics */}
         {mapStats && (
           <div className="absolute bottom-4 left-2 md:left-4 z-10">
             <Card className="bg-white/95 shadow-lg max-w-[180px] md:max-w-[200px]">
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm flex items-center gap-2">
                   <MapIcon className="h-4 w-4" />
                   Spending Map
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-0">
                 <div className="grid grid-cols-2 gap-2 text-xs">
                   <div>
                     <span className="text-gray-600">Receipts:</span>
                     <span className="font-semibold ml-1">{mapStats.totalReceipts}</span>
                   </div>
                   <div>
                     <span className="text-gray-600">Total:</span>
                     <span className="font-semibold ml-1">
                       {formatCurrency(mapStats.totalAmount, settings?.baseCurrency || 'EUR')}
                     </span>
                   </div>
                   <div>
                     <span className="text-gray-600">Merchants:</span>
                     <span className="font-semibold ml-1">{mapStats.uniqueMerchants}</span>
                   </div>
                   <div>
                     <span className="text-gray-600">Countries:</span>
                     <span className="font-semibold ml-1">{mapStats.countries}</span>
                   </div>
                 </div>
                 {/* Debug info */}
                 <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                   <div>Markers: {markers.current.size}</div>
                   <div>Clusters: {cluster.current ? 'Ready' : 'Not ready'}</div>
                 </div>
               </CardContent>
             </Card>
           </div>
         )}
      
                           {/* Map Legend */}
        <div className="absolute bottom-4 right-2 md:right-4 z-10">
          <Card className="bg-white/95 shadow-lg max-w-[160px] md:max-w-[180px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                  <span className="text-gray-600">📍 Income/Positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                  <span className="text-gray-600">📍 Expense/Negative</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-sm text-white text-xs font-bold flex items-center justify-center">2</div>
                  <span className="text-gray-600">Cluster (2+ receipts)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      
      {/* Selected Receipt Info */}
      {selectedReceipt && receiptInfo && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <Card className="bg-white/95 shadow-lg max-w-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="truncate">{receiptInfo.merchant}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedReceipt(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">{receiptInfo.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>{receiptInfo.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span>{receiptInfo.category}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-600">Location:</span>
                  <span className="text-right text-xs max-w-[200px] truncate">
                    {receiptInfo.address}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Accuracy:</span>
                  <span className={`text-xs px-1 rounded ${
                    receiptInfo.geocodeStatus === 'ok' ? 'bg-green-100 text-green-800' :
                    receiptInfo.geocodeStatus === 'approx' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {receiptInfo.geocodeStatus}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
             {/* No Data Message */}
       {locatedReceipts.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center">
           <Card className="bg-white/95 shadow-lg">
             <CardContent className="p-6 text-center">
               <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
               <h3 className="text-lg font-semibold text-gray-700 mb-2">No Location Data</h3>
               <p className="text-sm text-gray-600">
                 Your receipts don't have location information yet. 
                 <br />
                 Scan receipts to automatically add locations!
               </p>
               {/* Debug info */}
               <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
                 <div>Total receipts: {receipts.length}</div>
                 <div>With location: {locatedReceipts.length}</div>
                 <div>Map loaded: {isMapLoaded ? 'Yes' : 'No'}</div>
                 <div>Cluster ready: {cluster.current ? 'Yes' : 'No'}</div>
               </div>
             </CardContent>
           </Card>
         </div>
       )}
      
      {/* Loading State */}
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
