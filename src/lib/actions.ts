
'use server';

import { revalidatePath } from 'next/cache';
import { db, auth } from './firebase'; // Import Firestore instance and auth
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
import type { Participant, AttendanceStatus, AdminManagedUser } from '@/types';
import { OWNER_UID } from './constants';


const PARTICIPANTS_COLLECTION = 'participants';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const USERS_COLLECTION = 'users';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


// System Settings Actions
export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Attempting to read default status.`);
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] auth.currentUser from firebase.ts:`, auth.currentUser);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    console.log(`Attempting to read from Firestore path: ${configDocRef.path}`);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    return 'Absent'; // Fallback default status
  } catch (error) {
    console.error("Error fetching default attendance status setting: ", error);
    console.error("Full Firebase Error details for getDefaultAttendanceStatusSetting:", error);
    return 'Absent'; // Fallback on error
  }
}

export async function updateDefaultAttendanceStatusSetting(newStatus: AttendanceStatus): Promise<{success: boolean, error?: string}> {
  console.log(`[Server Action - updateDefaultAttendanceStatusSetting] Attempting to update default status to: ${newStatus}.`);
  console.log(`[Server Action - updateDefaultAttendanceStatusSetting] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - updateDefaultAttendanceStatusSetting] auth.currentUser from firebase.ts:`, auth.currentUser);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    console.log(`Attempting to write to Firestore path: ${configDocRef.path}`);
    await setDoc(configDocRef, { defaultAttendanceStatus: newStatus }, { merge: true });
    revalidatePath('/superior-admin/system-settings');
    revalidatePath('/');
    revalidatePath('/public');
    return { success: true };
  } catch (error) {
    console.error("Error updating default attendance status setting: ", error);
    console.error("Full Firebase Error details for updateDefaultAttendanceStatusSetting:", error);
    const firebaseError = error as { code?: string; message?: string };
    return {
        success: false,
        error: `CRITICAL PERMISSION_DENIED: Firebase Firestore Security Rules in your project console are blocking this action. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure the rules PUBLISHED there allow the Owner (UID: ${OWNER_UID}) to write to '${SYSTEM_CONFIG_COLLECTION}/${APP_SETTINGS_DOC_ID}'. The correct rules are in the README.md. *** YOU MUST FIX THIS IN THE FIREBASE CONSOLE. ***`
    };
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
    console.log(`Attempting to read from Firestore path: ${participantsColRef.path} with filters/orderBy`);

    const querySnapshot = await getDocs(q);
    let participantsData = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Participant));

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
        "Error fetching participants from Firestore. Active filters:",
        filters,
        "Underlying error:",
        error
      );
      console.error("Full Firebase Error details for getParticipants:", error);
      const firebaseError = error as { code?: string; message?: string };
      let detailedMessage = `Failed to fetch participants from Firestore. Firebase Code: ${firebaseError.code || 'Unknown'}.`;

      if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index') || firebaseError.message?.includes('The query requires an index')) {
        detailedMessage += " This often indicates a missing Firestore index. Please check your browser's developer console for a Firestore error message that might include a link to create the required index in your Firebase project console.";
      } else {
        detailedMessage += ` Details: ${firebaseError.message || String(error)}. This could also be a Firestore Security Rules issue preventing reads. Check the README.md for rules.`;
      }
      throw new Error(detailedMessage);
  }
}

export async function addParticipant(participantData: Omit<Participant, 'id' | 'status' | 'imageUrl'>): Promise<Participant | null> {
  console.log(`[Server Action - addParticipant] Attempting to add participant: ${participantData.name}.`);
  console.log(`[Server Action - addParticipant] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - addParticipant] auth.currentUser from firebase.ts:`, auth.currentUser);
  try {
    const defaultStatus = await getDefaultAttendanceStatusSetting();
    const nameInitial = (participantData.name.trim() || 'P').substring(0,2).toUpperCase();
    const newParticipantData = {
      ...participantData,
      name: participantData.name.trim(),
      school: participantData.school.trim(),
      committee: participantData.committee.trim(),
      status: defaultStatus,
      imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
      createdAt: serverTimestamp()
    };
    const participantsColRef = collection(db, PARTICIPANTS_COLLECTION);
    console.log(`Attempting to write to Firestore path: ${participantsColRef.path} (addParticipant)`);
    const docRef = await addDoc(participantsColRef, newParticipantData);
    revalidatePath('/');
    revalidatePath('/public');
    return { id: docRef.id, ...newParticipantData, createdAt: Timestamp.now() } as Participant;
  } catch (error) {
    console.error("Error adding participant: ", error);
    console.error("Full Firebase Error details for addParticipant:", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to add participant. Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This might be because auth.currentUser is null in the server action context if called from another server action, or rules do not permit. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'.`);
  }
}

export async function updateParticipant(participantId: string, participantData: Partial<Omit<Participant, 'id'>>): Promise<Participant | null> {
  console.log(`[Server Action - updateParticipant] Attempting to update participant: ${participantId}.`);
  console.log(`[Server Action - updateParticipant] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - updateParticipant] auth.currentUser from firebase.ts:`, auth.currentUser);
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    console.log(`Attempting to write to Firestore path: ${participantRef.path} (updateParticipant)`);
    await updateDoc(participantRef, {...participantData, updatedAt: serverTimestamp()});
    revalidatePath('/');
    revalidatePath('/public');
    const updatedDocSnap = await getDoc(participantRef);
    if (updatedDocSnap.exists()) {
      return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as Participant;
    }
    return null;
  } catch (error) {
    console.error("Error updating participant: ", error);
    console.error("Full Firebase Error details for updateParticipant:", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to update participant. Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'.`);
  }
}

export async function deleteParticipant(participantId: string): Promise<{ success: boolean }> {
  console.log(`[Server Action - deleteParticipant] Attempting to delete participant: ${participantId}.`);
  console.log(`[Server Action - deleteParticipant] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - deleteParticipant] auth.currentUser from firebase.ts:`, auth.currentUser);
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    console.log(`Attempting to write to Firestore path: ${participantRef.path} (deleteParticipant)`);
    await deleteDoc(participantRef);
    revalidatePath('/');
    revalidatePath('/public');
    return { success: true };
  } catch (error) {
    console.error("Error deleting participant: ", error);
    console.error("Full Firebase Error details for deleteParticipant:", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to delete participant. Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'.`);
  }
}

export async function markAttendance(participantId: string, status: AttendanceStatus): Promise<Participant | null> {
  console.log(`[Server Action - markAttendance] Attempting to mark attendance for: ${participantId} to ${status}.`);
  console.log(`[Server Action - markAttendance] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - markAttendance] auth.currentUser from firebase.ts:`, auth.currentUser);
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    console.log(`Attempting to write to Firestore path: ${participantRef.path} (markAttendance)`);
    await updateDoc(participantRef, { status, updatedAt: serverTimestamp() });
    revalidatePath('/');
    revalidatePath('/public');
     const updatedDocSnap = await getDoc(participantRef);
    if (updatedDocSnap.exists()) {
      return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as Participant;
    }
    return null;
  } catch (error) {
    console.error("Error marking attendance: ", error);
    console.error("Full Firebase Error details for markAttendance:", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to mark attendance. Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}'.`);
  }
}

// System School Actions
export async function getSystemSchools(): Promise<string[]> {
  try {
    const schoolsColRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
    console.log(`Attempting to read from Firestore path: ${schoolsColRef.path} (getSystemSchools)`);
    const schoolsSnapshot = await getDocs(query(schoolsColRef, orderBy('name')));
    return schoolsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system schools: ", error);
    console.error("Full Firebase Error details for getSystemSchools:", error);
    throw new Error("Failed to fetch system schools. Check Firestore rules and connectivity.");
  }
}

// This server action is NO LONGER CALLED by the Superior Admin UI for adding schools.
// It might be called by other server actions like importParticipants (if that logic is restored).
// BEWARE: auth.currentUser will be null in this server action context.
export async function addSystemSchool(schoolName: string): Promise<{success: boolean, id?: string, error?: string}> {
  const trimmedSchoolName = schoolName.trim();
  console.log(`[Server Action - addSystemSchool] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - addSystemSchool] auth.currentUser from firebase.ts:`, auth.currentUser);
  if (!trimmedSchoolName) {
    return {success: false, error: "School name cannot be empty."};
  }
  const schoolColRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
  console.log(`Attempting to write to Firestore path: ${schoolColRef.path} (addSystemSchool) with name: ${trimmedSchoolName}`);
  try {
    const docRef = await addDoc(schoolColRef, {
      name: trimmedSchoolName,
      createdAt: serverTimestamp()
    });
    revalidatePath('/superior-admin');
    revalidatePath('/');
    revalidatePath('/public');
    return {success: true, id: docRef.id};
  } catch (error) {
    console.error(`Error adding system school "${trimmedSchoolName}": `, error);
    console.error("Full Firebase Error details for addSystemSchool:", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to add system school. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This might be because auth.currentUser is null in the server action context. Check server logs. Ensure the rules PUBLISHED there allow the Owner (UID: ${OWNER_UID}) to write to the '${SYSTEM_SCHOOLS_COLLECTION}' collection.`;
    console.error(detailedError);
    return {
        success: false,
        error: detailedError
    };
  }
}

// System Committee Actions
export async function getSystemCommittees(): Promise<string[]> {
  try {
    const committeesColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
    console.log(`Attempting to read from Firestore path: ${committeesColRef.path} (getSystemCommittees)`);
    const committeesSnapshot = await getDocs(query(committeesColRef, orderBy('name')));
    return committeesSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system committees: ", error);
    console.error("Full Firebase Error details for getSystemCommittees:", error);
    throw new Error("Failed to fetch system committees. Check Firestore rules and connectivity.");
  }
}

// This server action is NO LONGER CALLED by the Superior Admin UI for adding committees.
// It might be called by other server actions like importParticipants (if that logic is restored).
// BEWARE: auth.currentUser will be null in this server action context.
export async function addSystemCommittee(committeeName: string): Promise<{success: boolean, id?: string, error?: string}> {
  const trimmedCommitteeName = committeeName.trim();
  console.log(`[Server Action - addSystemCommittee] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - addSystemCommittee] auth.currentUser from firebase.ts:`, auth.currentUser);
  if (!trimmedCommitteeName) {
    return {success: false, error: "Committee name cannot be empty."};
  }
  const committeeColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
  console.log(`Attempting to write to Firestore path: ${committeeColRef.path} (addSystemCommittee) with name: ${trimmedCommitteeName}`);
  try {
    const docRef = await addDoc(committeeColRef, {
      name: trimmedCommitteeName,
      createdAt: serverTimestamp()
    });
    revalidatePath('/superior-admin');
    revalidatePath('/');
    revalidatePath('/public');
    return {success: true, id: docRef.id};
  } catch (error) {
    console.error(`Error adding system committee "${trimmedCommitteeName}": `, error);
    console.error("Full Firebase Error details for addSystemCommittee:", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to add system committee. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This might be because auth.currentUser is null in the server action context. Check server logs. Ensure the rules PUBLISHED there allow the Owner (UID: ${OWNER_UID}) to write to the '${SYSTEM_COMMITTEES_COLLECTION}' collection.`;
    console.error(detailedError);
    return {
        success: false,
        error: detailedError
    };
  }
}


// Import Participants Action
export async function importParticipants(
  parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[]
): Promise<{ count: number; errors: number; detectedNewSchools: string[]; detectedNewCommittees: string[] }> {
  console.log(`[Server Action - importParticipants] Starting import for ${parsedParticipants.length} participants.`);
  console.log(`[Server Action - importParticipants] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - importParticipants] auth.currentUser from firebase.ts:`, auth.currentUser);

  let importedCount = 0;
  let errorCount = 0;
  const detectedNewSchoolNames: Set<string> = new Set();
  const detectedNewCommitteeNames: Set<string> = new Set();

  const batch = writeBatch(db);
  const defaultStatus = await getDefaultAttendanceStatusSetting();

  // Fetch existing system schools and committees to compare against
  // This is a read operation and should be allowed by rules if public read is true or user has access
  let existingSystemSchools: string[] = [];
  let existingSystemCommittees: string[] = [];
  try {
    existingSystemSchools = await getSystemSchools();
    existingSystemCommittees = await getSystemCommittees();
  } catch(e) {
    console.error("Error fetching system schools/committees during import pre-check:", e);
    // Proceed without this check if it fails, import will likely have issues with participant school/committee data consistency
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
        createdAt: serverTimestamp(),
      };
      const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION));
      // console.log(`Batch: adding to Firestore path: ${participantRef.path} (new participant in import)`);
      batch.set(participantRef, newParticipant);
      importedCount++;
    } catch (error) {
      console.error("Error preparing participant for batch import: ", data, error);
      console.error("Full Firebase Error details for preparing batch import:", error);
      errorCount++;
    }
  }

  try {
    console.log(`[Server Action - importParticipants] Attempting to commit batch of ${importedCount} participants.`);
    await batch.commit();
    console.log(`[Server Action - importParticipants] Batch commit successful.`);
  } catch (error) {
    console.error("Error committing batch import: ", error);
    console.error("Full Firebase Error details for batch.commit:", error);
    const firebaseError = error as { code?: string; message?: string };
    const batchCommitError = `Batch commit for participants failed. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This likely means the security rules for writing to '${PARTICIPANTS_COLLECTION}' were not met for the user context of this server action. Check server logs for 'auth.currentUser' and verify Firestore rules.`;
    console.error(batchCommitError);
    // If batch fails, none were imported successfully via this batch.
    return {
      count: 0,
      errors: parsedParticipants.length + errorCount, // All participants in this attempt + preparation errors
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
    console.log(`Attempting to read from Firestore path: ${usersColRef.path} with role='admin' filter (getAdminUsers)`);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        avatarUrl: data.avatarUrl
      } as AdminManagedUser;
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    console.error("Full Firebase Error details for getAdminUsers:", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch admin users. Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${USERS_COLLECTION}'. Ensure owner (UID: ${OWNER_UID}) has list permission.`);
  }
}

export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  console.log(`[Server Action - grantAdminRole] Attempting for UID: ${authUid}, Email: ${email}.`);
  console.log(`[Server Action - grantAdminRole] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - grantAdminRole] auth.currentUser from firebase.ts:`, auth.currentUser);
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }
  const trimmedAuthUid = authUid.trim();
  if (!trimmedAuthUid) {
    return { success: false, message: 'Auth UID cannot be empty.' };
  }

  const userDocRefByUid = doc(db, USERS_COLLECTION, trimmedAuthUid);
  console.log(`Attempting to write to Firestore path: ${userDocRefByUid.path} (grantAdminRole) for UID: ${trimmedAuthUid}`);

  try {
    const userDocSnapByUid = await getDoc(userDocRefByUid);

    const currentEmail = email.toLowerCase().trim();
    const currentDisplayName = displayName?.trim() || null;

    if (userDocSnapByUid.exists()) {
      const dataFields = userDocSnapByUid.data();
      const existingAdminObject: AdminManagedUser = { // Explicit construction
        id: userDocSnapByUid.id,
        email: dataFields.email,
        displayName: dataFields.displayName,
        role: dataFields.role,
        createdAt: dataFields.createdAt,
        updatedAt: dataFields.updatedAt,
        avatarUrl: dataFields.avatarUrl,
      };

      if (existingAdminObject.role === 'admin') {
        const updates: Partial<AdminManagedUser> = {};
        let changed = false;
        if (currentEmail !== existingAdminObject.email) {
          updates.email = currentEmail;
          changed = true;
        }
        if (currentDisplayName !== existingAdminObject.displayName) {
          updates.displayName = currentDisplayName;
          changed = true;
        }
        
        if (changed) {
          await updateDoc(userDocRefByUid, {...updates, updatedAt: serverTimestamp()});
          const updatedAdmin: AdminManagedUser = {...existingAdminObject, ...updates, updatedAt: Timestamp.now() };
          revalidatePath('/superior-admin/admin-management');
          return { success: true, message: `User ${trimmedAuthUid} is already an admin. Details updated.`, admin: updatedAdmin };
        }
        return { success: true, message: `User ${trimmedAuthUid} is already an admin. No changes made.`, admin: existingAdminObject };
      } else {
        const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
        const updatedFields = {
          email: currentEmail,
          displayName: currentDisplayName,
          role: 'admin' as const,
          avatarUrl: dataFields.avatarUrl || `https://placehold.co/40x40.png?text=${firstLetter}`,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(userDocRefByUid, updatedFields);
        const updatedAdminForReturn: AdminManagedUser = {
          ...existingAdminObject,
          ...updatedFields,
          updatedAt: Timestamp.now(),
        };
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to user ${trimmedAuthUid}.`, admin: updatedAdminForReturn };
      }
    } else {
      // Check if another admin already has this email - this is a business logic rule, not a Firestore one
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', currentEmail), where('role', '==', 'admin'));
      const emailQuerySnapshot = await getDocs(qEmail);
      if (!emailQuerySnapshot.empty) {
          const conflictingUserDoc = emailQuerySnapshot.docs[0];
          return { success: false, message: `Error: Email ${currentEmail} is already associated with a different admin (UID: ${conflictingUserDoc.id}). Please use a unique email or resolve the conflict.` };
      }

      const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
      const newAdminDataFields = {
        email: currentEmail,
        displayName: currentDisplayName,
        role: 'admin' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`
      };
      await setDoc(userDocRefByUid, newAdminDataFields);

      const createdAdmin: AdminManagedUser = {
        id: trimmedAuthUid,
        ...newAdminDataFields,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      revalidatePath('/superior-admin/admin-management');
      return { success: true, message: `User ${trimmedAuthUid} granted admin role.`, admin: createdAdmin };
    }

  } catch (error) {
    console.error(`Error granting admin role to UID ${trimmedAuthUid}:`, error);
    console.error("Full Firebase Error details for grantAdminRole:", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `CRITICAL PERMISSION_DENIED: Firebase Firestore Security Rules in your project console are blocking this action for user ${trimmedAuthUid}. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure the rules PUBLISHED there allow the Owner (UID: ${OWNER_UID}) to write to the '${USERS_COLLECTION}' collection for document ID '${trimmedAuthUid}'. The correct rules are in the README.md. *** YOU MUST FIX THIS IN THE FIREBASE CONSOLE. ***`;
    console.error(detailedError);
    return {
        success: false,
        message: detailedError
    };
  }
}


export async function revokeAdminRole(adminId: string): Promise<{ success: boolean; message: string }> {
  console.log(`[Server Action - revokeAdminRole] Attempting for UID: ${adminId}.`);
  console.log(`[Server Action - revokeAdminRole] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - revokeAdminRole] auth.currentUser from firebase.ts:`, auth.currentUser);
  if (!adminId) {
    return { success: false, message: 'Admin Auth UID (adminId) is required.' };
  }
  const adminDocRef = doc(db, USERS_COLLECTION, adminId);
  console.log(`Attempting to write to Firestore path: ${adminDocRef.path} (revokeAdminRole) for UID: ${adminId}`);
  try {
    const adminDocSnap = await getDoc(adminDocRef);

    if (!adminDocSnap.exists()) {
      return { success: false, message: `Admin with Auth UID ${adminId} not found in roles collection, or role already revoked.` };
    }

    await deleteDoc(adminDocRef);

    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}. (User record in roles removed)` };
  } catch (error) {
    console.error(`Error revoking admin role for UID ${adminId}:`, error);
    console.error("Full Firebase Error details for revokeAdminRole:", error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `CRITICAL PERMISSION_DENIED: Firebase Firestore Security Rules in your project console are blocking this action for user ${adminId}. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure the rules PUBLISHED there allow the Owner (UID: ${OWNER_UID}) to delete documents from the '${USERS_COLLECTION}' collection. The correct rules are in the README.md. *** YOU MUST FIX THIS IN THE FIREBASE CONSOLE. ***`;
    console.error(detailedError);
    return {
        success: false,
        message: detailedError
    };
  }
}
    