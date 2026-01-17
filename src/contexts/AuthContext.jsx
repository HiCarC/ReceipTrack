import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail as firebaseSendPasswordResetEmail, sendEmailVerification as firebaseSendEmailVerification, updateProfile as firebaseUpdateProfile, updateEmail as firebaseUpdateEmail, verifyBeforeUpdateEmail, connectAuthEmulator } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const emulatorConnectedRef = useRef(false);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    const tryConnectEmulator = async () => {
      if (!import.meta.env.DEV || typeof window === 'undefined') return false;
      if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true') return false;
      if (window.location.hostname !== 'localhost') return false;
      const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || 'http://localhost:9099';
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      if (!projectId) return false;
      if (emulatorConnectedRef.current) return true;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      try {
        const res = await fetch(
          `${emulatorHost}/emulator/v1/projects/${projectId}/config`,
          { signal: controller.signal }
        );
        if (res.ok) {
          connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
          emulatorConnectedRef.current = true;
          return true;
        }
      } catch (error) {
        // Ignore emulator probe failures/timeouts in dev.
      } finally {
        clearTimeout(timeout);
      }
      return false;
    };

    const init = async () => {
      await tryConnectEmulator();
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Get additional user data from Firestore
          const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUser({ ...user, ...userDoc.data() });
        } else {
          // If user document doesn't exist, create it with basic info
          await setDoc(userDocRef, {
            displayName: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp(), // Add a creation timestamp
            settings: {} // Initialize settings
          }, { merge: true });
          setUser(user); // Set user after creating document
        }
      } else {
        setUser(null);
      }
        setLoading(false);
      });
    };

    init();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [auth]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // onAuthStateChanged will handle creating the Firestore doc if it's a new user
  };

  const signInWithEmail = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle creating/updating the Firestore doc
  };

  const signUpWithEmail = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // Explicitly create user document for new sign-ups
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      settings: {} // Initialize settings
    }, { merge: true });
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const sendPasswordReset = async (email) => {
    await firebaseSendPasswordResetEmail(auth, email);
  };

  const sendEmailVerificationToUser = async () => {
    if (auth.currentUser) {
      await firebaseSendEmailVerification(auth.currentUser);
    }
  };

  const updateUserProfile = async (profile) => {
    if (auth.currentUser) {
      try {
        // Update Firebase Auth profile
        await firebaseUpdateProfile(auth.currentUser, profile);
        
        // Update Firestore database
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, profile);
        
        // Update local state with new data
        const updatedUser = { ...auth.currentUser, ...profile };
        setUser(updatedUser);
        
        return true;
      } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }
    }
  };

  const updateEmail = async (user, newEmail) => {
    if (user) {
      try {
        await verifyBeforeUpdateEmail(user, newEmail);
        return true;
      } catch (error) {
        console.error('Error updating email:', error);
        throw error;
      }
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signOutUser,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    sendEmailVerification: sendEmailVerificationToUser,
    updateUserProfile,
    auth,
    updateEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
