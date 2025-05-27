
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Import getAuth

// Your web app's Firebase configuration
// IMPORTANT: For production, these values MUST be sourced from environment variables.
// Create a .env.local file in your project root and add your Firebase config there.
// Example .env.local:
// NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
// NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
// ... and so on for all firebaseConfig keys.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCUIRYm2CbeA0TVJndd5GEa_fDlO0QdeFU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "harmun-tracker.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "harmun-tracker",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "harmun-tracker.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "920897622876",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:920897622876:web:39df153705816e4345e799",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-2GC9MRVG8Q"
};

// Developer-facing check for placeholder or default API key during development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const isUsingHardcodedDefaults = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (firebaseConfig.apiKey === "AIzaSyCUIRYm2CbeA0TVJndd5GEa_fDlO0QdeFU" && isUsingHardcodedDefaults) {
    console.warn(
      "%cFirebase Initialization Warning: Using hardcoded default Firebase config. " +
      "For better security and production readiness, create a .env.local file and set your Firebase project credentials as environment variables. " +
      "Refer to src/lib/firebase.ts and README.md for details. Without .env.local, your app might not connect to YOUR Firebase project.",
      "color: orange; font-weight: bold;"
    );
  }
  if (firebaseConfig.apiKey === "YOUR_API_KEY") { // A common placeholder if user hasn't changed it from a template
     console.error(
      "%cFirebase Initialization Error: API Key is still the placeholder 'YOUR_API_KEY'. " +
      "Please replace it with your actual Firebase project API key using environment variables (NEXT_PUBLIC_FIREBASE_API_KEY in .env.local).",
      "color: red; font-weight: bold;"
    );
  }
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
const auth = getAuth(app);

let analytics;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, db, auth, analytics, firebaseConfig };

