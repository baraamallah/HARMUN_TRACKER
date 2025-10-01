import * as admin from 'firebase-admin';

let adminDb: admin.firestore.Firestore;

export function getAdminDb() {
  if (!admin.apps.length) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
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