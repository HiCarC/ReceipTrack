import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SUPPORTED_CURRENCIES } from '@/utils/currencyUtils';
import { loadSettings, updateSettings, formatAmount } from '@/utils/settingsUtils';
import { Calendar, ChevronRight, DollarSign, HelpCircle, LogOut, MapPin, Moon, Pencil, Shield, Upload, Wallet } from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from 'firebase/auth';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { Select as PresetSelect, SelectContent as PresetContent, SelectItem as PresetItem, SelectTrigger as PresetTrigger, SelectValue as PresetValue } from '@/components/ui/select';

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
          <Button key={m.key} variant={m.key === month ? 'default' : 'outline'} onClick={() => setMonth(m.key)} className={m.key === month ? '' : 'bg-transparent border-app-border text-app-muted hover:bg-white/5'}>
            {m.label}
          </Button>
        ))}
        <div className="ml-auto">
          <PresetSelect value={format} onValueChange={setFormat}>
            <PresetTrigger className="w-56 bg-app-surface2 border-app-border text-white">
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
          <Label className="text-app-muted">From</Label>
          <input type="month" className="bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-white" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))} />
          <Label className="text-app-muted">To</Label>
          <input type="month" className="bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-white" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))} />
        </div>
        <Button variant="outline" className="bg-transparent border-app-border text-app-muted hover:bg-white/5" onClick={() => setCustomRange({ start: '', end: '' })}>Clear range</Button>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleGenerate} disabled={loading} className="bg-app-primary hover:bg-blue-600">{loading ? 'Generating...' : 'Generate'}</Button>
      </div>
      {/* Empty state copy when no receipts in the selected range */}
      <div className="text-sm text-app-muted pt-1">
        No exports yet. Pick a month to generate a Money S4 file.
      </div>
    </div>
  );
}

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }
];

export function Settings({ onClose, onCloseDropdown }) {
  const { user, updateUserProfile, signOutUser } = useAuth();
  const [settings, setSettings] = useState(() => {
    const loaded = loadSettings();
    const savedSettingsRaw = typeof window !== 'undefined' ? window.localStorage.getItem('expenseAppSettings') : null;
    const currentAppearance = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
    let hasAppearance = false;
    if (savedSettingsRaw) {
      try {
        const parsed = JSON.parse(savedSettingsRaw);
        hasAppearance = Object.prototype.hasOwnProperty.call(parsed, 'appearance');
      } catch {
        hasAppearance = false;
      }
    }
    const appearanceLocked = loaded.appearanceLocked === true;
    return {
      ...loaded,
      appearance: appearanceLocked ? loaded.appearance : currentAppearance,
      appearanceLocked,
      name: loaded.name || (user && user.displayName) || '',
      email: loaded.email || (user && user.email) || '',
    };
  });
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();
  const [currencySearch, setCurrencySearch] = useState("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cardRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(320);
  const settingsHydratedRef = useRef(false);
  const settingsSaveTimeout = useRef(null);

  useEffect(() => {
    if (typeof document === 'undefined' || !settings.appearanceLocked) return;
    document.documentElement.classList.toggle('dark', settings.appearance === 'dark');
  }, [settings.appearance, settings.appearanceLocked]);

  useEffect(() => {
    if (showCurrencyDropdown && cardRef.current && triggerRef.current && searchRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const searchRect = searchRef.current.getBoundingClientRect();
      const available = cardRect.height - (triggerRect.top - cardRect.top) - triggerRect.height - searchRect.height - 32;
      setDropdownMaxHeight(available > 120 ? available : 120);
    }
  }, [showCurrencyDropdown]);

  useEffect(() => {
    if (!user?.settings || settingsHydratedRef.current) return;
    const merged = { ...settings, ...user.settings };
    settingsHydratedRef.current = true;
    setSettings(merged);
    updateSettings(merged);
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: merged }));
  }, [user?.settings, settings]);

  useEffect(() => {
    if (!user?.uid || !settingsHydratedRef.current) return;
    if (settingsSaveTimeout.current) {
      clearTimeout(settingsSaveTimeout.current);
    }
    settingsSaveTimeout.current = setTimeout(async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          settings: {
            ...settings,
            updatedAt: serverTimestamp()
          }
        });
      } catch (error) {
        // Avoid blocking UI on background preference saves.
      }
    }, 700);
    return () => {
      if (settingsSaveTimeout.current) {
        clearTimeout(settingsSaveTimeout.current);
      }
    };
  }, [settings, user?.uid]);

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

  useEffect(() => {
    if (settings.name.trim() === "") {
      setNameError("Name cannot be empty.");
    } else {
      setNameError("");
    }
    setEmailError("");
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
      updateSettings(newSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: newSettings }));
      return newSettings;
    });
  };

  const handleLocationInsightsToggle = (checked) => {
    setSettings(prev => {
      const nextSettings = {
        ...prev,
        features: {
          ...prev.features,
          locationInsights: checked
        }
      };
      updateSettings(nextSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: nextSettings }));
      return nextSettings;
    });
    setIsDirty(true);
  };

  const handleBaseCurrencyChange = (code) => {
    setSettings(prev => {
      const nextSettings = { ...prev, baseCurrency: code };
      updateSettings(nextSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: nextSettings }));
      return nextSettings;
    });
    setIsDirty(true);
  };

  const handleAppearanceChange = (checked) => {
    const nextAppearance = checked ? 'dark' : 'light';
    setSettings(prev => {
      const nextSettings = { ...prev, appearance: nextAppearance, appearanceLocked: true };
      updateSettings(nextSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: nextSettings }));
      return nextSettings;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (nameError || emailError) return;
    try {
      if (settings.name !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName: settings.name });
      }

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName: settings.name,
        email: user.email,
        settings: {
          ...settings,
          updatedAt: serverTimestamp()
        }
      });

      await auth.currentUser.reload();

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
      if (updateUserProfile) {
        await updateUserProfile({ displayName: settings.name, baseCurrency: settings.baseCurrency });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
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

  const selectedCurrency = useMemo(() => {
    return SUPPORTED_CURRENCIES.find(c => c.code === settings.baseCurrency) || SUPPORTED_CURRENCIES[0];
  }, [settings.baseCurrency]);

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch) return SUPPORTED_CURRENCIES;
    const searchLower = currencySearch.toLowerCase();
    return SUPPORTED_CURRENCIES.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.code.toLowerCase().includes(searchLower)
    );
  }, [currencySearch]);

  const handleAvatarSave = async (photoURL) => {
    try {
      await updateUserProfile({ photoURL });
      setSettings(prev => ({...prev, photoURL}));
      setShowAvatarModal(false);
      setCurrencySearch('');
      toast({
        title: "Avatar Updated!",
        description: "Your new avatar has been saved and will appear everywhere in the app.",
        variant: 'success',
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { photoURL } }));
    } catch (error) {
      toast({
        title: "Error updating avatar",
        description: error.message || "Failed to update avatar. Please try again.",
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    if (!signOutUser) return;
    try {
      await signOutUser();
    } catch (error) {
      toast({
        title: "Sign out failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const profileName = settings.name || user?.displayName || 'Account';
  const profileEmail = settings.email || user?.email || '';
  const profileInitial = (profileName || profileEmail || 'U').trim().slice(0, 1).toUpperCase();
  const profilePhoto = settings.photoURL || user?.photoURL || '';
  const profilePhotoIsEmoji = profilePhoto && profilePhoto.length === 2;

  return (
    <div className={"min-h-screen flex flex-col bg-app-bg text-app-fg " + (window.innerWidth < 768 ? 'fixed inset-0 z-[99999] overflow-y-auto' : '')}>
      <header className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-md">
        <div className="flex items-center h-12 justify-between px-4 pt-2">
          {onClose ? (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-app-muted hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close settings"
            >
              X
            </button>
          ) : (
            <div className="h-8 w-8" />
          )}
          <div className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold leading-tight px-4 pb-2">Settings</h1>
      </header>
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-md mx-auto">
          <section className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm">
              <div className="shrink-0 relative">
                <div className="bg-app-surface2 rounded-full h-20 w-20 ring-4 ring-app-bg overflow-hidden flex items-center justify-center text-xl font-bold text-white">
                  {profilePhoto ? (
                    profilePhotoIsEmoji ? (
                      <span>{profilePhoto}</span>
                    ) : (
                      <img src={profilePhoto} alt="User avatar" className="h-full w-full rounded-full object-cover" />
                    )
                  ) : (
                    <span>{profileInitial}</span>
                  )}
                </div>
                <button
                  className="absolute bottom-0 right-0 bg-app-primary text-white p-1.5 rounded-full hover:bg-blue-600 transition-colors shadow-lg"
                  onClick={() => setShowAvatarModal(true)}
                  aria-label="Edit avatar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col justify-center items-center sm:items-start text-center sm:text-left flex-1">
                <p className="text-xl font-bold leading-tight">{profileName}</p>
                <p className="text-app-muted text-sm font-medium mt-1">{profileEmail}</p>
                <button
                  className="mt-3 text-app-primary text-sm font-bold hover:underline"
                  onClick={() => setShowProfileEditor(v => !v)}
                >
                  {showProfileEditor ? 'Hide Profile' : 'Edit Profile'}
                </button>
              </div>
            </div>
          </section>
          {showAvatarModal && (
            <UnifiedEditAvatarModal
              user={user}
              onClose={() => setShowAvatarModal(false)}
              onSave={handleAvatarSave}
            />
          )}
          {showProfileEditor && (
            <section className="mx-4 mb-2">
              <div className="bg-app-surface rounded-2xl border border-app-border p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold text-app-muted uppercase tracking-wider">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={settings.name}
                    onChange={(e) => handleChange('', 'name', e.target.value)}
                    placeholder="Enter your name"
                    className={`w-full bg-app-surface2 border ${nameError ? 'border-red-500/60' : 'border-app-border'} text-white rounded-xl px-4 py-3 text-base placeholder:text-app-muted/70`}
                  />
                  {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-app-muted uppercase tracking-wider">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || settings.email}
                    readOnly
                    disabled
                    placeholder="Enter your email"
                    className="w-full bg-app-surface2 border border-app-border text-white rounded-xl px-4 py-3 text-base placeholder:text-app-muted/70 opacity-80 cursor-not-allowed"
                  />
                </div>
              </div>
            </section>
          )}
          <section className="mt-2">
            <h3 className="text-app-muted text-xs font-bold uppercase tracking-wider px-6 pb-2 pt-4">General</h3>
            <div className="flex flex-col bg-app-surface rounded-2xl mx-4 overflow-hidden border border-app-border shadow-sm" ref={cardRef}>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setShowCurrencyDropdown(v => !v)}
                className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Base Currency</p>
                </div>
                <div className="flex items-center gap-2 text-app-muted">
                  <p className="text-sm font-medium">{selectedCurrency.code}</p>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
              {showCurrencyDropdown && (
                <div
                  className="fixed z-[99999] bg-app-surface border border-app-border rounded-xl shadow-2xl"
                  style={{
                    top: triggerRef.current?.getBoundingClientRect().bottom + 8,
                    left: triggerRef.current?.getBoundingClientRect().left,
                    width: triggerRef.current?.getBoundingClientRect().width,
                    maxHeight: dropdownMaxHeight
                  }}
                >
                  <div className="p-2">
                    <Input
                      ref={searchRef}
                      placeholder="Search currency..."
                      value={currencySearch}
                      onChange={e => setCurrencySearch(e.target.value)}
                      className="w-full bg-app-surface2 border border-app-border text-white rounded-lg px-3 py-2 text-sm placeholder:text-app-muted/70"
                    />
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: dropdownMaxHeight - 60 }}>
                    {filteredCurrencies.length === 0 ? (
                      <p className="p-4 text-center text-app-muted text-sm">No results found.</p>
                    ) : filteredCurrencies.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { handleBaseCurrencyChange(c.code); setShowCurrencyDropdown(false); setCurrencySearch(''); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors ${settings.baseCurrency === c.code ? 'bg-app-primary/20' : ''}`}
                      >
                        <span className="text-white">{c.name} ({c.code})</span>
                        <span className="text-app-muted text-sm">{c.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="h-px bg-app-border mx-4"></div>
              <div className="flex items-center gap-4 px-4 py-3.5 justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Date Format</p>
                </div>
                <Select
                  value={settings.dateFormat}
                  onValueChange={(value) => handleChange('', 'dateFormat', value)}
                >
                  <SelectTrigger className="h-auto border-none bg-transparent text-app-muted text-sm font-medium focus:ring-0 focus:ring-offset-0 p-0">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent className="bg-app-surface text-white border-app-border shadow-xl rounded-xl max-h-60 overflow-y-auto">
                    {DATE_FORMATS.map(f => (
                      <SelectItem key={f.value} value={f.value} className="text-white hover:bg-white/5 focus:bg-white/5 rounded-lg px-4 py-2 cursor-pointer text-sm">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="h-px bg-app-border mx-4"></div>
              <div className="flex items-center gap-4 px-4 py-3.5 justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <Moon className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Appearance</p>
                </div>
                <div className="flex items-center gap-2 text-app-muted text-sm">
                  <span>{settings.appearance === 'dark' ? 'Dark' : 'Light'}</span>
                  <Switch
                    checked={settings.appearance === 'dark'}
                    onCheckedChange={handleAppearanceChange}
                  />
                </div>
              </div>
            </div>
          </section>
          <section className="mt-4">
            <h3 className="text-app-muted text-xs font-bold uppercase tracking-wider px-6 pb-2 pt-2">Features</h3>
            <div className="flex flex-col bg-app-surface rounded-2xl mx-4 overflow-hidden border border-app-border shadow-sm">
              <button
                type="button"
                onClick={() => setShowBudgetEditor(v => !v)}
                className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Monthly Budget</p>
                </div>
                <div className="flex items-center gap-2 text-app-muted text-sm">
                  <span>{formatAmount(settings.budget?.monthly || 0, settings.baseCurrency, settings)}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
              {showBudgetEditor && (
                <div className="px-4 pb-4 pt-1">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="monthlyBudget" className="text-xs font-semibold text-app-muted uppercase tracking-wider">Monthly Budget</Label>
                      <Input
                        id="monthlyBudget"
                        type="number"
                        value={settings.budget?.monthly || ''}
                        onChange={(e) => handleChange('budget', 'monthly', parseFloat(e.target.value))}
                        min="0"
                        step="0.01"
                        className="w-full bg-app-surface2 border border-app-border text-white rounded-xl px-4 py-3 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budgetStartDay" className="text-xs font-semibold text-app-muted uppercase tracking-wider">Budget Start Day</Label>
                      <Input
                        id="budgetStartDay"
                        type="number"
                        value={settings.budget?.startDay || 1}
                        onChange={(e) => handleChange('budget', 'startDay', parseInt(e.target.value))}
                        min="1"
                        max="31"
                        className="w-full bg-app-surface2 border border-app-border text-white rounded-xl px-4 py-3 text-base"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-app-surface2 rounded-xl px-4 py-3 border border-app-border">
                      <Label htmlFor="notifyOnExceed" className="text-sm font-medium text-white">Notify on Budget Exceed</Label>
                      <Switch id="notifyOnExceed" checked={settings.budget?.notifyOnExceed ?? false} onCheckedChange={(checked) => handleChange('budget', 'notifyOnExceed', checked)} />
                    </div>
                  </div>
                </div>
              )}
              <div className="h-px bg-app-border mx-4"></div>
              <div className="flex items-center gap-4 px-4 py-3.5 justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-base font-medium leading-normal">Location Insights</p>
                    <p className="text-xs text-app-muted">Tag expenses by place</p>
                  </div>
                </div>
                <Switch
                  checked={settings.features?.locationInsights !== false}
                  onCheckedChange={handleLocationInsightsToggle}
                />
              </div>
            </div>
          </section>
          <section className="mt-4">
            <h3 className="text-app-muted text-xs font-bold uppercase tracking-wider px-6 pb-2 pt-2">Data & Security</h3>
            <div className="flex flex-col bg-app-surface rounded-2xl mx-4 overflow-hidden border border-app-border shadow-sm">
              <button
                type="button"
                onClick={() => setShowExportOptions(v => !v)}
                className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Export Data</p>
                </div>
                <div className="flex items-center gap-2 text-app-muted text-sm">
                  CSV, PDF
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
              {showExportOptions && (
                <div className="px-4 pb-4">
                  <ExportSection />
                </div>
              )}
              <div className="h-px bg-app-border mx-4"></div>
              {/*
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  document.dispatchEvent(new CustomEvent('requestTabChange', { detail: 'group' }));
                }}
                className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <Users className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Manage Groups</p>
                </div>
                <ChevronRight className="h-4 w-4 text-app-muted" />
              </button>
              <div className="h-px bg-app-border mx-4"></div>
              {isIphone && (
                <div className="flex items-center gap-4 px-4 py-3.5 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                      <Shield className="h-5 w-5" />
                    </div>
                    <p className="text-base font-medium leading-normal flex-1 truncate">Face ID Lock</p>
                  </div>
                  <Switch
                    checked={settings.security?.faceIdEnabled ?? false}
                    onCheckedChange={(checked) => handleChange('security', 'faceIdEnabled', checked)}
                  />
                </div>
              )}
              */}
            </div>
          </section>
          <section className="mt-4">
            <h3 className="text-app-muted text-xs font-bold uppercase tracking-wider px-6 pb-2 pt-2">Support & Legal</h3>
            <div className="flex flex-col bg-app-surface rounded-2xl mx-4 overflow-hidden border border-app-border shadow-sm">
              <button
                type="button"
                onClick={() => setShowHelpCenter(true)}
                className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Help Center</p>
                </div>
                <ChevronRight className="h-4 w-4 text-app-muted" />
              </button>
              <div className="h-px bg-app-border mx-4"></div>
              <button
                type="button"
                onClick={() => setShowPrivacyPolicy(true)}
                className="flex items-center gap-4 px-4 py-3.5 justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-primary flex items-center justify-center rounded-lg bg-app-primary/10 shrink-0 size-10">
                    <Shield className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium leading-normal flex-1 truncate">Privacy Policy</p>
                </div>
                <ChevronRight className="h-4 w-4 text-app-muted" />
              </button>
            </div>
          </section>
          <div className="px-4 mt-8 mb-4">
            <button
              onClick={handleSignOut}
              className="w-full bg-red-500/10 text-red-400 font-bold py-3.5 rounded-xl hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
            <p className="text-center text-xs text-app-muted mt-4">Version 2.4.1 (Build 8902)</p>
          </div>
        </div>
      </main>
      {isDirty && (
        <div className="sticky bottom-0 z-20 bg-app-bg/95 backdrop-blur-md border-t border-app-border px-4 py-4 flex items-center gap-3">
          <div className="flex-grow text-xs text-app-muted">Unsaved changes</div>
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-transparent border-app-border text-white hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || !!nameError || !!emailError}
            className="bg-app-primary hover:bg-blue-600 text-white"
          >
            Save
          </Button>
        </div>
      )}
      {showHelpCenter && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[94vw] max-w-md rounded-2xl bg-app-surface text-app-fg border border-app-border p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <h3 className="text-lg font-bold">Help Center</h3>
              <button onClick={() => setShowHelpCenter(false)} className="text-app-muted">✕</button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-app-fg">
              <div>
                <p className="font-semibold">How do I scan a receipt?</p>
                <p className="text-app-fg-muted">Tap the scan button, align the receipt, and capture. You can edit before saving.</p>
              </div>
              <div>
                <p className="font-semibold">Why is a receipt missing?</p>
                <p className="text-app-fg-muted">Check your filters, date range, or group selection.</p>
              </div>
              <div>
                <p className="font-semibold">How do I fix a receipt?</p>
                <p className="text-app-fg-muted">Open the receipt, tap Edit, and update the details.</p>
              </div>
              <div>
                <p className="font-semibold">Can I export data?</p>
                <p className="text-app-fg-muted">Go to Settings → Export Data and choose a format.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setShowHelpCenter(false)} className="bg-app-primary text-white">Close</Button>
            </div>
          </div>
        </div>
      )}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[94vw] max-w-md rounded-2xl bg-app-surface text-app-fg border border-app-border p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <h3 className="text-lg font-bold">Privacy Policy</h3>
              <button onClick={() => setShowPrivacyPolicy(false)} className="text-app-muted">✕</button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-app-fg-muted">
              <p>We protect your data with industry-standard security practices.</p>
              <p>Data is encrypted in transit using TLS 1.2+ and at rest using AES-256 (or equivalent) by our cloud providers.</p>
              <p>We comply with GDPR (EU) and CCPA/CPRA (USA) requirements for data access, deletion, and portability.</p>
              <p>We only collect data necessary to provide core app functionality and never sell personal data.</p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setShowPrivacyPolicy(false)} className="bg-app-primary text-white">Close</Button>
            </div>
          </div>
        </div>
      )}
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
  const EMOJI_OPTIONS = [
    "\u{1F603}",
    "\u{1F984}",
    "\u{1F431}",
    "\u{1F436}",
    "\u{1F98A}",
    "\u{1F43C}",
    "\u{1F438}",
    "\u{1F435}",
    "\u{1F47E}",
    "\u{1F916}",
    "\u{1F9D1}\u{200D}\u{1F4BB}",
    "\u{1F9B8}",
    "\u{1F9D9}",
    "\u{1F9D1}\u{200D}\u{1F680}",
    "\u{1F9D1}\u{200D}\u{1F3A4}"
  ];
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
            <button onClick={onClose} className="text-slate-400 hover:text-blue-300 text-2xl font-bold" aria-label="Close">x</button>
        </div>
        <div className="p-6 flex flex-col items-center gap-6">
          {/* Avatar preview */}
          <span className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg border-4 border-slate-600 text-6xl">
            {selectedEmoji ? (
              <span role="img" aria-label="avatar">{selectedEmoji}</span>
            ) : (
              <span role="img" aria-label="avatar">{"\u{1F984}"}</span>
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
