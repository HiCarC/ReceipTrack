import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Filter, Calendar, DollarSign, TrendingUp, Globe, Layers, Download, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import ReceiptMap from '@/components/map/ReceiptMap';
import { convertToBaseCurrency, formatCurrency } from '@/utils/currencyUtils';
import { loadSettings } from '@/utils/settingsUtils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const CATEGORIES = [
  'All Categories',
  'Groceries',
  'Dining',
  'Transportation',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
  'Uncategorized'
];

const TIME_PERIODS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Year', value: 'year' },
  { label: 'This Month', value: 'month' },
  { label: 'This Week', value: 'week' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'Last 90 Days', value: '90days' }
];

export default function MapPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [searchMerchant, setSearchMerchant] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Analytics states
  const [mapStats, setMapStats] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
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

  // Load receipts from Firestore
  useEffect(() => {
    const loadReceipts = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const receiptsRef = collection(db, 'users', user.uid, 'receipts');
        const receiptsQuery = query(receiptsRef, orderBy('transactionDate', 'desc'));
        const snapshot = await getDocs(receiptsQuery);
        
        const receiptsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setReceipts(receiptsData);
      } catch (error) {
        console.error('Error loading receipts:', error);
        toast({
          title: "Error Loading Receipts",
          description: "Failed to load your receipt data.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadReceipts();
  }, [user, toast]);

  // Apply filters
  useEffect(() => {
    let filtered = receipts;

    // Filter by category
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(receipt => receipt.category === selectedCategory);
    }

    // Filter by time period
    if (selectedPeriod !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (selectedPeriod) {
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          break;
        case '30days':
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case '90days':
          startDate = new Date(now.setDate(now.getDate() - 90));
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filtered = filtered.filter(receipt => {
          const receiptDate = receipt.transactionDate?.toDate?.() || new Date(receipt.date);
          return receiptDate >= startDate;
        });
      }
    }

    // Filter by amount range
    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        filtered = filtered.filter(receipt => parseFloat(receipt.total) >= min);
      }
    }
    
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) {
        filtered = filtered.filter(receipt => parseFloat(receipt.total) <= max);
      }
    }

    // Filter by merchant search
    if (searchMerchant) {
      const searchLower = searchMerchant.toLowerCase();
      filtered = filtered.filter(receipt => 
        receipt.merchant?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredReceipts(filtered);
  }, [receipts, selectedCategory, selectedPeriod, minAmount, maxAmount, searchMerchant]);

  useEffect(() => {
    let isMounted = true;
    const loadBaseAmounts = async () => {
      if (!filteredReceipts.length) {
        if (isMounted) setBaseAmountById({});
        return;
      }
      const entries = await Promise.all(
        filteredReceipts.map(async (receipt) => {
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
  }, [filteredReceipts, settings?.baseCurrency]);

  const getBaseAmount = (receipt) => {
    if (receipt?.id && baseAmountById[receipt.id] !== undefined) {
      return baseAmountById[receipt.id];
    }
    return Math.abs(parseFloat(receipt?.total) || 0);
  };

  // Calculate map statistics
  useEffect(() => {
    if (filteredReceipts.length === 0) {
      setMapStats(null);
      return;
    }

    const locatedReceipts = filteredReceipts.filter(receipt => 
      receipt.location && 
      receipt.location.latitude && 
      receipt.location.longitude
    );

    if (locatedReceipts.length === 0) {
      setMapStats(null);
      return;
    }

    const totalAmount = locatedReceipts.reduce((sum, receipt) => {
      return sum + getBaseAmount(receipt);
    }, 0);

    const uniqueMerchants = new Set(locatedReceipts.map(r => r.merchant)).size;
    
    // Better country detection - look at multiple sources
    const countries = new Set();
    const cities = new Set();
    
    locatedReceipts.forEach(receipt => {
      // Country detection
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
      
      // City detection
      if (receipt.addressParsed?.city) {
        cities.add(receipt.addressParsed.city);
      } else if (receipt.place?.display_name) {
        // Extract city from display name (usually second to last part)
        const parts = receipt.place.display_name.split(', ');
        if (parts.length > 1) {
          const cityPart = parts[parts.length - 2];
          if (cityPart && cityPart.length > 2) {
            cities.add(cityPart);
          }
        }
      }
    });

    // Calculate average amount
    const averageAmount = totalAmount / locatedReceipts.length;

    // Find top spending locations
    const locationSpending = {};
    locatedReceipts.forEach(receipt => {
      const location = receipt.place?.display_name || receipt.addressParsed?.city || 'Unknown';
      locationSpending[location] = (locationSpending[location] || 0) + getBaseAmount(receipt);
    });

    const topLocations = Object.entries(locationSpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([location, amount]) => ({ location, amount }));

         setMapStats({
       totalReceipts: locatedReceipts.length,
       totalAmount,
       averageAmount,
       uniqueMerchants,
       countries: countries.size,
       cities: cities.size,
       topLocations,
       coveragePercentage: (locatedReceipts.length / filteredReceipts.length) * 100
     });
  }, [filteredReceipts]);

  // Handle receipt click from map
  const handleReceiptClick = (receipt) => {
    setSelectedReceipt(receipt);
  };

  // Export map data
  const handleExportData = () => {
    const data = filteredReceipts.filter(receipt => 
      receipt.location && receipt.location.latitude && receipt.location.longitude
    );
    
    const csvContent = [
      ['Merchant', 'Amount', 'Currency', 'Date', 'Category', 'Latitude', 'Longitude', 'Address'],
      ...data.map(receipt => [
        receipt.merchant || '',
        receipt.total || '',
        receipt.currency || '',
        receipt.transactionDate?.toDate?.()?.toISOString() || receipt.date || '',
        receipt.category || '',
        receipt.location.latitude || '',
        receipt.location.longitude || '',
        receipt.place?.display_name || receipt.addressRaw || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-map-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Your map data has been exported as CSV.",
    });
  };

  // Share map
  const handleShareMap = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My Spending Map',
          text: `Check out my spending map with ${mapStats?.totalReceipts || 0} receipts across ${mapStats?.countries || 0} countries!`,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Map link copied to clipboard!",
        });
      }
    } catch (error) {
      console.error('Error sharing map:', error);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory('All Categories');
    setSelectedPeriod('all');
    setMinAmount('');
    setMaxAmount('');
    setSearchMerchant('');
  };

  const handleCloseMap = () => {
    try {
      document.dispatchEvent(new CustomEvent('requestTabChange', { detail: 'expenses' }));
    } catch (e) {
      console.warn('Failed to dispatch requestTabChange', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4">
        <div className="rounded-[32px] border border-slate-700/50 bg-slate-900/60 shadow-2xl">
          {/* Header */}
          <div className="rounded-t-[32px] bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseMap}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    aria-label="Close map"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <MapPin className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">Spending Map</h1>
                    <p className="text-sm text-blue-200">Visualize your spending patterns across locations</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant="outline"
                    size="sm"
                    className="bg-slate-800/50 border-slate-600 text-white hover:bg-slate-700/50"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                  
                  <Button
                    onClick={handleExportData}
                    variant="outline"
                    size="sm"
                    className="bg-slate-800/50 border-slate-600 text-white hover:bg-slate-700/50"
                    disabled={!mapStats}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  
                  <Button
                    onClick={handleShareMap}
                    variant="outline"
                    size="sm"
                    className="bg-slate-800/50 border-slate-600 text-white hover:bg-slate-700/50"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-slate-800/30 backdrop-blur-sm border-b border-slate-700/30">
              <div className="px-4 sm:px-6 lg:px-8 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Category Filter */}
                  <div>
                    <Label htmlFor="category" className="text-sm text-blue-200">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {CATEGORIES.map(category => (
                          <SelectItem key={category} value={category} className="text-white">
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Period Filter */}
                  <div>
                    <Label htmlFor="period" className="text-sm text-blue-200">Time Period</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {TIME_PERIODS.map(period => (
                          <SelectItem key={period.value} value={period.value} className="text-white">
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <Label htmlFor="minAmount" className="text-sm text-blue-200">Min Amount</Label>
                    <Input
                      id="minAmount"
                      type="number"
                      placeholder="0.00"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxAmount" className="text-sm text-blue-200">Max Amount</Label>
                    <Input
                      id="maxAmount"
                      type="number"
                      placeholder="1000.00"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>
                </div>

                {/* Merchant Search */}
                <div className="mt-4">
                  <Label htmlFor="merchant" className="text-sm text-blue-200">Search Merchant</Label>
                  <Input
                    id="merchant"
                    type="text"
                    placeholder="Search by merchant name..."
                    value={searchMerchant}
                    onChange={(e) => setSearchMerchant(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white max-w-md"
                  />
                </div>

                {/* Clear Filters */}
                <div className="mt-4">
                  <Button
                    onClick={clearFilters}
                    variant="ghost"
                    size="sm"
                    className="text-blue-300 hover:text-blue-200"
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="px-4 sm:px-6 lg:px-8 py-6 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Map */}
              <div className="lg:col-span-3">
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30">
                  <ReceiptMap
                    receipts={filteredReceipts}
                    onReceiptClick={handleReceiptClick}
                    getBaseAmount={getBaseAmount}
                    showMobilePanel={false}
                    className="h-[600px] lg:h-[700px]"
                  />
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Statistics */}
                {mapStats && (
                  <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                        Map Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/30">
                          <div className="text-blue-300 text-xs">Receipts</div>
                          <div className="text-xl font-bold text-white">{mapStats.totalReceipts}</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/30">
                          <div className="text-blue-300 text-xs">Total Spent</div>
                          <div className="text-xl font-bold text-white">
                            {formatCurrency(mapStats.totalAmount, settings?.baseCurrency || 'EUR')}
                          </div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/30">
                          <div className="text-blue-300 text-xs">Countries</div>
                          <div className="text-xl font-bold text-white">{mapStats.countries}</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/30">
                          <div className="text-blue-300 text-xs">Cities</div>
                          <div className="text-xl font-bold text-white">{mapStats.cities}</div>
                        </div>
                      </div>

                      <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/30">
                        <div className="text-blue-300 text-xs mb-2">Coverage</div>
                        <div className="text-lg font-bold text-white">{mapStats.coveragePercentage.toFixed(1)}%</div>
                        <div className="text-xs text-blue-200">
                          {mapStats.totalReceipts} of {filteredReceipts.length} receipts have locations
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

            {/* Top Spending Locations */}
            {mapStats?.topLocations && mapStats.topLocations.length > 0 && (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-white">
                    <Globe className="h-5 w-5 text-blue-400" />
                    Top Locations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mapStats.topLocations.map((location, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate text-white">{location.location}</div>
                          <div className="text-xs text-blue-300">
                            {formatCurrency(location.amount, settings?.baseCurrency || 'EUR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Receipt Details */}
            {selectedReceipt && (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-white">
                    <MapPin className="h-5 w-5 text-blue-400" />
                    Receipt Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                    <div className="text-sm text-blue-300">Merchant</div>
                    <div className="font-medium text-white">{selectedReceipt.merchant}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                    <div className="text-sm text-blue-300">Amount</div>
                    <div className="font-medium text-white">
                      {formatCurrency(getBaseAmount(selectedReceipt), settings?.baseCurrency || 'EUR')}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                    <div className="text-sm text-blue-300">Date</div>
                    <div className="font-medium text-white">
                      {selectedReceipt.transactionDate?.toDate?.()?.toLocaleDateString() || selectedReceipt.date}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                    <div className="text-sm text-blue-300">Category</div>
                    <div className="font-medium text-white">{selectedReceipt.category || 'Uncategorized'}</div>
                  </div>
                  {selectedReceipt.place?.display_name && (
                    <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                      <div className="text-sm text-blue-300">Location</div>
                      <div className="font-medium text-sm text-white">{selectedReceipt.place.display_name}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
  );
}
