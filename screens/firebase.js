// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAxeOgFmJruEmkvNdNemWzSSKGtteR5Tps",
  authDomain: "eco-share-92ef1.firebaseapp.com",
  projectId: "eco-share-92ef1",
  storageBucket: "eco-share-92ef1.appspot.com",
  messagingSenderId: "747419763478",
  appId: "1:747419763478:web:a12bb5f1d9e6fa082c8637",
  measurementId: "G-WX3CXQJGMP",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Realtime Database
const rtdb = getDatabase(app);

export { auth, db, rtdb };
export default app;