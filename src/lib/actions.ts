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
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    console.log(`[Action: getDefaultAttendanceStatusSetting] Attempting to read from Firestore path: ${configDocRef.path}`);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    return 'Absent'; 
  } catch (error) {
    console.error("Error fetching default attendance status setting: ", error);
    console.error("Full Firebase Error details for getDefaultAttendanceStatusSetting:", error);
    return 'Absent'; 
  }
}

export async function updateDefaultAttendanceStatusSetting(newStatus: AttendanceStatus): Promise<{success: boolean, error?: string}> {
  console.log(`[Server Action - updateDefaultAttendanceStatusSetting] Attempting to update default status to: ${newStatus}.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    console.log(`[Action: updateDefaultAttendanceStatusSetting] Attempting to write to Firestore path: ${configDocRef.path}`);
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
    console.log(`[Action: getParticipants] Attempting to read from Firestore path: ${participantsColRef.path} with filters/orderBy`);

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
        classGrade: data.classGrade, // Added classGrade
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

export async function getParticipantById(id: string): Promise<Participant | null> {
  console.log(`[Action: getParticipantById] Attempting to fetch participant with ID: ${id}`);
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, id);
    console.log(`[Action: getParticipantById] Attempting to read from Firestore path: ${participantRef.path}`);
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
        classGrade: data.classGrade, // Added classGrade
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Participant;
    }
    console.warn(`[Action: getParticipantById] Participant with ID ${id} not found.`);
    return null;
  } catch (error) {
    console.error(`Error fetching participant by ID ${id}: `, error);
    console.error("Full Firebase Error details for getParticipantById:", error);
    throw new Error(`Failed to fetch participant. Check Firestore rules and connectivity.`);
  }
}


// Note: addParticipant and updateParticipant server actions are no longer directly used by ParticipantForm.tsx.
// Their logic is now client-side in ParticipantForm.tsx.
// They are kept here in case they are needed for other server-side operations like import (though import has its own auth complexities).

export async function deleteParticipant(participantId: string): Promise<{ success: boolean }> {
  console.log(`[Server Action - deleteParticipant] Attempting to delete participant: ${participantId}.`);
  console.log(`[Server Action - deleteParticipant] Auth object from firebase.ts:`, auth);
  console.log(`[Server Action - deleteParticipant] auth.currentUser from firebase.ts:`, auth.currentUser); 
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    console.log(`[Action: deleteParticipant] Attempting to write to Firestore path: ${participantRef.path}`);
    await deleteDoc(participantRef);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath(`/participants/${participantId}`); 
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
    console.log(`[Action: markAttendance] Attempting to write to Firestore path: ${participantRef.path}`);
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
    console.log(`[Action: getSystemSchools] Attempting to read from Firestore path: ${schoolsColRef.path}`);
    const schoolsSnapshot = await getDocs(query(schoolsColRef, orderBy('name')));
    return schoolsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system schools: ", error);
    console.error("Full Firebase Error details for getSystemSchools:", error);
    throw new Error("Failed to fetch system schools. Check Firestore rules and connectivity.");
  }
}

// System Committee Actions
export async function getSystemCommittees(): Promise<string[]> {
  try {
    const committeesColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
    console.log(`[Action: getSystemCommittees] Attempting to read from Firestore path: ${committeesColRef.path}`);
    const committeesSnapshot = await getDocs(query(committeesColRef, orderBy('name')));
    return committeesSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system committees: ", error);
    console.error("Full Firebase Error details for getSystemCommittees:", error);
    throw new Error("Failed to fetch system committees. Check Firestore rules and connectivity.");
  }
}


// Import Participants Action
export async function importParticipants(
  parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl' | 'notes' | 'additionalDetails' | 'classGrade'>[] // classGrade removed from Omit
): Promise<{ count: number; errors: number; detectedNewSchools: string[]; detectedNewCommittees: string[] }> {
  console.log(`[Server Action - importParticipants] Starting import for ${parsedParticipants.length} participants.`);

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
    console.error("[Action: importParticipants] Error fetching system schools/committees during import pre-check:", e);
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
        classGrade: '', // Initialize classGrade for CSV import
        createdAt: serverTimestamp(),
      };
      const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION));
      batch.set(participantRef, newParticipant);
      importedCount++;
    } catch (error) {
      console.error("[Action: importParticipants] Error preparing participant for batch import: ", data, error);
      console.error("Full Firebase Error details for preparing batch import:", error);
      errorCount++;
    }
  }

  try {
    console.log(`[Action: importParticipants] Attempting to commit batch of ${importedCount} participants.`);
    await batch.commit();
    console.log(`[Action: importParticipants] Batch commit successful.`);
  } catch (error) {
    console.error("[Action: importParticipants] Error committing batch import: ", error);
    console.error("Full Firebase Error details for batch.commit:", error);
    const firebaseError = error as { code?: string; message?: string };
    const batchCommitError = `Batch commit for participants failed. Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This likely means the security rules for writing to '${PARTICIPANTS_COLLECTION}' were not met for the user context of this server action. Check server logs for 'auth.currentUser' and verify Firestore rules.`;
    console.error(batchCommitError);
    return {
      count: 0,
      errors: parsedParticipants.length + errorCount,
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
    console.log(`[Action: getAdminUsers] Attempting to read from Firestore path: ${usersColRef.path} with role='admin' filter`);
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
    console.error('Error fetching admin users:', error);
    console.error("Full Firebase Error details for getAdminUsers:", error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch admin users. Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${USERS_COLLECTION}'. Ensure owner (UID: ${OWNER_UID}) has list permission.`);
  }
}

export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  console.log(`[Server Action - grantAdminRole] Attempting for UID: ${authUid}, Email: ${email}.`);
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }
  const trimmedAuthUid = authUid.trim();
  if (!trimmedAuthUid) {
    return { success: false, message: 'Auth UID cannot be empty.' };
  }

  const userDocRefByUid = doc(db, USERS_COLLECTION, trimmedAuthUid);
  console.log(`[Action: grantAdminRole] Attempting to write to Firestore path: ${userDocRefByUid.path} for UID: ${trimmedAuthUid}`);

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
          const updatedAdmin: AdminManagedUser = {...existingAdminObject, ...updates, updatedAt: new Date().toISOString() };
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
          updatedAt: new Date().toISOString(),
        };
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to user ${trimmedAuthUid}.`, admin: updatedAdminForReturn };
      }
    } else {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
  if (!adminId) {
    return { success: false, message: 'Admin Auth UID (adminId) is required.' };
  }
  const adminDocRef = doc(db, USERS_COLLECTION, adminId);
  console.log(`[Action: revokeAdminRole] Attempting to write to Firestore path: ${adminDocRef.path} for UID: ${adminId}`);
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

// New server action for bulk attendance update
export async function bulkMarkAttendance(participantIds: string[], status: AttendanceStatus): Promise<{ successCount: number; errorCount: number }> {
  console.log(`[Server Action - bulkMarkAttendance] Attempting to update status to '${status}' for ${participantIds.length} participants.`);
  
  if (!participantIds || participantIds.length === 0) {
    return { successCount: 0, errorCount: 0 };
  }

  const batch = writeBatch(db);
  let successCount = 0;
  let errorCount = 0;

  participantIds.forEach(id => {
    try {
      const participantRef = doc(db, PARTICIPANTS_COLLECTION, id);
      batch.update(participantRef, { status, updatedAt: serverTimestamp() });
      successCount++;
    } catch (e) {
      console.error(`[Server Action - bulkMarkAttendance] Error preparing update for participant ${id}:`, e);
      errorCount++;
    }
  });

  try {
    console.log(`[Action: bulkMarkAttendance] Attempting to commit batch of ${successCount} updates.`);
    await batch.commit();
    console.log(`[Action: bulkMarkAttendance] Batch commit successful.`);
    revalidatePath('/');
    revalidatePath('/public');
    participantIds.forEach(id => revalidatePath(`/participants/${id}`));
  } catch (error) {
    console.error("[Action: bulkMarkAttendance] Error committing batch update: ", error);
    console.error("Full Firebase Error details for bulkMarkAttendance batch.commit:", error);
    // If batch fails, all attempted successes become errors
    errorCount += successCount;
    successCount = 0;
  }

  return { successCount, errorCount };
}