
import * as admin from 'firebase-admin';

function getServiceAccount() {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.');
    }
    // The key is expected to be a base64 encoded string.
    const decodedKey = Buffer.from(key, 'base64').toString('utf-8');
    const correctedKey = decodedKey.replace(/\\n/g, '\n');
    return JSON.parse(correctedKey);
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount()),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();
export { adminDb };
