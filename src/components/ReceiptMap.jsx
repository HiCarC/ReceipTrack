import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { MapPin, Map as MapIcon, ZoomIn, ZoomOut, Navigation, Info } from 'lucide-react';
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
  minZoom: 1,
};

// Cluster configuration
const CLUSTER_CONFIG = {
  radius: 40,
  maxZoom: 16,
  minPoints: 2,
};

// Custom map styles
const mapStyles = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

export default function ReceiptMap({ receipts = [], className = '', onReceiptClick }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const cluster = useRef(null);
  const markers = useRef(new Map());
  const { toast } = useToast();

  const [mapStyle, setMapStyle] = useState('positron');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [settings, setSettings] = useState(null);

  // --- Mobile UX state ---
  const [isMobile, setIsMobile] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false); // opens ONLY via Info button
  const [panelTab, setPanelTab] = useState('stats'); // 'stats' | 'legend'

  // Watch screen size for mobile layout
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Load settings
  useEffect(() => {
    try {
      const appSettings = loadSettings();
      setSettings(appSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings({ baseCurrency: 'EUR' });
    }
  }, []);

  // Filter receipts with location data
  const locatedReceipts = useMemo(() => {
    const filtered = receipts.filter(
      (receipt) =>
        receipt &&
        receipt.location &&
        typeof receipt.location.latitude === 'number' &&
        typeof receipt.location.longitude === 'number' &&
        !isNaN(receipt.location.latitude) &&
        !isNaN(receipt.location.longitude)
    );

    console.log('[ReceiptMap] Filtered receipts:', {
      total: receipts.length,
      withLocation: filtered.length,
      locations: filtered.map((r) => ({
        id: r.id,
        lat: r.location.latitude,
        lng: r.location.longitude,
        merchant: r.merchant,
      })),
    });

    return filtered;
  }, [receipts]);

  // Count receipts by exact coordinate (rounded to avoid float jitter)
  const coordCounts = useMemo(() => {
    const m = new Map();
    for (const r of locatedReceipts) {
      const key = `${r.location.longitude.toFixed(6)},${r.location.latitude.toFixed(6)}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [locatedReceipts]);

  // Prepare data for clustering
  const clusterData = useMemo(() => {
    return locatedReceipts.map((receipt) => ({
      type: 'Feature',
      properties: {
        id: receipt.id,
        receipt: receipt,
        cluster: false,
      },
      geometry: {
        type: 'Point',
        coordinates: [receipt.location.longitude, receipt.location.latitude],
      },
    }));
  }, [locatedReceipts]);

  // Define updateMapMarkers BEFORE effects
  const updateMapMarkers = useCallback(() => {
    if (!map.current || !cluster.current || !isMapLoaded) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    const b = map.current.getBounds(); // LngLatBounds
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const zoom = Math.max(0, Math.floor(map.current.getZoom()));

    // Get clusters and points for current view
    const clusters = cluster.current.getClusters(bbox, zoom);
    console.log('[ReceiptMap] Found', clusters.length, 'clusters/points');

    // Deduplicate exact same coords at this zoom
    const seen = new Set();

    clusters.forEach((feature) => {
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
        el.title = `${pointCount} receipts in this area - click to zoom in`;
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.1)';
          el.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        el.addEventListener('click', () => {
          const expansionZoom = Math.min(
            cluster.current.getClusterExpansionZoom(feature.properties.cluster_id),
            MAP_CONFIG.maxZoom
          );
          map.current.flyTo({ center: coordinates, zoom: expansionZoom });
        });
      } else {
        // Individual receipt marker (one per exact coordinate)
        const [lng, lat] = coordinates;
        const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
        if (seen.has(key)) return;
        seen.add(key);

        const receipt = feature.properties.receipt;
        const amount = parseFloat(receipt.total) || 0;
        const isNegative = amount < 0; // refunds/income vs expenses
        const countHere = coordCounts.get(key) || 1;

        el.className = 'receipt-marker';
        el.style.cssText = `
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${isNegative
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #10b981, #059669)'};
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        `;

        // SVG pin. Show a large inner white circle + count only when > 1
        const centerInner = countHere > 1
          ? `<circle cx="12" cy="9" r="7" fill="white"></circle>
             <text x="12" y="9" dominant-baseline="middle" text-anchor="middle" font-size="9" font-weight="700" fill="#111827">${countHere}</text>`
          : `<circle cx="12" cy="9" r="2"></circle>`;

        const icon = document.createElement('div');
        icon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
               viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 21s-6-7.05-6-12a6 6 0 1 1 12 0c0 4.95-6 12-6 12z"></path>
            ${centerInner}
          </svg>`;
        icon.style.display = 'grid';
        icon.style.placeItems = 'center';
        el.appendChild(icon);

        el.title = countHere > 1
          ? `${receipt.merchant} · ${countHere} receipts here`
          : `${receipt.merchant} - ${formatCurrency(parseFloat(receipt.total) || 0, receipt.currency || 'EUR')}`;

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

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedReceipt(receipt);
          if (onReceiptClick) onReceiptClick(receipt);
        });
      }

      try {
        const marker = new maplibregl.Marker(el).setLngLat(coordinates).addTo(map.current);
        markers.current.set(feature.properties.id || feature.properties.cluster_id, marker);
      } catch (error) {
        console.error('[ReceiptMap] Error adding marker:', error);
      }
    });
  }, [isMapLoaded, onReceiptClick, coordCounts]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('[ReceiptMap] Initializing map with', locatedReceipts.length, 'receipts');

    let mapInstance = null;

    try {
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
        customAttribution: '© OpenStreetMap contributors, © CARTO',
      });

      map.current = mapInstance;
      console.log('[ReceiptMap] Map instance created successfully');
    } catch (error) {
      console.error('[ReceiptMap] Error creating map:', error);
      return;
    }

    // Add navigation & fullscreen controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Handle map load
    map.current.on('load', () => {
      setIsMapLoaded(true);
      console.log('[ReceiptMap] Map loaded, initializing clustering');

      cluster.current = new Supercluster({
        radius: CLUSTER_CONFIG.radius,
        maxZoom: CLUSTER_CONFIG.maxZoom,
        minPoints: CLUSTER_CONFIG.minPoints,
      });

      setTimeout(() => {
        if (clusterData.length > 0) {
          console.log('[ReceiptMap] Loading cluster data:', clusterData.length, 'points');
          cluster.current.load(clusterData);
          updateMapMarkers();
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
          const events = ['load', 'moveend', 'styledata', 'error', 'data', 'render'];
          events.forEach((event) => {
            try { map.current.off(event); } catch (e) {}
          });
          try { if (map.current.getContainer()) { map.current.remove(); } } catch (error) {
            console.warn('[ReceiptMap] Error during map removal:', error);
          }
        } catch (error) {
          console.warn('[ReceiptMap] Error during map cleanup:', error);
        }
        map.current = null;
      }
    };
  }, [mapStyle, clusterData.length, updateMapMarkers]);

  // Update map style
  useEffect(() => {
    if (map.current && isMapLoaded) {
      try {
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
  }, [clusterData, isMapLoaded, updateMapMarkers]);

  // Close mobile info panel when user interacts with the map — prevents accidental opens on scroll
  useEffect(() => {
    if (!map.current) return;
    const close = () => setPanelOpen(false);
    if (isMobile) {
      map.current.on('click', close);
      map.current.on('dragstart', close);
      map.current.on('zoomstart', close);
      // DO NOT open the panel on any scroll/drag; it only opens via Info button
    }
    return () => {
      if (!map.current) return;
      map.current.off('click', close);
      map.current.off('dragstart', close);
      map.current.off('zoomstart', close);
    };
  }, [isMobile]);

  // Auto-fit map to data
  const fitMapToData = useCallback(() => {
    if (!map.current || locatedReceipts.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    locatedReceipts.forEach((receipt) => bounds.extend([receipt.location.longitude, receipt.location.latitude]));
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
  }, [locatedReceipts]);

  const handleStyleChange = (newStyle) => setMapStyle(newStyle);

  // Calculate map statistics
  const mapStats = useMemo(() => {
    if (locatedReceipts.length === 0) return null;
    const totalAmount = locatedReceipts.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const uniqueMerchants = new Set(locatedReceipts.map((r) => r.merchant)).size;
    const countries = new Set();
    locatedReceipts.forEach((r) => {
      if (r.addressParsed?.country_code) countries.add(r.addressParsed.country_code);
      else if (r.addressParsed?.country) countries.add(r.addressParsed.country);
      else if (r.place?.display_name) {
        const parts = r.place.display_name.split(', ');
        const last = parts[parts.length - 1];
        if (last && last.length > 2) countries.add(last);
      } else if (r.addressRaw) {
        const parts = r.addressRaw.split(', ');
        const last = parts[parts.length - 1];
        if (last && last.length > 2) countries.add(last);
      }
    });
    console.log('[ReceiptMap] Country detection:', { detectedCountries: Array.from(countries) });
    return { totalReceipts: locatedReceipts.length, totalAmount, uniqueMerchants, countries: countries.size };
  }, [locatedReceipts]);

  // Format selected receipt info
  const formatReceiptInfo = (receipt) => {
    if (!receipt) return null;
    const amount = parseFloat(receipt.total) || 0;
    const formattedAmount = formatCurrency(amount, receipt.currency || settings?.baseCurrency || 'EUR');
    const date = receipt.transactionDate?.toDate?.() || new Date(receipt.date);
    return {
      merchant: receipt.merchant,
      amount: formattedAmount,
      date: date.toLocaleDateString(),
      category: receipt.category || 'Uncategorized',
      address: receipt.place?.display_name || receipt.addressRaw || 'Address not available',
      geocodeStatus: receipt.geocodeStatus || 'unknown',
    };
  };

  const receiptInfo = formatReceiptInfo(selectedReceipt);

  // --- Render ---
  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden shadow-lg" style={{ minHeight: '400px' }} />

      {/* Map Controls */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 flex flex-col gap-2 z-10 pointer-events-auto">
        <Button onClick={fitMapToData} size="sm" variant="secondary" className="bg-white/90 hover:bg-white shadow-lg text-xs md:text-sm" disabled={locatedReceipts.length === 0}>
          <Navigation className="h-3 w-3 md:h-4 md:w-4 mr-1" />
          <span className="hidden sm:inline">Fit Data</span>
          <span className="sm:hidden">Fit</span>
        </Button>
        <Button onClick={() => { if (cluster.current && clusterData.length > 0) { cluster.current.load(clusterData); updateMapMarkers(); } }} size="sm" variant="secondary" className="bg-white/90 hover:bg-white shadow-lg text-xs md:text-sm" disabled={!cluster.current || clusterData.length === 0}>
          <MapIcon className="h-3 w-3 md:h-4 md:w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
          <span className="sm:hidden">↻</span>
        </Button>
        <div className="flex gap-1">
          <Button onClick={() => map.current?.zoomIn()} size="sm" variant="secondary" className="bg-white/90 hover:bg-white shadow-lg"><ZoomIn className="h-3 w-3 md:h-4 md:w-4" /></Button>
          <Button onClick={() => map.current?.zoomOut()} size="sm" variant="secondary" className="bg-white/90 hover:bg-white shadow-lg"><ZoomOut className="h-3 w-3 md:h-4 md:w-4" /></Button>
        </div>
        {isMobile && (
          <Button onClick={() => setPanelOpen(v => !v)} size="sm" variant="secondary" className="bg-white/90 hover:bg-white shadow-lg"><Info className="h-3 w-3 md:h-4 md:w-4" /></Button>
        )}
      </div>

      {/* Style Selector */}
      <div className="absolute top-2 md:top-4 right-2 md:right-4 z-10 pointer-events-auto">
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-lg">
          {Object.entries(mapStyles).map(([styleName]) => (
            <Button key={styleName} onClick={() => handleStyleChange(styleName)} size="sm" variant={mapStyle === styleName ? 'default' : 'ghost'} className="text-xs capitalize">
              <span className="hidden sm:inline">{styleName}</span>
              <span className="sm:hidden">{styleName.charAt(0).toUpperCase()}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop: Stats + Legend cards */}
      {!isMobile && (
        <>
          {mapStats && (
            <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
              <Card className="bg-white/95 shadow-lg max-w-[220px]">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapIcon className="h-4 w-4" />Spending Map</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-600">Receipts:</span><span className="font-semibold ml-1 text-gray-900 dark:text-white">{mapStats.totalReceipts}</span></div>
                    <div><span className="text-gray-600">Total:</span><span className="font-semibold ml-1 text-gray-900 dark:text-white">{formatCurrency(mapStats.totalAmount, settings?.baseCurrency || 'EUR')}</span></div>
                    <div><span className="text-gray-600">Merchants:</span><span className="font-semibold ml-1 text-gray-900 dark:text-white">{mapStats.uniqueMerchants}</span></div>
                    <div><span className="text-gray-600">Countries:</span><span className="font-semibold ml-1 text-gray-900 dark:text-white">{mapStats.countries}</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500"><div>Markers: {markers.current.size}</div><div>Clusters: {cluster.current ? 'Ready' : 'Not ready'}</div></div>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
            <Card className="bg-white/95 shadow-lg max-w-[220px]">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Legend</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div><span className="text-gray-600">📍 Income/Positive</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div><span className="text-gray-600">📍 Expense/Negative</span></div>
                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-sm text-white text-xs font-bold flex items-center justify-center">2</div><span className="text-gray-600">Cluster (2+ receipts)</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Mobile: single bottom sheet (opens only via Info button) */}
      {isMobile && (
        <div className="fixed inset-x-2 bottom-2 z-20">
          <div className={`mx-auto max-w-md rounded-2xl bg-white/95 backdrop-blur shadow-xl border border-white/60 transition-transform duration-300 pointer-events-auto ${panelOpen ? 'translate-y-0' : 'translate-y-[calc(100%+0.75rem)]'}`}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button className={`px-3 py-1 rounded-md text-xs transition ${panelTab === 'stats' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`} onClick={() => setPanelTab('stats')}>Spending</button>
                <button className={`px-3 py-1 rounded-md text-xs transition ${panelTab === 'legend' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`} onClick={() => setPanelTab('legend')}>Legend</button>
              </div>
              <button aria-label="Close" className="p-2 rounded-full hover:bg-gray-100 active:scale-95" onClick={() => setPanelOpen(false)}>×</button>
            </div>
            <div className="px-3 pb-3">
              {panelTab === 'stats' ? (
                mapStats ? (
                  <div className="text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-gray-50"><div className="text-gray-600">Receipts</div><div className="font-semibold text-gray-900 dark:text-white">{mapStats.totalReceipts}</div></div>
                      <div className="p-2 rounded-lg bg-gray-50"><div className="text-gray-600">Total</div><div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(mapStats.totalAmount, settings?.baseCurrency || 'EUR')}</div></div>
                      <div className="p-2 rounded-lg bg-gray-50"><div className="text-gray-600">Merchants</div><div className="font-semibold text-gray-900 dark:text-white">{mapStats.uniqueMerchants}</div></div>
                      <div className="p-2 rounded-lg bg-gray-50"><div className="text-gray-600">Countries</div><div className="font-semibold text-gray-900 dark:text-white">{mapStats.countries}</div></div>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500 flex items-center justify-between"><span>Markers: {markers.current.size}</span><span>Clusters: {cluster.current ? 'Ready' : 'Not ready'}</span></div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 p-2">No stats yet.</div>
                )
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div><span className="text-gray-700">📍 Income/Positive</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div><span className="text-gray-700">📍 Expense/Negative</span></div>
                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-sm text-white text-xs font-bold flex items-center justify-center">2</div><span className="text-gray-700">Cluster (2+ receipts)</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Receipt Info */}
      {selectedReceipt && receiptInfo && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto">
          <Card className="bg-white/95 shadow-lg max-w-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between"><span className="truncate">{receiptInfo.merchant}</span><Button size="sm" variant="ghost" onClick={() => setSelectedReceipt(null)} className="h-6 w-6 p-0">×</Button></CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-600">Amount:</span><span className="font-semibold text-gray-900 dark:text-white">{receiptInfo.amount}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Date:</span><span>{receiptInfo.date}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Category:</span><span>{receiptInfo.category}</span></div>
                <div className="flex justify-between items-start"><span className="text-gray-600">Location:</span><span className="text-right text-xs max-w-[200px] truncate">{receiptInfo.address}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Accuracy:</span><span className={`text-xs px-1 rounded ${receiptInfo.geocodeStatus === 'ok' ? 'bg-green-100 text-green-800' : receiptInfo.geocodeStatus === 'approx' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{receiptInfo.geocodeStatus}</span></div>
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
              <p className="text-sm text-gray-600">Your receipts don't have location information yet.<br />Scan receipts to automatically add locations!</p>
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
