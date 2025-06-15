import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail as firebaseSendPasswordResetEmail, sendEmailVerification as firebaseSendEmailVerification, updateProfile as firebaseUpdateProfile, updateEmail as firebaseUpdateEmail, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
            createdAt: new Date().toISOString(), // Add a creation timestamp
            settings: {} // Initialize settings
          }, { merge: true });
          setUser(user); // Set user after creating document
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
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
      createdAt: new Date().toISOString(),
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