import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, LogOut, UserCircle, Mail, ChevronDown, Settings, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Settings as SettingsComponent, UnifiedEditAvatarModal } from './Settings';
import { useToast } from "@/components/ui/use-toast";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Label } from '@/components/ui/label';

const EMOJI_OPTIONS = ["😃", "🦄", "🐱", "🐶", "🦊", "🐼", "🐸", "🐵", "👾", "🤖", "🧑‍💻", "🦸", "🧙", "🧑‍🚀", "🧑‍🎤"];

export default function AuthHeader() {
  const { user, signInWithGoogle, signOutUser, signInWithEmail, signUpWithEmail, sendPasswordReset, sendEmailVerification, updateUserProfile, auth, updateEmail, updateDisplayName } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.displayName || "");
  const [profilePhoto, setProfilePhoto] = useState(user?.photoURL || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAvatar, setOnboardingAvatar] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [emailChangeMsg, setEmailChangeMsg] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [nameSuccessMessage, setNameSuccessMessage] = useState("");
  const [emailSuccessMessage, setEmailSuccessMessage] = useState("");
  const fileInputRef = useRef();
  const [showReauthPrompt, setShowReauthPrompt] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const { toast } = useToast();

  // Settings logic
  const [showSettings, setShowSettings] = useState(false);

  // On sign up, show onboarding if user has no displayName
  useEffect(() => {
    if (user && !user.displayName && !showOnboarding && !showVerify) {
      setShowOnboarding(true);
      setOnboardingStep(0);
    }
    // If user is not verified, show verify modal
    if (user && user.email && user.emailVerified === false && !showVerify) {
      setShowVerify(true);
    }
  }, [user]);

  // Update profileName and profilePhoto when user changes
  useEffect(() => {
    setProfileName(user?.displayName || "");
    setProfilePhoto(user?.photoURL || "");
    setNewName(user?.displayName || "");
    setNewEmail(user?.email || "");
  }, [user]);

  // Add scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const scrollStart = windowHeight * 0.2; // Start animation after 20% scroll
      const scrollEnd = windowHeight * 0.5; // End animation at 50% scroll

      setIsScrolled(scrollPosition > 50);

      if (scrollPosition > scrollStart) {
        const progress = Math.min(1, (scrollPosition - scrollStart) / (scrollEnd - scrollStart));
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleOpenModal = () => {
      setShowModal(true);
      setIsSignUp(true); // Set to true to open register view
    };
    window.addEventListener('open-email-auth-modal', handleOpenModal);
    return () => window.removeEventListener('open-email-auth-modal', handleOpenModal);
  }, []);

  const handleEmailAuth = async () => {
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        try {
          await signUpWithEmail(email, password);
          // On sign up, onboarding will be triggered by useEffect
        } catch (err) {
          if (err.code === 'auth/email-already-in-use') {
            // If email exists, switch to sign in and show friendly message
            setIsSignUp(false);
            toast({
              title: "Welcome back! 👋",
              description: "Seems like you're already part of our family! Let me sign you in...",
              variant: "success",
              duration: 3000,
              style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
            });
            // Try to sign in with the same credentials
            await signInWithEmail(email, password);
          } else {
            throw err; // Re-throw other errors
          }
        }
      } else {
        await signInWithEmail(email, password);
      }
      setShowModal(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    setProfileMessage("");
    try {
      const updates = {};
      if (profileName !== user.displayName) {
        updates.displayName = profileName;
      }
      if (profilePhoto !== user.photoURL) {
        updates.photoURL = profilePhoto;
      }
      
      if (Object.keys(updates).length > 0) {
        // Update the backend
        await updateUserProfile(updates);
        
        // Force a refresh of the user object
        await auth.currentUser.reload();
        
        toast({
          title: "Profile Updated!",
          description: "Your profile has been beautifully updated! ✨",
          variant: "success",
          duration: 3000,
          style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
        });
      }
    } catch (err) {
      setProfileMessage("Error: " + err.message);
      toast({
        title: "Error updating profile",
        description: err.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendVerification = async () => {
    setProfileMessage("");
    try {
      await sendEmailVerification();
      setProfileMessage("Verification email sent!");
      setVerifyMessage("Verification email sent! Please check your inbox.");
      toast({
        title: "Verification Email Sent!",
        description: "Check your inbox for a magical link! 📧",
        variant: "success",
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
    } catch (err) {
      setProfileMessage("Error: " + err.message);
      setVerifyMessage("Error: " + err.message);
      toast({
        title: "Error sending verification",
        description: err.message || "Failed to send verification email.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordReset = async () => {
    setProfileMessage("");
    try {
      await sendPasswordReset(user.email);
      setProfileMessage("Password reset email sent!");
      toast({
        title: "Password Reset Link Sent!",
        description: "A mystical link awaits in your inbox! 🔑",
        variant: "success",
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
    } catch (err) {
      setProfileMessage("Error: " + err.message);
      toast({
        title: "Error sending reset email",
        description: err.message || "Failed to send password reset email.",
        variant: "destructive",
      });
    }
  };

  // Onboarding submit
  const handleOnboardingSubmit = async () => {
    if (!onboardingName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }
    try {
      await updateUserProfile({ displayName: onboardingName, photoURL: onboardingAvatar });
      setShowOnboarding(false);
      setOnboardingName("");
      setOnboardingAvatar("");
      // If not verified, show verify modal
      if (user && user.emailVerified === false) {
        setShowVerify(true);
      }
      toast({
        title: "Welcome to ExpenseApp!",
        description: "Your profile is all set! Let the magic begin! ✨",
        variant: "success",
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
    } catch (err) {
      setVerifyMessage("Error: " + err.message);
      toast({
        title: "Onboarding Error",
        description: err.message || "Failed to complete onboarding.",
        variant: "destructive",
      });
    }
  };

  // Profile dropdown outside click
  useEffect(() => {
    if (!showProfile) return;
    function handleClick(e) {
      if (!document.getElementById('profile-dropdown')?.contains(e.target)) {
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProfile]);

  // If user is not verified, block app and show verify modal
  const showBlockVerify = user && user.email && user.emailVerified === false && !showOnboarding;

  // Validate email format
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle name change
  const handleNameChange = async () => {
    setIsSavingName(true);
    setNameError("");
    setNameSuccessMessage("");
    try {
      await updateDisplayName(newName);
      setNameSuccessMessage("Saved! ✨");
      toast({
        title: "Name Updated!",
        description: "Your name has been saved! ✨",
        variant: "success",
        duration: 2000,
        style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
      });
    } catch (error) {
      console.error("Error updating name:", error);
      setNameError("Failed to update name: " + error.message);
      toast({
        title: "Error updating name",
        description: error.message || "Failed to update name. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingName(false);
      // Clear success message after 3 seconds
      setTimeout(() => setNameSuccessMessage(''), 3000);
    }
  };

  // Handle email change
  const handleEmailChange = async () => {
    setIsSavingEmail(true);
    setEmailError("");
    setEmailSuccessMessage("");
    try {
      if (user) {
        // Trigger re-authentication if it's needed
        setShowReauthPrompt(true);
      } else {
        setEmailError("No user logged in.");
      }
    } catch (error) {
      console.error("Error setting up email change:", error);
      setEmailError("Failed to initiate email change: " + error.message);
      toast({
        title: "Error initiating email change",
        description: error.message || "Failed to initiate email change. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleReauthenticate = async () => {
    setIsReauthenticating(true);
    setReauthError("");
    try {
      if (user && currentPassword) {
        await reauthenticateUser(currentPassword);
        await updateEmail(user, newEmail); // Proceed with email update after reauthentication
        setEmailSuccessMessage("Verification email sent! Please check your inbox to verify your new email.");
        setShowReauthPrompt(false);
        setCurrentPassword('');
        toast({
          title: "Verification email sent!",
          description: "Updated! Verify new email 🔒",
          variant: "success",
          duration: 3000,
          style: { background: 'linear-gradient(90deg, #38ef7d 0%, #11998e 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(56,239,125,0.15)' }
        });
      } else {
        setReauthError("Please enter your current password.");
      }
    } catch (error) {
      console.error("Reauthentication or email update failed:", error);
      setReauthError(error.message || "Reauthentication failed. Please try again.");
      toast({
        title: "Reauthentication failed",
        description: error.message || "Failed to reauthenticate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleCancelEdit = (setEditing) => {
    setEditing(false);
    setNameError("");
    setEmailError("");
    setNameSuccessMessage("");
    setEmailSuccessMessage("");
    setShowReauthPrompt(false);
    setCurrentPassword("");
    setReauthError("");
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      toast({
        title: "Signed out",
        description: "You've been signed out! See you soon. 👋",
        variant: "success",
        duration: 3000,
        style: { background: 'linear-gradient(90deg, #ff7e5f 0%, #feb47b 100%)', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 24px 0 rgba(255,126,95,0.15)' }
      });
      window.location.replace('/'); // Redirect to landing page
    } catch (error) {
      toast({
        title: "Sign out error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const [showAvatarModal, setShowAvatarModal] = useState(false);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-slate-800/80 backdrop-blur-md shadow-lg' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 relative">
          {/* Original Logo */}
          <div className="flex-shrink-0">
            <a href="/" className="flex items-center space-x-2">
              <span className="text-2xl">💰</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">ExpenseTracker</span>
            </a>
          </div>

          {/* Animated Headline in Header (positioned absolutely in the middle) */}
          <div
            className={`absolute transform -translate-x-1/2 transition-all duration-500 font-semibold text-blue-100 whitespace-nowrap
              ${scrollProgress > 0 ? 'opacity-100' : 'opacity-0'}
            `}
            style={{
              left: '50%',
              top: `${60 - (scrollProgress * 37)}px`, // Moves from bottom (60px) to desired middle (~23px relative to header's 16px height) as scrollProgress goes from 0 to 1
              opacity: scrollProgress,
            }}
          >
            <h2 className="text-lg">Effortless Receipt Management</h2>
          </div>

          {/* User Menu / Auth Buttons */}
          <div className="flex items-center space-x-4">
            {!user ? (
              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    setIsSignUp(true);
                    setShowModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Register
                </Button>
                <Button
                  onClick={() => {
                    setIsSignUp(false);
                    setShowModal(true);
                  }}
                  variant="ghost"
                  className="text-white hover:bg-gray-700 px-4 py-2 rounded-lg"
                >
                  <LogIn className="mr-2 h-4 w-4" /> Sign In
                </Button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors text-white"
                >
                  <UserCircle className="h-6 w-6" />
                  <span className="text-sm font-medium">{user?.displayName || 'User'}</span>
                </button>
                {showProfile && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-md shadow-lg py-1 z-50">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white hover:bg-slate-700"
                      onClick={() => {
                        setShowModal(true);
                        setShowProfile(false);
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" /> Settings
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white hover:bg-slate-700"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Dropdown */}
      {showProfile && createPortal(
        <div id="profile-dropdown" className="fixed inset-0 z-[9999] flex items-start justify-end pt-20 pr-8">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" onClick={() => setShowProfile(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-6 flex flex-col gap-4 animate-fade-in-up min-w-[320px] max-w-xs border border-blue-100" style={{zIndex: 10000}}>
            {/* Profile Info */}
            <div className="flex items-center gap-4 border-b pb-4 border-gray-200">
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 shadow-md border-2 border-white text-3xl">
                {user?.photoURL ? (
                  user.photoURL.length === 2 ? (
                    <span role="img" aria-label="avatar">{user.photoURL}</span>
                  ) : (
                    <img src={user.photoURL} alt="avatar" className="h-12 w-12 rounded-full object-cover" />
                  )
                ) : (
                  <span role="img" aria-label="avatar">🦄</span>
                )}
              </span>
              <div>
                <p className="font-semibold text-lg text-blue-900">{user?.displayName || "User"}</p>
                <p className="text-sm text-gray-500">{user?.email || "N/A"}</p>
              </div>
            </div>

            {/* Name Edit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Name</p>
                {editingName ? (
                  <div className="flex gap-2 items-center">
                    <Button variant="ghost" size="sm" onClick={() => handleCancelEdit(setEditingName)} disabled={isSavingName}>Cancel</Button>
                    <Button size="sm" onClick={handleNameChange} disabled={isSavingName}>
                      {isSavingName ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditingName(true)} className="text-blue-600 hover:underline">Edit</Button>
                )}
              </div>
              {editingName ? (
                <div className="relative">
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full"
                    placeholder="Your name"
                    disabled={isSavingName}
                  />
                  {(nameError || nameSuccessMessage) && (
                    <p className={`text-xs mt-1 absolute -bottom-4 left-0 animate-fade-in ${nameError ? 'text-red-500' : 'text-green-600'}`}>
                      {nameError || nameSuccessMessage}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-900 font-semibold">{user?.displayName || "N/A"}</p>
              )}
            </div>

            {/* Email Edit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Email</p>
                {editingEmail ? (
                  <div className="flex gap-2 items-center">
                    <Button variant="ghost" size="sm" onClick={() => handleCancelEdit(setEditingEmail)} disabled={isSavingEmail}>Cancel</Button>
                    <Button size="sm" onClick={handleEmailChange} disabled={isSavingEmail}>
                      {isSavingEmail ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditingEmail(true)} className="text-blue-600 hover:underline">Edit</Button>
                )}
              </div>
              {editingEmail ? (
                <div className="flex flex-col space-y-2">
                  <label htmlFor="email">Email</label>
                  <div className="flex space-x-2">
                    <Input
                      id="email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={isSavingEmail}
                      className="flex-1 border-gray-300 focus:border-blue-500 transition duration-200 ease-in-out"
                    />
                    <Button
                      onClick={handleEmailChange}
                      disabled={isSavingEmail || newEmail === user?.email || !isValidEmail(newEmail)}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-200 ease-in-out"
                    >
                      {isSavingEmail ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCancelEdit(setEditingEmail)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </Button>
                  </div>
                  {emailError && <p className="text-red-500 text-xs mt-1 transition-opacity duration-500 ease-in-out opacity-100">{emailError}</p>}
                  {emailSuccessMessage && <p className="text-green-500 text-xs mt-1 transition-opacity duration-500 ease-in-out opacity-100">{emailSuccessMessage}</p>}
                </div>
              ) : (
                <p className="text-gray-900 font-semibold">{user?.email || "N/A"}</p>
              )}
            </div>

            {/* Avatar Edit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Avatar</p>
                <Button variant="ghost" size="sm" onClick={() => setShowAvatarModal(true)} className="text-blue-600 hover:underline">Edit</Button>
              </div>
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 shadow-md border-2 border-white text-3xl">
                {user?.photoURL ? (
                  user.photoURL.length === 2 ? (
                    <span role="img" aria-label="avatar">{user.photoURL}</span>
                  ) : (
                    <img src={user.photoURL} alt="avatar" className="h-12 w-12 rounded-full object-cover" />
                  )
                ) : (
                  <span role="img" aria-label="avatar">🦄</span>
                )}
              </span>
            </div>

            <hr className="my-2 border-gray-200" />

            <button
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white font-bold shadow transition-all text-lg mb-2"
              onClick={() => { setShowSettings(true); setShowProfile(false); }}
            >
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
              Settings
            </button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      {showSettings && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => { setShowSettings(false); setShowProfile(false); }}>
          <div className="relative bg-white rounded-2xl shadow-2xl p-0 w-full max-w-2xl border border-blue-100 animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <SettingsComponent onClose={() => setShowSettings(false)} onCloseDropdown={() => setShowProfile(false)} />
          </div>
        </div>,
        document.body
      )}

      {/* Avatar Modal */}
      {showAvatarModal && createPortal(
        <UnifiedEditAvatarModal
          user={user}
          onClose={() => setShowAvatarModal(false)}
          onSave={async (emoji) => {
            await updateUserProfile({ photoURL: emoji });
            setShowAvatarModal(false);
          }}
        />, document.body
      )}

      {/* Email Auth Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full relative animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setShowModal(false)}>&times;</button>
            <Card>
              <CardHeader>
                <CardTitle>{isSignUp ? "Register" : "Sign In"} with Email</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="py-2.5 px-4 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg shadow-sm transition duration-200 ease-in-out"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="py-2.5 px-4 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg shadow-sm transition duration-200 ease-in-out"
                  />
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <Button onClick={handleEmailAuth} className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all duration-200 ease-in-out" disabled={loading}>
                    {loading ? "Loading..." : isSignUp ? "Register" : "Sign In"}
                  </Button>
                </div>
                <div className="mt-4 text-center flex flex-col gap-2">
                  <button
                    className="text-blue-600 hover:underline text-sm"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Register"}
                  </button>
                  <button
                    className="text-blue-600 hover:underline text-sm"
                    onClick={async () => {
                      setShowModal(false);
                      if (email) await sendPasswordReset(email);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="mt-6 flex flex-col items-center">
                  <p className="text-sm text-gray-500 mb-4">Or continue with</p>
                  <Button
                    onClick={signInWithGoogle}
                    className="w-full bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center gap-3 py-2.5 transition duration-200 ease-in-out"
                  >
                    <img src="/google-icon.svg" alt="Google" className="h-5 w-5" />
                    <span className="font-semibold text-black">Google</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>,
        document.body
      )}

      {/* Onboarding Modal */}
      {showOnboarding && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-6 animate-fade-in-up">
            <h2 className="text-2xl font-extrabold text-blue-700 text-center">Welcome! Let's personalize your profile</h2>
            <div className="flex flex-col gap-4">
              <label className="font-semibold text-blue-700">Your Name <span className="text-red-500">*</span></label>
              <Input
                type="text"
                placeholder="Display Name"
                value={onboardingName}
                onChange={e => setOnboardingName(e.target.value)}
                required
              />
              <label className="font-semibold text-blue-700">Avatar (optional)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {EMOJI_OPTIONS.map(emoji => (
                  <button type="button" key={emoji} className={`text-2xl p-2 rounded-full border-2 ${onboardingAvatar === emoji ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`} onClick={() => setOnboardingAvatar(emoji)}>{emoji}</button>
                ))}
                <Input
                  type="url"
                  placeholder="Paste image URL"
                  value={onboardingAvatar && !EMOJI_OPTIONS.includes(onboardingAvatar) ? onboardingAvatar : ''}
                  onChange={e => setOnboardingAvatar(e.target.value)}
                  className="w-32 text-xs"
                />
              </div>
              <Button onClick={handleOnboardingSubmit} className="w-full mt-2" disabled={!onboardingName.trim()}>Save & Continue</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Email Verification Modal */}
      {showBlockVerify && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-6 animate-fade-in-up">
            <h2 className="text-2xl font-extrabold text-blue-700 text-center">Verify your email</h2>
            <p className="text-gray-700 text-center">Please verify your email address to access ExpenseApp. Check your inbox and click the verification link.</p>
            <Button onClick={handleSendVerification} className="w-full">Resend Verification Email</Button>
            {verifyMessage && <div className="text-center text-green-600 font-semibold mt-2">{verifyMessage}</div>}
            <Button onClick={signOutUser} variant="outline" className="w-full">Sign Out</Button>
          </div>
        </div>,
        document.body
      )}

      {showReauthPrompt && (
        <Card className="mt-4 border-yellow-500 bg-yellow-50/50 shadow-md">
          <CardContent className="pt-4">
            <p className="text-yellow-700 text-sm mb-3">For security, please re-enter your current password to update your email.</p>
            <Input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isReauthenticating}
              className="mb-2"
            />
            {reauthError && <p className="text-red-500 text-xs mt-1">{reauthError}</p>}
            <Button
              onClick={handleReauthenticate}
              disabled={isReauthenticating || !currentPassword.trim()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded mt-2"
            >
              {isReauthenticating ? "Reauthenticating..." : "Re-authenticate"}
            </Button>
          </CardContent>
        </Card>
      )}
    </header>
  );
} 