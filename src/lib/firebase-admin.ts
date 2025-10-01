
import * as admin from 'firebase-admin';
import { serviceAccount } from './service-account';

// WARNING: This is not a secure way to handle secrets. 
// The service account key is stored in a file that is committed to version control.
// It is recommended to use environment variables instead.

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();
export { adminDb };
