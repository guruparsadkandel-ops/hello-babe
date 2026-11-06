import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDDhsNp4JjWFlxIt1mTGnaG5jp4DG2iKCA",
  authDomain: "srijana-ganesh-chat.firebaseapp.com",
  projectId: "srijana-ganesh-chat",
  storageBucket: "srijana-ganesh-chat.firebasestorage.app",
  messagingSenderId: "129095462200",
  appId: "1:129095462200:web:52101681f15086651e65cd",
  measurementId: "G-YC5RV03C3E"
};

const app      = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

// Messaging only works in browsers that support it
export let messaging = null;
isSupported().then(supported => {
  if (supported) messaging = getMessaging(app);
});

export default app;