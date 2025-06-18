import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SUPPORTED_CURRENCIES } from '@/utils/currencyUtils';
import { loadSettings, saveSettings, updateSettings, formatAmount } from '@/utils/settingsUtils';
import { ChevronDown } from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import Cropper from 'react-easy-crop';
import { updateProfile } from 'firebase/auth';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';

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

  // Filter currencies by search
  const filteredCurrencies = CURRENCIES.filter(c =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.symbol.includes(currencySearch) ||
    c.flag.includes(currencySearch)
  );

  // Get selected currency object
  const selectedCurrency = CURRENCIES.find(c => c.code === settings.baseCurrency) || CURRENCIES[0];

  return (
    <div className={"h-full flex flex-col " + (window.innerWidth < 768 ? 'fixed inset-0 z-[99999] bg-white overflow-y-auto' : '')}>
      <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-100 to-gray-200 rounded-t-2xl border-b border-gray-200 flex items-center justify-between px-6 py-4 shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-blue-600 text-2xl font-bold" aria-label="Close">×</button>
      </div>
      <div className={"flex-1 overflow-y-auto " + (window.innerWidth < 768 ? 'p-4 space-y-6' : 'max-h-[70vh] p-6 space-y-6')}>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  id="name"
                  type="text"
                  value={settings.name}
                  onChange={(e) => handleChange('', 'name', e.target.value)}
                placeholder="Enter your name"
                className={`w-full px-4 py-2 rounded-lg border ${nameError ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('', 'email', e.target.value)}
                placeholder="Enter your email"
                className={`w-full px-4 py-2 rounded-lg border ${emailError ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>
          </div>
        </div>
          <div className="flex items-center gap-4 p-6 rounded-2xl shadow bg-gradient-to-br from-gray-100 to-gray-200 mb-2 border border-gray-200">
            <div className="relative">
              <span className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 shadow-lg border-4 border-white text-5xl">
                {user?.photoURL ? (
                  user.photoURL.length === 2 ? (
                    <span role="img" aria-label="avatar">{user.photoURL}</span>
                  ) : (
                    <img src={user.photoURL} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
                  )
                ) : (
                  <span role="img" aria-label="avatar">🦄</span>
                )}
              </span>
              <button
                className="absolute bottom-1 right-1 bg-blue-600 text-white rounded-full p-2 shadow hover:bg-blue-700 focus:outline-none border-2 border-white"
                title="Edit Avatar"
                onClick={() => setShowAvatarModal(true)}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 10-4-4l-8 8v3z" /></svg>
              </button>
            </div>
            <div>
              <div className="font-semibold text-lg text-blue-900">Change your avatar</div>
              <div className="text-gray-500 text-sm mb-2">Personalize your profile with an emoji or image</div>
            </div>
          </div>
          {showAvatarModal && (
            <UnifiedEditAvatarModal
              user={user}
              onClose={() => setShowAvatarModal(false)}
              onSave={async (photoURL) => {
                await updateUserProfile({ photoURL });
                setShowAvatarModal(false);
                toast({
                  title: "Avatar updated!",
                  description: "Your profile picture has been updated.",
                  variant: "success",
                  duration: 2000,
                  style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
                });
              }}
            />
          )}
          <hr className="my-4 border-gray-200" />
          <Card className="mb-2 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 shadow-md">
            <CardHeader>
              <CardTitle>Currency Settings</CardTitle>
              <CardDescription>Configure your currency preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Base Currency</Label>
                <div className="relative w-full max-w-xs" style={{zIndex: 60, overflow: 'visible'}}>
                  <button
                    type="button"
                    className="flex items-center justify-between w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 hover:shadow-2xl hover:border-blue-400 group"
                    onClick={() => setShowCurrencyDropdown(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={showCurrencyDropdown}
                    style={{minHeight: '56px'}}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-2xl">{selectedCurrency.flag}</span>
                      <span>{selectedCurrency.name} ({selectedCurrency.code})</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{selectedCurrency.symbol}</span>
                      <ChevronDown className={`ml-2 h-6 w-6 transition-transform duration-200 ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {showCurrencyDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-2 w-full bg-white border border-blue-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto animate-fade-in-scale origin-top transition-all duration-200" style={{minWidth: '100%'}}>
                      <div className="p-2 sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 z-10 rounded-t-2xl">
                        <Input
                          autoFocus
                          placeholder="Search currency..."
                          value={currencySearch}
                          onChange={e => setCurrencySearch(e.target.value)}
                          className="mb-2 rounded-md border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 bg-white"
                        />
                      </div>
                      {filteredCurrencies.length === 0 && (
                        <div className="p-4 text-center text-gray-400">No results</div>
                      )}
                      {filteredCurrencies.map(currency => (
                        <button
                          key={currency.code}
                          type="button"
                          className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-150 hover:bg-blue-100 active:bg-blue-200 focus:bg-blue-200 border-2 border-transparent ${currency.code === settings.baseCurrency ? 'bg-blue-50 border-blue-400 font-bold shadow' : ''}`}
                          onClick={() => {
                            handleChange('', 'baseCurrency', currency.code);
                            setShowCurrencyDropdown(false);
                            setCurrencySearch("");
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-2xl">{currency.flag}</span>
                            <span>{currency.name} ({currency.code})</span>
                          </span>
                          <span className="text-xl">{currency.symbol}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold">Preview:</span> {formatAmount(selectedCurrency.example, settings.baseCurrency, settings)}
                </div>
              </div>
            </CardContent>
          </Card>
          <hr className="my-4 border-gray-200" />
          <Card className="mb-2">
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
              <CardDescription>Configure how amounts are displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Show Original Amounts</Label>
                <Switch
                  checked={settings.showOriginalAmounts}
                  onCheckedChange={(checked) => handleChange('', 'showOriginalAmounts', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Converted Amounts</Label>
                <Switch
                  checked={settings.showConvertedAmounts}
                  onCheckedChange={(checked) => handleChange('', 'showConvertedAmounts', checked)}
                />
              </div>
            </CardContent>
          </Card>
          <hr className="my-4 border-gray-200" />
          <Card className="mb-2">
            <CardHeader>
              <CardTitle>Budget Settings</CardTitle>
              <CardDescription>Configure your monthly budget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Monthly Budget</Label>
                <Input
                  type="number"
                  value={settings.budget.monthly}
                  onChange={(e) => handleChange('budget', 'monthly', parseFloat(e.target.value))}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Budget Start Day</Label>
                <Input
                  type="number"
                  value={settings.budget.startDay}
                  onChange={(e) => handleChange('budget', 'startDay', parseInt(e.target.value))}
                  min="1"
                  max="31"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Notify on Budget Exceed</Label>
                <Switch
                  checked={settings.budget.notifyOnExceed}
                  onCheckedChange={(checked) => handleChange('budget', 'notifyOnExceed', checked)}
                />
              </div>
            </CardContent>
          </Card>
          <hr className="my-4 border-gray-200" />
          <Card className="mb-2">
            <CardHeader>
              <CardTitle>Export Settings</CardTitle>
              <CardDescription>Configure export preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Export Format</Label>
                <Select
                  value={settings.export.defaultFormat}
                  onValueChange={(value) => handleChange('export', 'defaultFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select export format" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FORMATS.map(format => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      <div className={"flex justify-end gap-2 mt-8 " + (window.innerWidth < 768 ? 'sticky bottom-0 left-0 right-0 bg-white py-4 px-4 border-t border-gray-200 z-50' : '')}>
        {saveSuccess && <span className="text-green-600 font-semibold flex items-center animate-fade-in">Saved! ✓</span>}
        {isDirty && !saveSuccess && (
          <span className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-100 border border-yellow-400 text-yellow-800 font-semibold text-sm animate-fade-in shadow-sm">
            <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            You have unsaved changes
          </span>
        )}
        <Button variant="outline" onClick={handleReset} disabled={!isDirty}>Reset</Button>
        <Button onClick={handleSave} disabled={!!nameError || !!emailError || !isDirty} className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg">
            Save
          </Button>
      </div>
      {window.innerWidth < 768 && (
        <style>{`
          .fixed.inset-0.z-\[99999\].bg-white.overflow-y-auto {
            padding-bottom: 80px !important;
          }
          .sticky.bottom-0.left-0.right-0.bg-white.py-4.px-4.border-t.border-gray-200.z-50 {
            box-shadow: 0 -2px 16px 0 rgba(56,239,125,0.10);
          }
          .p-4.space-y-6 > * {
            font-size: 1.1rem !important;
            margin-bottom: 1.5rem !important;
          }
          input, button, select, .rounded-2xl, .rounded-xl {
            min-height: 56px !important;
            font-size: 1.1rem !important;
            border-radius: 1rem !important;
          }
          label, .font-semibold, .font-bold {
            font-size: 1.05rem !important;
          }
          .space-y-2 > * {
            margin-bottom: 0.75rem !important;
          }
        `}</style>
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
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
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

  // Save avatar with cropping or emoji
  const handleSave = async () => {
    if (selectedEmoji) {
      onSave(selectedEmoji);
    } else if (avatarPreview && croppedAreaPixels) {
      const croppedDataUrl = await getCroppedImg();
      onSave(croppedDataUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl p-0 w-full max-w-md border border-blue-100 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header from settings */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-100 to-gray-200 rounded-t-2xl border-b border-gray-200 flex items-center justify-between px-6 py-4 shadow-sm">
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Edit Avatar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-blue-600 text-2xl font-bold" aria-label="Close">×</button>
        </div>
        <div className="p-6 flex flex-col items-center gap-6">
          {/* Avatar preview */}
          <span className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 shadow-lg border-4 border-white text-6xl">
            {selectedEmoji ? (
              <span role="img" aria-label="avatar">{selectedEmoji}</span>
            ) : (
              <span role="img" aria-label="avatar">🦄</span>
            )}
          </span>
          {/* Emoji grid */}
          <div className="mb-2 text-gray-700 text-center font-medium animate-fade-in">
            Choose your avatar emoji:
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                className={`text-3xl p-1 rounded-lg transition-all ${selectedEmoji === emoji ? 'bg-blue-100 border-2 border-blue-400' : 'hover:bg-blue-50'}`}
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
          <Button className="w-full mt-4 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold shadow hover:bg-gray-200" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
} 