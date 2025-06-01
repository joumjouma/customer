import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMQW59pFle0vVp0xotmnpVTYqAlTbdbQQ",
  authDomain: "eco-share-92ef1.firebaseapp.com",
  projectId: "eco-share-92ef1",
  storageBucket: "eco-share-92ef1.firebasestorage.app",
  messagingSenderId: "747419763478",
  appId: "1:747419763478:android:2a27c6cb85ad28922c8637",
  databaseURL: "https://eco-share-92ef1-default-rtdb.firebaseio.com",
  measurementId: "G-WX3CXQJGMP"
};

// Initialize Firebase
let app;
let auth;
let firestore;
let rtdb;
let storage;

try {
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Initialize Auth with AsyncStorage persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    app = getApp();
    // For existing app instance, initialize auth with persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  }
  
  // Initialize other services
  firestore = getFirestore(app);
  rtdb = getDatabase(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Don't throw the error, just log it and continue with null values
}

export { auth, firestore, rtdb, storage };
export default app;