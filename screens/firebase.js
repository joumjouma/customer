// firebase.js (for Firebase v9+)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBMQW59pFle0vVp0xotmnpVTYqAlTbdbQQ",
  authDomain: "eco-share-92ef1.firebaseapp.com",
  projectId: "eco-share-92ef1",
  storageBucket: "eco-share-92ef1.appspot.com",
  messagingSenderId: "747419763478",
  appId: "1:747419763478:web:2a27c6cb85ad28922c8637",
  measurementId: "G-WX3CXQJGMP",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, db, rtdb };
