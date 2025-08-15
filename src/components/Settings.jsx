import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from "./ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { SUPPORTED_CURRENCIES } from '../utils/currencyUtils';
import { loadSettings, saveSettings, updateSettings, formatAmount } from '../utils/settingsUtils';
import { ChevronDown } from 'lucide-react';
import { useAuth } from "../contexts/AuthContext";
import { updateProfile } from 'firebase/auth';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Upload, X } from 'lucide-react';
import { Select as PresetSelect, SelectContent as PresetContent, SelectItem as PresetItem, SelectTrigger as PresetTrigger, SelectValue as PresetValue } from './ui/select';

function ExportSection() {
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0,7));
  const [customRange, setCustomRange] = React.useState({ start: '', end: '' });
  const [format, setFormat] = React.useState('moneyS4_csv');
  const [loading, setLoading] = React.useState(false);
  const quickMonths = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return { key: d.toISOString().slice(0,7), label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) };
    });
  }, []);
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const isRange = customRange.start && customRange.end;
      const monthKey = month;
      if (format === 'moneyS4_csv' || format === 'raw_csv') {
        const { generateMoneyS4CSV } = await import('@/data/exporters/moneyS4');
        const { fetchMonthReceipts, fetchRangeReceipts } = await import('@/data/exporters/utils');
        const list = isRange ? await fetchRangeReceipts(customRange.start, customRange.end) : await fetchMonthReceipts(monthKey);
        const csv = generateMoneyS4CSV(list);
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const label = isRange ? `${customRange.start}_to_${customRange.end}` : monthKey;
        a.download = `${format === 'moneyS4_csv' ? 'ReceipTrack_MoneyS4_Receipts' : 'ReceipTrack_Raw_Receipts'}_${label}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'moneyS4_xlsx') {
        const { generateXLSX } = await import('@/data/exporters/xlsx');
        const { fetchMonthReceipts, fetchRangeReceipts } = await import('@/data/exporters/utils');
        const list = isRange ? await fetchRangeReceipts(customRange.start, customRange.end) : await fetchMonthReceipts(monthKey);
        const label = isRange ? `${customRange.start}_to_${customRange.end}` : monthKey;
        await generateXLSX(list, `ReceipTrack_MoneyS4_Receipts_${label}.xlsx`);
        const { metrics } = await import('@/lib/analytics');
        metrics.recordExportUse('moneyS4_xlsx');
      } else if (format === 'accountant_pdf') {
        const { generatePDFPack } = await import('@/data/exporters/pdfPack');
        const { fetchMonthReceipts, fetchRangeReceipts } = await import('@/data/exporters/utils');
        const list = isRange ? await fetchRangeReceipts(customRange.start, customRange.end) : await fetchMonthReceipts(monthKey);
        const label = isRange ? `${customRange.start}_to_${customRange.end}` : monthKey;
        await generatePDFPack(list, `ReceipTrack_Accountant_Pack_${label}.pdf`);
        const { metrics } = await import('@/lib/analytics');
        metrics.recordExportUse('accountant_pdf');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {quickMonths.map(m => (
          <Button key={m.key} variant={m.key === month ? 'default' : 'outline'} onClick={() => setMonth(m.key)} className={m.key === month ? '' : 'bg-transparent border-blue-700 text-blue-200 hover:bg-blue-900/40'}>
            {m.label}
          </Button>
        ))}
        <div className="ml-auto">
          <PresetSelect value={format} onValueChange={setFormat}>
            <PresetTrigger className="w-56 bg-slate-900 border-blue-700 text-blue-100">
              <PresetValue placeholder="Select preset" />
            </PresetTrigger>
            <PresetContent position="popper" className="bg-slate-900 text-white border-blue-700 max-h-64 overflow-auto">
              <PresetItem value="moneyS4_csv">Money S4 (CSV)</PresetItem>
              <PresetItem value="moneyS4_xlsx">Money S4 (XLSX)</PresetItem>
              <PresetItem value="accountant_pdf">Accountant PDF pack</PresetItem>
              <PresetItem value="raw_csv">Raw CSV</PresetItem>
            </PresetContent>
          </PresetSelect>
        </div>
      </div>
      {/* Custom range picker */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Label className="text-blue-200/80">From</Label>
          <input type="month" className="bg-slate-900 border border-blue-700/50 rounded-lg px-3 py-2 text-blue-100" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))} />
          <Label className="text-blue-200/80">To</Label>
          <input type="month" className="bg-slate-900 border border-blue-700/50 rounded-lg px-3 py-2 text-blue-100" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))} />
        </div>
        <Button variant="outline" className="bg-transparent border-blue-700 text-blue-200 hover:bg-blue-900/40" onClick={() => setCustomRange({ start: '', end: '' })}>Clear range</Button>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleGenerate} disabled={loading} className="bg-blue-600 hover:bg-blue-500">{loading ? 'Generating…' : 'Generate'}</Button>
      </div>
      {/* Empty state copy when no receipts in the selected range */}
      <div className="text-sm text-blue-300/80 pt-1">
        No exports yet. Pick a month to generate a Money S4 file.
      </div>
    </div>
  );
}

const CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', example: 1234.56 },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', example: 1234.56 },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', example: 1234.56 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', example: 123456 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭', example: 1234.56 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$', flag: '🇨🇦', example: 1234.56 },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$', flag: '🇦🇺', example: 1234.56 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷', example: 1234.56 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', example: 1234.56 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', example: 1234.56 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪', example: 1234.56 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴', example: 1234.56 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰', example: 1234.56 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱', example: 1234.56 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿', example: 1234.56 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺', example: 123456 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', flag: '🇷🇴', example: 1234.56 },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', flag: '🇭🇷', example: 1234.56 },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', flag: '🇧🇬', example: 1234.56 },
  // Add more as needed
];

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'excel', label: 'Excel' }
];

export function Settings({ onClose, onCloseDropdown }) {
  const { user, updateUserProfile } = useAuth();
  const [settings, setSettings] = useState(() => {
    const loaded = loadSettings();
    return {
      ...loaded,
      name: loaded.name || (user && user.displayName) || '',
      email: loaded.email || (user && user.email) || '',
    };
  });
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();
  const [currencySearch, setCurrencySearch] = useState("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cardRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(320);

  useEffect(() => {
    if (showCurrencyDropdown && cardRef.current && triggerRef.current && searchRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const searchRect = searchRef.current.getBoundingClientRect();
      // Calculate available height below the trigger inside the card
      const available = cardRect.height - (triggerRect.top - cardRect.top) - triggerRect.height - searchRect.height - 32; // 32px for padding/margin
      setDropdownMaxHeight(available > 120 ? available : 120); // Minimum height
    }
  }, [showCurrencyDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showCurrencyDropdown) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [showCurrencyDropdown]);

  // Instant validation
  useEffect(() => {
    if (settings.name.trim() === "") {
      setNameError("Name cannot be empty.");
    } else {
      setNameError("");
    }
    if (settings.email.trim() === "") {
      setEmailError("Email cannot be empty.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }, [settings.name, settings.email]);

  const handleChange = (section, key, value) => {
    setSettings(prev => {
      let newSettings;
      if (!section) {
        newSettings = { ...prev, [key]: value };
      } else {
        newSettings = {
          ...prev,
          [section]: {
            ...prev[section],
            [key]: value
          }
        };
      }
      setIsDirty(true);
      return newSettings;
    });
  };

  const handleSave = async () => {
    if (nameError || emailError) return;
    console.log("handleSave called. Current settings:", settings);
    console.log("User display name from auth:", user.displayName);
    console.log("User email from auth:", user.email);

    try {
      // Check for display name change
      if (settings.name !== user.displayName) {
        console.log("Name changed. Updating Firebase Auth profile...");
        await updateProfile(auth.currentUser, { displayName: settings.name });
        console.log("Firebase Auth display name updated.");
      }

      // Check for email change
      if (settings.email !== user.email) {
        console.log("Email changed. Updating Firebase Auth email...");
        await auth.currentUser.updateEmail(settings.email);
        console.log("Firebase Auth email updated.");
        toast({
          title: "Email Updated!",
          description: "Please verify your new email address.",
          variant: "success",
          duration: 5000,
          style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
        });
      }

      // Update Firestore user document with all relevant fields
      console.log("Updating Firestore user document...");
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName: settings.name,
        email: settings.email,
        // Keep existing settings and update new ones
        settings: {
          ...settings,
          updatedAt: serverTimestamp()
        }
      });
      console.log("Firestore user document updated.");

      // Important: Reload user to refresh local state after Firebase Auth updates
      console.log("Reloading Firebase Auth user...");
      await auth.currentUser.reload();
      console.log("Firebase Auth user reloaded.");

      // Update local settings (might be redundant if user.reload() fetches updated settings from Firestore)
      updateSettings(settings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: settings }));
      setIsDirty(false);
      if (onClose) onClose();
      if (onCloseDropdown) onCloseDropdown();
      
      toast({
        title: "Settings saved!",
        description: "Your preferences have been updated successfully.",
        variant: "success",
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
      // Update local user context/profile after saving
      if (updateUserProfile) {
        await updateUserProfile({ displayName: settings.name, email: settings.email, baseCurrency: settings.baseCurrency });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      let errorMessage = "There was a problem saving your preferences. Please try again.";
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Please log in again to update your email or password.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error saving settings",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setSettings(loadSettings());
    setIsDirty(false);
  };

  const selectedCurrency = useMemo(() => {
    return CURRENCIES.find(c => c.code === settings.baseCurrency) || CURRENCIES[0];
  }, [settings.baseCurrency]);

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch) return CURRENCIES;
    const searchLower = currencySearch.toLowerCase();
    return CURRENCIES.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.code.toLowerCase().includes(searchLower)
    );
  }, [currencySearch]);

  const handleAvatarSave = async (photoURL) => {
    try {
      // Update the user profile in AuthContext
      await updateUserProfile({ photoURL });
      
      // Update local settings state
      setSettings(prev => ({...prev, photoURL}));
      
      // Close the modal
      setShowAvatarModal(false);
      
      // Clear search if any
      setCurrencySearch('');
      
      // Show success message
      toast({
        title: "Avatar Updated!",
        description: "Your new avatar has been saved and will appear everywhere in the app.",
        variant: 'success',
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
      
      // Dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { photoURL } }));
      
    } catch (error) {
      console.error('Error saving avatar:', error);
      toast({
        title: "Error updating avatar",
        description: error.message || "Failed to update avatar. Please try again.",
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={"h-full flex flex-col " + (window.innerWidth < 768 ? 'fixed inset-0 z-[99999] bg-slate-900/95 text-white overflow-y-auto' : '')}>
      <div className="sticky top-0 z-10 bg-slate-800/80 backdrop-blur-md rounded-t-2xl border-b border-blue-400/20 flex items-center justify-between px-6 py-4 shadow-lg">
        <h2 className="text-2xl font-bold text-blue-100 tracking-tight">Settings</h2>
        <button onClick={onClose} className="text-blue-300 hover:text-white text-3xl font-bold transition-colors" aria-label="Close">×</button>
      </div>
      <div className={"flex-1 overflow-y-auto " + (window.innerWidth < 768 ? 'p-4 space-y-8' : 'max-h-[70vh] p-6 space-y-8')}>
        {/* Profile Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-100 mb-4 border-b border-blue-800/50 pb-2">Profile</h3>
          <div className="flex items-center gap-4 p-3 bg-slate-800/70 rounded-lg">
            <div className="relative">
              <button
                className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-3xl font-bold text-white shadow-lg border-2 border-slate-700 hover:border-blue-400 transition-all"
                onClick={() => setShowAvatarModal(true)}
              >
                {user?.photoURL ? (
                  user.photoURL.length > 2 ? <img src={user.photoURL} alt="avatar" className="h-full w-full rounded-full object-cover" /> : <span role="img" aria-label="avatar">{user.photoURL}</span>
                ) : <span role="img" aria-label="avatar">🦄</span>}
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 rounded-full flex items-center justify-center transition-opacity">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 10-4-4l-8 8v3z" /></svg>
                </div>
              </button>
            </div>
            <div>
              <div className="font-semibold text-lg text-blue-100">Edit your avatar</div>
              <div className="text-blue-300/70 text-sm">Personalize with an emoji or image.</div>
            </div>
          </div>
          {showAvatarModal && (
            <UnifiedEditAvatarModal
              user={user}
              onClose={() => setShowAvatarModal(false)}
              onSave={handleAvatarSave}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="block text-sm font-medium text-blue-200/80">Name</Label>
              <Input
                id="name"
                type="text"
                value={settings.name}
                onChange={(e) => handleChange('', 'name', e.target.value)}
                placeholder="Enter your name"
                className={`w-full px-4 py-3 rounded-xl shadow-inner text-base placeholder-blue-200/60 outline-none bg-slate-800/90 border ${nameError ? 'border-red-500/60' : 'border-blue-700/40'} focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all`}
              />
              {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="block text-sm font-medium text-blue-200/80">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => handleChange('', 'email', e.target.value)}
                placeholder="Enter your email"
                className={`w-full px-4 py-3 rounded-xl shadow-inner text-base placeholder-blue-200/60 outline-none bg-slate-800/90 border ${emailError ? 'border-red-500/60' : 'border-blue-700/40'} focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all`}
              />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>
          </div>
        </div>

        {/* Currency & Formatting Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-100 mb-4 border-b border-blue-800/50 pb-2">Currency & Formatting</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2" ref={cardRef}>
              <Label className="block text-sm font-medium text-blue-200/80">Base Currency</Label>
              <div className="relative w-full">
                <button type="button" onClick={() => setShowCurrencyDropdown(v => !v)} aria-haspopup="listbox" aria-expanded={showCurrencyDropdown} className="w-full flex items-center justify-between bg-slate-800/90 border border-blue-700/40 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{selectedCurrency.flag}</span>
                    <span>{selectedCurrency.name} ({selectedCurrency.code})</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 text-blue-300 transition-transform duration-200 ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCurrencyDropdown && (
                  <div className="fixed z-[99999] bg-slate-800 border border-blue-700/60 rounded-xl shadow-2xl animate-fade-in-up origin-top" style={{ 
                    top: cardRef.current?.getBoundingClientRect().bottom + 8,
                    left: cardRef.current?.getBoundingClientRect().left,
                    width: cardRef.current?.getBoundingClientRect().width,
                    maxHeight: '70vh'
                  }}>
                    <div className="p-2">
                      <Input ref={searchRef} placeholder="Search currency..." value={currencySearch} onChange={e => setCurrencySearch(e.target.value)} className="w-full px-4 py-2 rounded-lg text-base placeholder-blue-200/60 outline-none bg-slate-900/80 border border-blue-700/40 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all" />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
                      {filteredCurrencies.length === 0 ? <p className="p-4 text-center text-blue-200/60">No results found.</p> : filteredCurrencies.map(c => (
                        <button key={c.code} type="button" onClick={() => { handleChange(null, 'baseCurrency', c.code); setShowCurrencyDropdown(false); setCurrencySearch(''); }} className={`w-full flex items-center justify-between px-4 py-3 text-left ${settings.baseCurrency === c.code ? 'bg-blue-600/40' : ''} hover:bg-blue-600/20 transition-colors`}>
                          <span className="flex items-center gap-3"><span className="text-xl">{c.flag}</span><span className="text-white">{c.name} ({c.code})</span></span>
                          <span className="font-mono text-blue-200/80">{c.symbol}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-200/60 mt-1">Preview: {formatAmount(1234.56, settings.baseCurrency, settings)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFormat" className="block text-sm font-medium text-blue-200/80">Date Format</Label>
              <Select
                value={settings.dateFormat}
                onValueChange={(value) => handleChange('', 'dateFormat', value)}
              >
                <SelectTrigger className="w-full bg-slate-800/90 border border-blue-700/40 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:bg-blue-950/80 transition-all duration-200 ease-in-out rounded-xl shadow-inner px-4 py-3 text-base placeholder-blue-200/60 outline-none">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent className="bg-blue-950 text-white border-blue-700/40 shadow-xl rounded-xl animate-fade-in-up max-h-60 overflow-y-auto">
                  {DATE_FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value} className="text-white bg-blue-950 hover:bg-blue-800 focus:bg-blue-800 data-[state=checked]:bg-blue-900 data-[state=checked]:text-blue-200 transition-colors duration-150 rounded-lg px-4 py-3 cursor-pointer text-base">{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-blue-200/60 mt-1">
                Preview: {new Date().toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: settings.dateFormat.includes('MM') ? '2-digit' : 'long',
                  day: '2-digit'
                }).replace(settings.dateFormat.includes('DD/MM') ? /(\d+)\/(\d+)\/(\d+)/ : '$2/$1/$3', '$1/$2/$3')}
              </p>
            </div>
          </div>
        </div>

        {/* Display Preferences Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-100 mb-4 border-b border-blue-800/50 pb-2">Display Preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-800/70 rounded-lg">
              <Label htmlFor="showOriginal" className="font-medium text-blue-200 cursor-pointer">Show original amounts in different currency</Label>
              <Switch id="showOriginal" checked={settings.display?.showOriginalAmounts ?? false} onCheckedChange={(checked) => handleChange('display', 'showOriginalAmounts', checked)} />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/70 rounded-lg">
              <Label htmlFor="showConverted" className="font-medium text-blue-200 cursor-pointer">Show converted amounts in base currency</Label>
              <Switch id="showConverted" checked={settings.display?.showConvertedAmounts ?? false} onCheckedChange={(checked) => handleChange('display', 'showConvertedAmounts', checked)} />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/70 rounded-lg">
              <Label htmlFor="weekStartsOn" className="font-medium text-blue-200 cursor-pointer">Week starts on</Label>
              <select
                id="weekStartsOn"
                value={settings.weekStartsOn || 'monday'}
                onChange={e => handleChange('', 'weekStartsOn', e.target.value)}
                className="bg-slate-700/80 text-white rounded-lg px-3 py-2 border border-blue-700/40 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>
        </div>
        {/* Budget Settings Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-100 mb-4 border-b border-blue-800/50 pb-2">Budget</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyBudget" className="block text-sm font-medium text-blue-200/80">Monthly Budget</Label>
              <Input
                id="monthlyBudget"
                type="number"
                value={settings.budget?.monthly || ''}
                onChange={(e) => handleChange('budget', 'monthly', parseFloat(e.target.value))}
                min="0"
                step="0.01"
                placeholder={`e.g., ${formatAmount(1000, settings.baseCurrency, settings)}`}
                className="w-full px-4 py-3 rounded-xl shadow-inner text-base placeholder-blue-200/60 outline-none bg-slate-800/90 border border-blue-700/40 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetStartDay" className="block text-sm font-medium text-blue-200/80">Budget Start Day</Label>
              <Input
                id="budgetStartDay"
                type="number"
                value={settings.budget?.startDay || 1}
                onChange={(e) => handleChange('budget', 'startDay', parseInt(e.target.value))}
                min="1"
                max="31"
                className="w-full px-4 py-3 rounded-xl shadow-inner text-base placeholder-blue-200/60 outline-none bg-slate-800/90 border border-blue-700/40 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/70 rounded-lg">
            <Label htmlFor="notifyOnExceed" className="font-medium text-blue-200 cursor-pointer">Notify on Budget Exceed</Label>
            <Switch id="notifyOnExceed" checked={settings.budget?.notifyOnExceed ?? false} onCheckedChange={(checked) => handleChange('budget', 'notifyOnExceed', checked)} />
          </div>
        </div>

        {/* Export Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-100 mb-4 border-b border-blue-800/50 pb-2">Export</h3>
          <ExportSection />
        </div>
      </div>
      <div className="sticky bottom-0 z-10 bg-slate-800/80 backdrop-blur-md rounded-b-2xl border-t border-blue-400/20 flex items-center justify-end px-6 py-4 shadow-lg gap-4">
        {isDirty && (
          <div className="flex-grow flex items-center gap-2 text-yellow-400 text-sm animate-fade-in">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Unsaved Changes
          </div>
        )}
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full sm:w-auto bg-slate-700/90 border-slate-600 hover:bg-slate-700 text-white"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isDirty || !!nameError || !!emailError}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:grayscale transition-all"
        >
          {isDirty ? 'Save Changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}

export function UnifiedEditAvatarModal({ user, onClose, onSave }) {
  const [selectedEmoji, setSelectedEmoji] = React.useState(user?.photoURL && user.photoURL.length === 2 ? user.photoURL : '');
  const [selectedImage, setSelectedImage] = React.useState(user?.photoURL && user.photoURL.length > 2 ? user.photoURL : '');
  const [showCamera, setShowCamera] = React.useState(false);
  const [hasChanged, setHasChanged] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState(user?.photoURL && user.photoURL.length > 2 ? user.photoURL : '');
  const [avatarError, setAvatarError] = React.useState('');
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState(null);
  const [cameraStream, setCameraStream] = React.useState(null);
  const [cameraError, setCameraError] = React.useState('');
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const videoRef = React.useRef();
  const EMOJI_OPTIONS = ["😃", "🦄", "🐱", "🐶", "🦊", "🐼", "🐸", "🐵", "👾", "🤖", "🧑‍💻", "🦸", "🧙", "🧑‍🚀", "🧑‍🎤"];
  const [aspect, setAspect] = React.useState(1);
  const [isSaving, setIsSaving] = React.useState(false);

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSelectedImage(ev.target.result);
        setAvatarPreview(ev.target.result);
        setSelectedEmoji('');
        setHasChanged(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle emoji select
  const handleEmojiClick = (emoji) => {
    setSelectedEmoji(emoji);
    setSelectedImage('');
    setAvatarPreview('');
    setHasChanged(true);
  };

  // Camera logic
  const handleOpenCamera = async () => {
    setCameraError('');
    setShowCamera(true);
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsCameraReady(true);
      }
    } catch (err) {
      setCameraError("Camera access denied or not available.");
    }
  };
  React.useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera, cameraStream]);

  const handleTakePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setSelectedImage(dataUrl);
    setAvatarPreview(dataUrl);
    setShowCamera(false);
    setCameraStream(null);
    setHasChanged(true);
  };

  // Cropper logic
  const onCropComplete = React.useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Get cropped image as blob
  const getCroppedImg = async () => {
    const image = new window.Image();
    image.src = avatarPreview;
    await new Promise(resolve => { image.onload = resolve; });
    const canvas = document.createElement('canvas');
    const { width, height, x, y } = croppedAreaPixels;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg');
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative bg-slate-800/95 text-white rounded-2xl shadow-2xl p-0 w-full max-w-md border border-slate-600 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header from settings */}
        <div className="sticky top-0 z-10 bg-slate-700/80 backdrop-blur-md rounded-t-2xl border-b border-slate-600 flex items-center justify-between px-6 py-4 shadow-sm">
          <h2 className="text-2xl font-bold text-blue-100 tracking-tight">Edit Avatar</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-blue-300 text-2xl font-bold" aria-label="Close">×</button>
        </div>
        <div className="p-6 flex flex-col items-center gap-6">
          {/* Avatar preview */}
          <span className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg border-4 border-slate-600 text-6xl">
            {selectedEmoji ? (
              <span role="img" aria-label="avatar">{selectedEmoji}</span>
            ) : (
              <span role="img" aria-label="avatar">🦄</span>
            )}
          </span>
          {/* Emoji grid */}
          <div className="mb-2 text-blue-200 text-center font-medium animate-fade-in">
            Choose your avatar emoji:
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                className={`text-3xl p-1 rounded-lg transition-all ${selectedEmoji === emoji ? 'bg-blue-600/40 border-2 border-blue-400' : 'hover:bg-slate-700/60'}`}
                onClick={() => { setSelectedEmoji(emoji); onSave(emoji); }}
              >
                {emoji}
              </button>
            ))}
          </div>
          {/*
          // Future: Image upload, camera, cropper
          <div className="flex gap-2 mt-4 w-full justify-center">
            <label className="px-4 py-2 rounded-lg bg-blue-900 text-white font-semibold shadow hover:bg-blue-800 cursor-pointer">
              Upload Image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <Button onClick={handleOpenCamera} className="px-4 py-2 rounded-lg bg-blue-900 text-white font-semibold shadow hover:bg-blue-800">Camera</Button>
          </div>
          {selectedImage && ...cropper/zoom/retake...}
          */}
          <Button className="w-full mt-4 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 font-semibold shadow hover:bg-slate-600" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
} 