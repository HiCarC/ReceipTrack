// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, initializeFirestore } from "firebase/firestore"; // Ensure Firestore is imported
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics = null;
if (
  typeof window !== 'undefined' &&
  import.meta.env.PROD &&
  firebaseConfig.measurementId
) {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn('Firebase analytics disabled:', error);
    });
}
const shouldUseLongPolling = typeof window !== 'undefined' &&
  /iPad|iPhone|iPod|Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg/i.test(navigator.userAgent);

const db = shouldUseLongPolling
  ? initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    })
  : getFirestore(app); // Initialize Firestore and assign to db
const auth = getAuth(app);

// Normalize storage bucket to avoid CORS issues when misconfigured
let storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
if (typeof storageBucket === 'string') {
  // If someone set the new download domain as the bucket, normalize back to the bucket name
  if (storageBucket.endsWith('.firebasestorage.app')) {
    storageBucket = storageBucket.replace(/\.firebasestorage\.app$/i, '.appspot.com');
  }
  // Ensure we pass a gs:// URL when available
}
const storage = storageBucket
  ? getStorage(app, `gs://${storageBucket}`)
  : getStorage(app);

export { db, analytics, auth, storage }; // Export db, analytics, auth, and storage
