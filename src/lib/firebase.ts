
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Import getAuth

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// IMPORTANT: For production, move this configuration to environment variables!
// See: https://firebase.google.com/docs/web/setup#safe-manage-your-credentials
const firebaseConfig = {
  apiKey: "AIzaSyCUIRYm2CbeA0TVJndd5GEa_fDlO0QdeFU", // Updated API key
  authDomain: "harmun-tracker.firebaseapp.com",
  projectId: "harmun-tracker",
  storageBucket: "harmun-tracker.appspot.com",
  messagingSenderId: "920897622876",
  appId: "1:920897622876:web:39df153705816e4345e799",
  measurementId: "G-2GC9MRVG8Q"
};

// Developer-facing check for placeholder API key
if (typeof window !== 'undefined' && firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error(
    "Firebase Initialization Error: API Key is still the placeholder 'YOUR_API_KEY'. " +
    "Please replace it with your actual Firebase project API key in src/lib/firebase.ts. " +
    "You can find your API key in your Firebase project settings: " +
    "Project Overview -> Project settings (gear icon) -> General -> Your apps -> Web app -> SDK setup and configuration."
  );
}

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

