
'use server';

import { revalidatePath } from 'next/cache';
import { db, auth } from './firebase'; 
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import type { Participant, AttendanceStatus, AdminManagedUser, StaffMember, StaffAttendanceStatus } from '@/types';
import { OWNER_UID } from './constants';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams';
const USERS_COLLECTION = 'users';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


// IMPORTANT NOTE ON SERVER ACTIONS AND FIREBASE AUTHENTICATION (AS OF NEXT.JS 14 & FIREBASE CLIENT SDK):
// When Server Actions in this file use the Firebase CLIENT SDK's 'db' instance (getFirestore from 'firebase/firestore')),
// the 'request.auth' object within your Firestore Security Rules might NOT be populated with the
// end-user's UID who initiated the action on the client. Instead, it might be null or represent
// a default server identity (e.g., a service account if your Next.js app is hosted on Firebase Hosting with SSR,
// or a generic identity if hosted elsewhere like Vercel without explicit Admin SDK auth impersonation).
//
// This means security rules like 'allow read: if request.auth != null;' or custom functions
// like 'isAdmin()' / 'isOwner()' that check 'request.auth.uid' WILL LIKELY FAIL when invoked
// from these Server Actions, leading to PERMISSION_DENIED errors.
//
// The 'auth' object imported from './firebase' (getAuth from 'firebase/auth') is also the CLIENT SDK's auth.
// Calling 'auth.currentUser' within these server actions will result in 'null' because the server
// environment doesn't share the client's browser session or automatically impersonate the user.
//
// TO PROPERLY SECURE SERVER ACTIONS AND USE USER-SPECIFIC PERMISSIONS WITH FIRESTORE:
// The recommended approach is to use the Firebase ADMIN SDK (Node.js library 'firebase-admin'):
// 1. Client-Side: Get the current user's Firebase ID Token (e.g., `await auth.currentUser.getIdToken()`).
// 2. Client-Side: Pass this ID Token as an argument to your Server Action.
// 3. Server Action:
//    a. Initialize the Firebase Admin SDK.
//    b. Verify the ID Token using `admin.auth().verifyIdToken(idToken)`. This confirms authenticity and gets user UID/claims.
//    c. Perform Firestore operations using the Admin SDK's Firestore instance (`admin.firestore()`).
//       The Admin SDK typically bypasses security rules by default (as it operates with elevated privileges),
//       OR it can be used to respect security rules if specifically configured or if you perform custom checks based on the verified UID.
//
// The current implementation in this file uses the CLIENT SDK. Many actions have been moved client-side
// to ensure `request.auth.uid` is correctly populated for security rules.
// Remaining Server Actions (like import, bulk delete, admin management) will likely require the Admin SDK
// or rule adjustments for proper, secure operation based on user roles.

// System Settings Actions
export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Attempting to read default status.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    return 'Absent';
  } catch (error) {
    console.error("[Server Action] Error fetching default attendance status setting: ", error);
    return 'Absent'; 
  }
}

export async function updateDefaultAttendanceStatusSetting(newStatus: AttendanceStatus): Promise<{success: boolean, error?: string}> {
  console.log(`[Server Action - updateDefaultAttendanceStatusSetting] Attempting to update default status to: ${newStatus}.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    await setDoc(configDocRef, { defaultAttendanceStatus: newStatus }, { merge: true });
    revalidatePath('/superior-admin/system-settings');
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/staff');
    return { success: true };
  } catch (error) {
    console.error("[Server Action] Error updating default attendance status setting: ", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to update setting (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules for '${SYSTEM_CONFIG_COLLECTION}/${APP_SETTINGS_DOC_ID}' allow writes from server context or use Admin SDK. (OWNER_UID: ${OWNER_UID})`;
    console.error(detailedError);
    return { success: false, error: detailedError };
  }
}


// Participant Actions
export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    const participantsColRef = collection(db, PARTICIPANTS_COLLECTION);
    let q;
    const queryConstraints = [];

    if (filters?.school && filters.school !== "All Schools") {
      queryConstraints.push(where('school', '==', filters.school));
    }
    if (filters?.committee && filters.committee !== "All Committees") {
      queryConstraints.push(where('committee', '==', filters.committee));
    }
    if (filters?.status && filters.status !== 'All') {
      queryConstraints.push(where('status', '==', filters.status));
    }

    q = query(participantsColRef, ...queryConstraints, orderBy('name'));

    const querySnapshot = await getDocs(q);
    let participantsData = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || '',
        school: data.school || '',
        committee: data.committee || '',
        status: data.status || 'Absent',
        imageUrl: data.imageUrl,
        notes: data.notes,
        additionalDetails: data.additionalDetails,
        classGrade: data.classGrade,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Participant;
    });

    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      participantsData = participantsData.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.school.toLowerCase().includes(term) ||
        p.committee.toLowerCase().includes(term)
      );
    }

    return participantsData;
  } catch (error) {
      console.error(
        "[Server Action] Error fetching participants from Firestore. Active filters:",
        filters,
        "Underlying error:",
        error
      );
      const firebaseError = error as { code?: string; message?: string };
      let detailedMessage = `Failed to fetch participants (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}.`;

      if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index') || firebaseError.message?.includes('The query requires an index')) {
        detailedMessage += " This often indicates a missing Firestore index. Please check your browser's developer console for a Firestore error message that might include a link to create the required index in your Firebase project console.";
      } else if (firebaseError.code === 'permission-denied') {
        detailedMessage += " PERMISSION_DENIED. Firestore security rules are blocking this read. Ensure rules allow reads from the server action's context (e.g., public read or authenticated read if server actions run authenticated).";
      } else {
        detailedMessage += ` Details: ${firebaseError.message || String(error)}. This could also be a Firestore Security Rules issue preventing reads. Check the README.md for rules.`;
      }
      throw new Error(detailedMessage);
  }
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, id);
    const docSnap = await getDoc(participantRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || '',
        school: data.school || '',
        committee: data.committee || '',
        status: data.status || 'Absent',
        imageUrl: data.imageUrl,
        notes: data.notes,
        additionalDetails: data.additionalDetails,
        classGrade: data.classGrade,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Participant;
    }
    return null;
  } catch (error) {
    console.error(`[Server Action] Error fetching participant by ID ${id}: `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch participant (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'.`);
  }
}


export async function deleteParticipant(participantId: string): Promise<{ success: boolean }> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await deleteDoc(participantRef);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath(`/participants/${participantId}`);
    return { success: true };
  } catch (error) {
    console.error("[Server Action] Error deleting participant: ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to delete participant (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'. Likely requires Admin SDK or client-side execution for user-based permissions.`);
  }
}

// System School Actions
export async function getSystemSchools(): Promise<string[]> {
  try {
    const schoolsColRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
    const schoolsSnapshot = await getDocs(query(schoolsColRef, orderBy('name')));
    return schoolsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("[Server Action] Error fetching system schools: ", error);
    throw new Error("Failed to fetch system schools (Server Action). Check Firestore rules and connectivity.");
  }
}

export async function deleteSystemSchool(schoolName: string): Promise<{ success: boolean, error?: string }> {
  if (!schoolName) return { success: false, error: "School name cannot be empty." };
  try {
    const q = query(collection(db, SYSTEM_SCHOOLS_COLLECTION), where("name", "==", schoolName));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: false, error: `School "${schoolName}" not found.` };
    }
    const schoolDoc = querySnapshot.docs[0];
    await deleteDoc(doc(db, SYSTEM_SCHOOLS_COLLECTION, schoolDoc.id));
    revalidatePath('/superior-admin');
    return { success: true };
  } catch (error) {
    console.error("[Server Action] Error deleting system school: ", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to delete school (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${SYSTEM_SCHOOLS_COLLECTION}'. isOwner() rule will likely fail here if server action context isn't Owner.`;
    console.error(detailedError);
    return { success: false, error: detailedError };
  }
}


// System Committee Actions
export async function getSystemCommittees(): Promise<string[]> {
  try {
    const committeesColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
    const committeesSnapshot = await getDocs(query(committeesColRef, orderBy('name')));
    return committeesSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("[Server Action] Error fetching system committees: ", error);
    throw new Error("Failed to fetch system committees (Server Action). Check Firestore rules and connectivity.");
  }
}

export async function deleteSystemCommittee(committeeName: string): Promise<{ success: boolean, error?: string }> {
  if (!committeeName) return { success: false, error: "Committee name cannot be empty." };
  try {
    const q = query(collection(db, SYSTEM_COMMITTEES_COLLECTION), where("name", "==", committeeName));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: false, error: `Committee "${committeeName}" not found.` };
    }
    const committeeDoc = querySnapshot.docs[0];
    await deleteDoc(doc(db, SYSTEM_COMMITTEES_COLLECTION, committeeDoc.id));
    revalidatePath('/superior-admin');
    return { success: true };
  } catch (error) {
    console.error("[Server Action] Error deleting system committee: ", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to delete committee (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${SYSTEM_COMMITTEES_COLLECTION}'. isOwner() rule will likely fail here.`;
    console.error(detailedError);
    return { success: false, error: detailedError };
  }
}

// System Staff Teams Actions
export async function getSystemStaffTeams(): Promise<string[]> {
  try {
    const staffTeamsColRef = collection(db, SYSTEM_STAFF_TEAMS_COLLECTION);
    const staffTeamsSnapshot = await getDocs(query(staffTeamsColRef, orderBy('name')));
    return staffTeamsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("[Server Action] Error fetching system staff teams: ", error);
    throw new Error("Failed to fetch system staff teams (Server Action). Check Firestore rules and connectivity.");
  }
}

export async function deleteSystemStaffTeam(teamName: string): Promise<{ success: boolean, error?: string }> {
  if (!teamName) return { success: false, error: "Team name cannot be empty." };
  try {
    const q = query(collection(db, SYSTEM_STAFF_TEAMS_COLLECTION), where("name", "==", teamName));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: false, error: `Staff Team "${teamName}" not found.` };
    }
    const teamDoc = querySnapshot.docs[0];
    await deleteDoc(doc(db, SYSTEM_STAFF_TEAMS_COLLECTION, teamDoc.id));
    revalidatePath('/superior-admin');
    return { success: true };
  } catch (error) {
    console.error("[Server Action] Error deleting system staff team: ", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to delete staff team (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${SYSTEM_STAFF_TEAMS_COLLECTION}'. isOwner() rule will likely fail here.`;
    console.error(detailedError);
    return { success: false, error: detailedError };
  }
}


// Import Participants Action
export async function importParticipants(
  parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl' | 'notes' | 'additionalDetails' | 'classGrade'>[]
): Promise<{ count: number; errors: number; detectedNewSchools: string[]; detectedNewCommittees: string[] }> {
  let importedCount = 0;
  let errorCount = 0;
  const detectedNewSchoolNames: Set<string> = new Set();
  const detectedNewCommitteeNames: Set<string> = new Set();

  const batch = writeBatch(db);
  const defaultStatus = await getDefaultAttendanceStatusSetting();

  let existingSystemSchools: string[] = [];
  let existingSystemCommittees: string[] = [];
  try {
    existingSystemSchools = await getSystemSchools(); 
    existingSystemCommittees = await getSystemCommittees(); 
  } catch(e) {
    console.error("[Server Action: importParticipants] Error fetching system schools/committees during import pre-check:", e);
  }

  for (const data of parsedParticipants) {
    try {
      const trimmedSchool = data.school.trim();
      const trimmedCommittee = data.committee.trim();

      if (trimmedSchool && !existingSystemSchools.includes(trimmedSchool)) {
        detectedNewSchoolNames.add(trimmedSchool);
      }
      if (trimmedCommittee && !existingSystemCommittees.includes(trimmedCommittee)) {
        detectedNewCommitteeNames.add(trimmedCommittee);
      }

      const nameInitial = (data.name.trim() || 'P').substring(0,2).toUpperCase();
      const newParticipant: Omit<Participant, 'id'> = {
        name: data.name.trim(),
        school: trimmedSchool,
        committee: trimmedCommittee,
        status: defaultStatus,
        imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
        notes: '',
        additionalDetails: '',
        classGrade: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION));
      batch.set(participantRef, newParticipant);
      importedCount++;
    } catch (error) {
      console.error("[Server Action: importParticipants] Error preparing participant for batch import: ", data, error);
      errorCount++;
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error("[Server Action: importParticipants] Error committing batch import: ", error);
    const firebaseError = error as { code?: string; message?: string };
    const batchCommitError = `Batch commit for participants failed (Server Action). Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This likely means the security rules for writing to '${PARTICIPANTS_COLLECTION}' were not met (e.g. isAdmin() or isOwner() failed due to auth context).`;
    console.error(batchCommitError);
    return {
      count: 0,
      errors: parsedParticipants.length, 
      detectedNewSchools: Array.from(detectedNewSchoolNames),
      detectedNewCommittees: Array.from(detectedNewCommitteeNames),
    };
  }

  if (importedCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
  }
  return {
    count: importedCount,
    errors: errorCount,
    detectedNewSchools: Array.from(detectedNewSchoolNames),
    detectedNewCommittees: Array.from(detectedNewCommitteeNames),
  };
}

// Admin Management Actions (Superior Admin)
export async function getAdminUsers(): Promise<AdminManagedUser[]> {
  try {
    const usersColRef = collection(db, USERS_COLLECTION);
    const q = query(usersColRef, where('role', '==', 'admin'), orderBy('email'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        avatarUrl: data.avatarUrl,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as AdminManagedUser;
    });
  } catch (error) {
    console.error('[Server Action] Error fetching admin users:', error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch admin users (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${USERS_COLLECTION}'. Ensure owner (UID: ${OWNER_UID}) has list permission OR this server action runs as Owner. (isOwner() rule will likely fail here).`);
  }
}

export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }
  const trimmedAuthUid = authUid.trim();
  if (!trimmedAuthUid) {
    return { success: false, message: 'Auth UID cannot be empty.' };
  }

  const userDocRefByUid = doc(db, USERS_COLLECTION, trimmedAuthUid);

  try {
    const userDocSnapByUid = await getDoc(userDocRefByUid); 
    const currentEmail = email.toLowerCase().trim();
    const currentDisplayName = displayName?.trim() || null;

    if (userDocSnapByUid.exists()) {
      const dataFields = userDocSnapByUid.data();
      const existingAdminObject: AdminManagedUser = {
        id: userDocSnapByUid.id,
        email: dataFields.email,
        displayName: dataFields.displayName,
        role: dataFields.role,
        createdAt: dataFields.createdAt instanceof Timestamp ? dataFields.createdAt.toDate().toISOString() : dataFields.createdAt,
        updatedAt: dataFields.updatedAt instanceof Timestamp ? dataFields.updatedAt.toDate().toISOString() : dataFields.updatedAt,
        avatarUrl: dataFields.avatarUrl,
      };

      if (existingAdminObject.role === 'admin') {
        const updates: Partial<AdminManagedUser> = {};
        let changed = false;
        if (currentEmail !== existingAdminObject.email) { updates.email = currentEmail; changed = true; }
        if (currentDisplayName !== existingAdminObject.displayName) { updates.displayName = currentDisplayName; changed = true; }
        if (changed) {
          await updateDoc(userDocRefByUid, {...updates, updatedAt: serverTimestamp()}); 
          revalidatePath('/superior-admin/admin-management');
          return { success: true, message: `User ${trimmedAuthUid} is already an admin. Details updated.`, admin: {...existingAdminObject, ...updates, updatedAt: new Date().toISOString() } };
        }
        return { success: true, message: `User ${trimmedAuthUid} is already an admin. No changes made.`, admin: existingAdminObject };
      } else {
        const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
        const updatedFields = { email: currentEmail, displayName: currentDisplayName, role: 'admin' as const, avatarUrl: dataFields.avatarUrl || `https://placehold.co/40x40.png?text=${firstLetter}`, updatedAt: serverTimestamp() };
        await updateDoc(userDocRefByUid, updatedFields); 
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to user ${trimmedAuthUid}.`, admin: { ...existingAdminObject, ...updatedFields, updatedAt: new Date().toISOString() } };
      }
    } else {
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', currentEmail), where('role', '==', 'admin'));
      const emailQuerySnapshot = await getDocs(qEmail); 
      if (!emailQuerySnapshot.empty) {
          const conflictingUserDoc = emailQuerySnapshot.docs[0];
          return { success: false, message: `Error: Email ${currentEmail} is already associated with a different admin (UID: ${conflictingUserDoc.id}). Please use a unique email or resolve the conflict.` };
      }
      const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
      const newAdminDataFields = { email: currentEmail, displayName: currentDisplayName, role: 'admin' as const, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`};
      await setDoc(userDocRefByUid, newAdminDataFields); 
      revalidatePath('/superior-admin/admin-management');
      return { success: true, message: `User ${trimmedAuthUid} granted admin role.`, admin: { id: trimmedAuthUid, ...newAdminDataFields, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    }
  } catch (error) {
    console.error(`[Server Action] Error granting admin role to UID ${trimmedAuthUid}:`, error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to grant admin role (Server Action). Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules allow writes to '${USERS_COLLECTION}/${trimmedAuthUid}' from server context or use Admin SDK. (isOwner() rule will likely fail here).`;
    console.error(detailedError);
    return { success: false, message: detailedError };
  }
}

export async function revokeAdminRole(adminId: string): Promise<{ success: boolean; message: string }> {
  if (!adminId) { return { success: false, message: 'Admin Auth UID (adminId) is required.' }; }
  const adminDocRef = doc(db, USERS_COLLECTION, adminId);
  try {
    const adminDocSnap = await getDoc(adminDocRef); 
    if (!adminDocSnap.exists()) { return { success: false, message: `Admin with Auth UID ${adminId} not found in roles collection, or role already revoked.` }; }
    await deleteDoc(adminDocRef); 
    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}. (User record in roles removed)` };
  } catch (error) {
    console.error(`[Server Action] Error revoking admin role for UID ${adminId}:`, error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to revoke admin role (Server Action). Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules allow deletes from '${USERS_COLLECTION}' from server context or use Admin SDK. (isOwner() rule will likely fail here).`;
    console.error(detailedError);
    return { success: false, message: detailedError };
  }
}

export async function bulkDeleteParticipants(participantIds: string[]): Promise<{ successCount: number; errorCount: number; errorMessage?: string }> {
  if (!participantIds || participantIds.length === 0) {
    return { successCount: 0, errorCount: 0 };
  }
  const batch = writeBatch(db);
  let successCount = 0;
  participantIds.forEach(id => {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, id);
    batch.delete(participantRef);
    successCount++;
  });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath('/public');
  } catch (error) {
    console.error("[Server Action: bulkDeleteParticipants] Error committing batch delete: ", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to bulk delete participants (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'. Requires user-based permissions (isAdmin or isOwner), which likely fail in server action context.`;
    console.error(detailedError);
    return {
      successCount: 0,
      errorCount: participantIds.length,
      errorMessage: detailedError
    };
  }
  return { successCount, errorCount: 0 };
}


// Staff Member Actions
export async function getStaffMembers(filters?: { department?: string; team?: string; searchTerm?: string; status?: StaffAttendanceStatus | 'All' }): Promise<StaffMember[]> {
  try {
    const staffColRef = collection(db, STAFF_MEMBERS_COLLECTION);
    const queryConstraints = [];

    if (filters?.department && filters.department !== "All Departments") {
      queryConstraints.push(where('department', '==', filters.department));
    }
    if (filters?.team && filters.team !== "All Teams") {
        queryConstraints.push(where('team', '==', filters.team));
    }
    if (filters?.status && filters.status !== 'All') {
      queryConstraints.push(where('status', '==', filters.status));
    }

    const q = query(staffColRef, ...queryConstraints, orderBy('name'));
    const querySnapshot = await getDocs(q);

    let staffData = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || '',
        role: data.role || '',
        department: data.department,
        team: data.team,
        contactInfo: data.contactInfo,
        status: data.status || 'Off Duty',
        imageUrl: data.imageUrl,
        notes: data.notes,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as StaffMember;
    });

    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      staffData = staffData.filter(s =>
        s.name.toLowerCase().includes(term) ||
        (s.role && s.role.toLowerCase().includes(term)) ||
        (s.department && s.department.toLowerCase().includes(term)) ||
        (s.team && s.team.toLowerCase().includes(term))
      );
    }
    return staffData;
  } catch (error) {
    console.error("[Server Action] Error fetching staff members: ", error);
    const firebaseError = error as { code?: string; message?: string };
    let detailedMessage = `Failed to fetch staff members (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}.`;
    if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index')) {
      detailedMessage += " This often indicates a missing Firestore index for staff_members.";
    } else if (firebaseError.code === 'permission-denied') {
        detailedMessage += " PERMISSION_DENIED. Firestore security rules are blocking this read for staff members. Ensure server action context can read.";
    } else {
      detailedMessage += ` Details: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'.`;
    }
    throw new Error(detailedMessage);
  }
}

export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  try {
    const staffMemberRef = doc(db, STAFF_MEMBERS_COLLECTION, id);
    const docSnap = await getDoc(staffMemberRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || '',
        role: data.role || '',
        department: data.department,
        team: data.team,
        contactInfo: data.contactInfo,
        status: data.status || 'Off Duty',
        imageUrl: data.imageUrl,
        notes: data.notes,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as StaffMember;
    }
    return null;
  } catch (error) {
    console.error(`[Server Action] Error fetching staff member by ID ${id}: `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch staff member (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'.`);
  }
}

export async function deleteStaffMember(staffMemberId: string): Promise<{ success: boolean }> {
  try {
    const staffMemberRef = doc(db, STAFF_MEMBERS_COLLECTION, staffMemberId);
    await deleteDoc(staffMemberRef);
    revalidatePath('/staff');
    revalidatePath(`/staff/${staffMemberId}`);
    revalidatePath('/superior-admin');
    return { success: true };
  } catch (error) {
    console.error("[Server Action] Error deleting staff member: ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to delete staff member (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'. Requires user-based permissions, likely fails in server action context.`);
  }
}
