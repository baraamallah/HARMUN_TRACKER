
'use server';

import { revalidatePath } from 'next/cache';
import { db, auth } from './firebase'; // auth from client SDK is imported but auth.currentUser will be null on server.
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

// IMPORTANT NOTE ON SERVER ACTIONS AND FIREBASE AUTHENTICATION:
// Server Actions in this file use the Firebase CLIENT SDK's 'db' instance.
// When these actions perform Firestore operations, the 'request.auth' object
// in your Firestore Security Rules might NOT be populated with the end-user's UID
// who initiated the action on the client. Instead, it might be null or represent
// a default server identity.
// This means security rules like 'allow read: if request.auth != null;' or
// 'allow write: if request.auth.uid == resource.data.userId;' or custom functions
// like 'isAdmin()' / 'isOwner()' that check 'request.auth.uid' might fail,
// leading to PERMISSION_DENIED errors.
//
// The 'auth' object imported from './firebase' is also the CLIENT SDK's auth.
// Calling 'auth.currentUser' within these server actions will result in 'null'
// because the server environment doesn't share the client's browser session.
//
// TO PROPERLY SECURE OPERATIONS AND USE USER-SPECIFIC PERMISSIONS:
// 1. The client should send the user's Firebase ID Token to the Server Action.
// 2. The Server Action should use the Firebase ADMIN SDK (not currently in this project)
//    to verify the ID Token.
// 3. Operations should then be performed using the Firebase Admin SDK, which can
//    either operate with full admin privileges or be configured to respect
//    security rules based on the verified user.
//
// The current implementation might only work correctly if Firestore security rules
// are very permissive for server-side operations or if a future Next.js/Firebase
// integration handles auth context propagation differently for client SDK usage on server.
// For now, expect PERMISSION_DENIED if rules depend on specific 'request.auth.uid'.


// System Settings Actions
export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Attempting to read default status.`);
  // This is a read operation. If rules allow public read or server identity read, it might work.
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    return 'Absent';
  } catch (error) {
    console.error("Error fetching default attendance status setting: ", error);
    return 'Absent'; // Default fallback
  }
}

export async function updateDefaultAttendanceStatusSetting(newStatus: AttendanceStatus): Promise<{success: boolean, error?: string}> {
  console.log(`[Server Action - updateDefaultAttendanceStatusSetting] Attempting to update default status to: ${newStatus}.`);
  // This is a write operation. Firestore rules for SYSTEM_CONFIG_COLLECTION must allow writes
  // from the identity the server action runs as (likely not the end-user's OWNER_UID via request.auth).
  // The rule 'allow write: if isOwner()' will likely fail here.
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    await setDoc(configDocRef, { defaultAttendanceStatus: newStatus }, { merge: true });
    revalidatePath('/superior-admin/system-settings');
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/staff');
    return { success: true };
  } catch (error) {
    console.error("Error updating default attendance status setting: ", error);
    const firebaseError = error as { code?: string; message?: string };
    // This detailed error message is good.
    return {
        success: false,
        error: `CRITICAL PERMISSION_DENIED: Firebase Firestore Security Rules in your project console are blocking this action. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure the rules PUBLISHED there allow the Owner (UID: ${OWNER_UID}) to write to '${SYSTEM_CONFIG_COLLECTION}/${APP_SETTINGS_DOC_ID}'. The correct rules are in the README.md. *** YOU MUST FIX THIS IN THE FIREBASE CONSOLE. *** Or, this server action is not running as the 'Owner'.`
    };
  }
}


// Participant Actions
export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  // Read operation. If rules allow public read (allow read: if true;), this will work.
  // If rules require auth (allow read: if request.auth != null;), it might fail from a server action.
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
        "Error fetching participants from Firestore (Server Action). Active filters:",
        filters,
        "Underlying error:",
        error
      );
      const firebaseError = error as { code?: string; message?: string };
      let detailedMessage = `Failed to fetch participants from Firestore (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}.`;

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
  // Read operation.
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
    console.error(`Error fetching participant by ID ${id} (Server Action): `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch participant (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'.`);
  }
}


export async function deleteParticipant(participantId: string): Promise<{ success: boolean }> {
  // Write operation. Rules 'allow write: if isOwner() || isAdmin();' will likely fail.
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await deleteDoc(participantRef);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath(`/participants/${participantId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting participant (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to delete participant (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'. This action likely requires Admin SDK or client-side execution for user-based permissions.`);
  }
}

export async function markAttendance(participantId: string, status: AttendanceStatus): Promise<Participant | null> {
  // Write operation. Rules 'allow write: if isOwner() || isAdmin();' will likely fail.
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await updateDoc(participantRef, { status, updatedAt: serverTimestamp() });
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath(`/participants/${participantId}`);
     const updatedDocSnap = await getDoc(participantRef);
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
       } as Participant;
    }
    return null;
  } catch (error) {
    console.error("Error marking attendance (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to mark attendance (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'. This action likely requires Admin SDK or client-side execution.`);
  }
}

// System School Actions
export async function getSystemSchools(): Promise<string[]> {
  // Read operation.
  try {
    const schoolsColRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
    const schoolsSnapshot = await getDocs(query(schoolsColRef, orderBy('name')));
    return schoolsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system schools (Server Action): ", error);
    throw new Error("Failed to fetch system schools (Server Action). Check Firestore rules and connectivity.");
  }
}

export async function deleteSystemSchool(schoolName: string): Promise<{ success: boolean, error?: string }> {
  // Write operation. Rule 'allow write: if isOwner()' will likely fail.
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
    console.error("Error deleting system school (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    return { success: false, error: `Failed to delete school (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${SYSTEM_SCHOOLS_COLLECTION}'. isOwner() rule will likely fail here.` };
  }
}


// System Committee Actions
export async function getSystemCommittees(): Promise<string[]> {
  // Read operation.
  try {
    const committeesColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
    const committeesSnapshot = await getDocs(query(committeesColRef, orderBy('name')));
    return committeesSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system committees (Server Action): ", error);
    throw new Error("Failed to fetch system committees (Server Action). Check Firestore rules and connectivity.");
  }
}

export async function deleteSystemCommittee(committeeName: string): Promise<{ success: boolean, error?: string }> {
  // Write operation. Rule 'allow write: if isOwner()' will likely fail.
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
    console.error("Error deleting system committee (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    return { success: false, error: `Failed to delete committee (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${SYSTEM_COMMITTEES_COLLECTION}'. isOwner() rule will likely fail here.` };
  }
}

// System Staff Teams Actions
export async function getSystemStaffTeams(): Promise<string[]> {
  // Read operation.
  try {
    const staffTeamsColRef = collection(db, SYSTEM_STAFF_TEAMS_COLLECTION);
    const staffTeamsSnapshot = await getDocs(query(staffTeamsColRef, orderBy('name')));
    return staffTeamsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system staff teams (Server Action): ", error);
    throw new Error("Failed to fetch system staff teams (Server Action). Check Firestore rules and connectivity.");
  }
}

export async function deleteSystemStaffTeam(teamName: string): Promise<{ success: boolean, error?: string }> {
  // Write operation. Rule 'allow write: if isOwner()' will likely fail.
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
    console.error("Error deleting system staff team (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    return { success: false, error: `Failed to delete staff team (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${SYSTEM_STAFF_TEAMS_COLLECTION}'. isOwner() rule will likely fail here.` };
  }
}


// Import Participants Action
export async function importParticipants(
  parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl' | 'notes' | 'additionalDetails' | 'classGrade'>[]
): Promise<{ count: number; errors: number; detectedNewSchools: string[]; detectedNewCommittees: string[] }> {
  // Write (batch) operation. Rules 'allow write: if isOwner() || isAdmin();' for each participant will likely fail.
  let importedCount = 0;
  let errorCount = 0;
  const detectedNewSchoolNames: Set<string> = new Set();
  const detectedNewCommitteeNames: Set<string> = new Set();

  const batch = writeBatch(db);
  const defaultStatus = await getDefaultAttendanceStatusSetting();

  let existingSystemSchools: string[] = [];
  let existingSystemCommittees: string[] = [];
  try {
    existingSystemSchools = await getSystemSchools(); // This is a read, might work.
    existingSystemCommittees = await getSystemCommittees(); // This is a read, might work.
  } catch(e) {
    console.error("[Server Action: importParticipants] Error fetching system schools/committees during import pre-check:", e);
    // If this fails, new school/committee detection won't work, but import might proceed.
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
    // Overwrite counts to reflect total failure if batch commit fails
    return {
      count: 0,
      errors: parsedParticipants.length, // All attempted imports are now errors
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
  // Read operation. Rule 'allow list: if isOwner();' on /users collection will likely fail.
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
    console.error('Error fetching admin users (Server Action):', error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch admin users (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${USERS_COLLECTION}'. Ensure owner (UID: ${OWNER_UID}) has list permission OR this server action runs as Owner.`);
  }
}

export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  // Write operation. Rule 'allow write: if isOwner();' for /users/{userId} will likely fail.
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }
  const trimmedAuthUid = authUid.trim();
  if (!trimmedAuthUid) {
    return { success: false, message: 'Auth UID cannot be empty.' };
  }

  const userDocRefByUid = doc(db, USERS_COLLECTION, trimmedAuthUid);

  try {
    const userDocSnapByUid = await getDoc(userDocRefByUid); // Read part
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
          await updateDoc(userDocRefByUid, {...updates, updatedAt: serverTimestamp()}); // Write part
          revalidatePath('/superior-admin/admin-management');
          return { success: true, message: `User ${trimmedAuthUid} is already an admin. Details updated.`, admin: {...existingAdminObject, ...updates, updatedAt: new Date().toISOString() } };
        }
        return { success: true, message: `User ${trimmedAuthUid} is already an admin. No changes made.`, admin: existingAdminObject };
      } else {
        // User exists but not admin, promote.
        const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
        const updatedFields = { email: currentEmail, displayName: currentDisplayName, role: 'admin' as const, avatarUrl: dataFields.avatarUrl || `https://placehold.co/40x40.png?text=${firstLetter}`, updatedAt: serverTimestamp() };
        await updateDoc(userDocRefByUid, updatedFields); // Write part
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to user ${trimmedAuthUid}.`, admin: { ...existingAdminObject, ...updatedFields, updatedAt: new Date().toISOString() } };
      }
    } else {
      // User does not exist in /users collection. Check for email conflict before creating.
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', currentEmail), where('role', '==', 'admin'));
      const emailQuerySnapshot = await getDocs(qEmail); // Read part
      if (!emailQuerySnapshot.empty) {
          const conflictingUserDoc = emailQuerySnapshot.docs[0];
          return { success: false, message: `Error: Email ${currentEmail} is already associated with a different admin (UID: ${conflictingUserDoc.id}). Please use a unique email or resolve the conflict.` };
      }
      // Create new admin user document
      const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
      const newAdminDataFields = { email: currentEmail, displayName: currentDisplayName, role: 'admin' as const, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`};
      await setDoc(userDocRefByUid, newAdminDataFields); // Write part
      revalidatePath('/superior-admin/admin-management');
      return { success: true, message: `User ${trimmedAuthUid} granted admin role.`, admin: { id: trimmedAuthUid, ...newAdminDataFields, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    }
  } catch (error) {
    console.error(`Error granting admin role to UID ${trimmedAuthUid} (Server Action):`, error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `CRITICAL PERMISSION_DENIED (Server Action): Firebase Firestore Security Rules are blocking this action for user ${trimmedAuthUid}. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure the rules allow the Owner to write to '${USERS_COLLECTION}/${trimmedAuthUid}' OR this server action runs as Owner. isOwner() rule will likely fail here.`;
    console.error(detailedError);
    return { success: false, message: detailedError };
  }
}

export async function revokeAdminRole(adminId: string): Promise<{ success: boolean; message: string }> {
  // Write operation. Rule 'allow write: if isOwner();' for /users/{userId} (delete is a write) will likely fail.
  if (!adminId) { return { success: false, message: 'Admin Auth UID (adminId) is required.' }; }
  const adminDocRef = doc(db, USERS_COLLECTION, adminId);
  try {
    const adminDocSnap = await getDoc(adminDocRef); // Read part
    if (!adminDocSnap.exists()) { return { success: false, message: `Admin with Auth UID ${adminId} not found in roles collection, or role already revoked.` }; }
    await deleteDoc(adminDocRef); // Write part
    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}. (User record in roles removed)` };
  } catch (error) {
    console.error(`Error revoking admin role for UID ${adminId} (Server Action):`, error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `CRITICAL PERMISSION_DENIED (Server Action): Firebase Firestore Security Rules are blocking this action for user ${adminId}. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure the rules allow the Owner to delete from '${USERS_COLLECTION}' OR this server action runs as Owner. isOwner() rule will likely fail here.`;
    console.error(detailedError);
    return { success: false, message: detailedError };
  }
}

export async function bulkMarkAttendance(participantIds: string[], status: AttendanceStatus): Promise<{ successCount: number; errorCount: number }> {
  // Write (batch) operation. Rules 'allow write: if isOwner() || isAdmin();' for each participant will likely fail.
  if (!participantIds || participantIds.length === 0) { return { successCount: 0, errorCount: 0 }; }
  const batch = writeBatch(db);
  let successCount = 0;
  let errorCount = 0; // Local error count for preparing batch
  participantIds.forEach(id => {
    try {
      const participantRef = doc(db, PARTICIPANTS_COLLECTION, id);
      batch.update(participantRef, { status, updatedAt: serverTimestamp() });
      successCount++;
    } catch (e) {
      console.error(`[Server Action - bulkMarkAttendance] Error preparing update for participant ${id}:`, e);
      errorCount++; // Increment local error count
    }
  });

  if (errorCount > 0) { // If errors occurred during batch preparation
      throw new Error(`Failed to prepare ${errorCount} participant(s) for bulk status update. Check server logs.`);
  }

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath('/public');
    participantIds.forEach(id => revalidatePath(`/participants/${id}`));
  } catch (error) {
    console.error("[Server Action: bulkMarkAttendance] Error committing batch update: ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to bulk mark attendance (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'. This action requires user-based permissions (isAdmin or isOwner).`);
  }
  return { successCount, errorCount: 0 }; // errorCount is 0 if commit was successful
}

export async function bulkDeleteParticipants(participantIds: string[]): Promise<{ successCount: number; errorCount: number; errorMessage?: string }> {
  // Write (batch) operation. Rules 'allow write: if isOwner() || isAdmin();' for each participant will likely fail.
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
    return {
      successCount: 0,
      errorCount: participantIds.length,
      errorMessage: `Failed to bulk delete participants (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'. Requires user-based permissions (isAdmin or isOwner).`
    };
  }
  return { successCount, errorCount: 0 };
}


// Staff Member Actions
export async function getStaffMembers(filters?: { department?: string; team?: string; searchTerm?: string; status?: StaffAttendanceStatus | 'All' }): Promise<StaffMember[]> {
  // Read operation.
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
    console.error("Error fetching staff members (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    let detailedMessage = `Failed to fetch staff members (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}.`;
    if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index')) {
      detailedMessage += " This often indicates a missing Firestore index for staff_members.";
    } else if (firebaseError.code === 'permission-denied') {
        detailedMessage += " PERMISSION_DENIED. Firestore security rules are blocking this read for staff members.";
    } else {
      detailedMessage += ` Details: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'.`;
    }
    throw new Error(detailedMessage);
  }
}

export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  // Read operation.
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
    console.error(`Error fetching staff member by ID ${id} (Server Action): `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch staff member (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'.`);
  }
}

export async function deleteStaffMember(staffMemberId: string): Promise<{ success: boolean }> {
  // Write operation. Rules 'allow write: if isOwner() || isAdmin();' will likely fail.
  try {
    const staffMemberRef = doc(db, STAFF_MEMBERS_COLLECTION, staffMemberId);
    await deleteDoc(staffMemberRef);
    revalidatePath('/staff');
    revalidatePath(`/staff/${staffMemberId}`);
    revalidatePath('/superior-admin');
    return { success: true };
  } catch (error) {
    console.error("Error deleting staff member (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to delete staff member (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'. Requires user-based permissions.`);
  }
}

export async function markStaffMemberStatus(staffMemberId: string, status: StaffAttendanceStatus): Promise<StaffMember | null> {
  // Write operation. Rules 'allow write: if isOwner() || isAdmin();' will likely fail.
  try {
    const staffMemberRef = doc(db, STAFF_MEMBERS_COLLECTION, staffMemberId);
    await updateDoc(staffMemberRef, { status, updatedAt: serverTimestamp() });
    revalidatePath('/staff');
    revalidatePath(`/staff/${staffMemberId}`);
    revalidatePath('/superior-admin');
    const updatedDocSnap = await getDoc(staffMemberRef);
    if (updatedDocSnap.exists()) {
      const data = updatedDocSnap.data();
      return {
        id: updatedDocSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as StaffMember;
    }
    return null;
  } catch (error) {
    console.error("Error marking staff member status (Server Action): ", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to mark staff member status (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'. Requires user-based permissions.`);
  }
}
