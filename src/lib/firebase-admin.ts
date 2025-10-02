
import * as admin from 'firebase-admin';

let adminDb: admin.firestore.Firestore;

function getServiceAccount() {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.');
    }
    // The key is expected to be a base64 encoded string.
    const decodedKey = Buffer.from(key, 'base64').toString('utf-8');
    return JSON.parse(decodedKey);
}

export function getAdminDb() {
  if (!admin.apps.length) {
    try {
      const serviceAccount = getServiceAccount();
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Firebase admin initialization error', error);
    }
  }
  if (!adminDb) {
    adminDb = admin.firestore();
  }
  return adminDb;
}
