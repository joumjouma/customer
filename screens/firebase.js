// firebase.js
import firebase from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';
import '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxeOgFmJruEmkvNdNemWzSSKGtteR5Tps",
  authDomain: "eco-share-92ef1.firebaseapp.com",
  projectId: "eco-share-92ef1",
  storageBucket: "eco-share-92ef1.appspot.com",
  messagingSenderId: "747419763478",
  appId: "1:747419763478:web:a12bb5f1d9e6fa082c8637",
  measurementId: "G-WX3CXQJGMP",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

export { auth, db, rtdb, firebaseConfig };
export default firebase; 