import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

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

try {
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  // Initialize services
  auth = getAuth(app);
  firestore = getFirestore(app);
  rtdb = getDatabase(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Don't throw the error, just log it and continue with null values
}

export { auth, firestore, rtdb };
export default app; 