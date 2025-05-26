
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Import getAuth

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUIRYm2CbeA0TVJndd5GEa_fDlO0QdeFU",
  authDomain: "harmun-tracker.firebaseapp.com",
  projectId: "harmun-tracker",
  storageBucket: "harmun-tracker.appspot.com", // Corrected common typo: .appspot.com for storageBucket
  messagingSenderId: "920897622876",
  appId: "1:920897622876:web:39df153705816e4345e799",
  measurementId: "G-2GC9MRVG8Q"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Auth
const auth = getAuth(app); // Initialize and export auth

let analytics;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, db, auth, analytics, firebaseConfig }; // Export auth
