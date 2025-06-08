
'use server';

import { revalidatePath } from 'next/cache';
import { db } from './firebase'; 
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import type { Participant, AttendanceStatus, AdminManagedUser, StaffMember } from '@/types';
import { OWNER_UID } from './constants';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams';
const USERS_COLLECTION = 'users';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


// --- IMPORTANT NOTE ON SERVER ACTIONS AND FIREBASE AUTHENTICATION ---
// Server Actions in this file that interact with Firestore using the CLIENT SDK's 'db' instance
// (most actions below) face a known limitation: the 'request.auth' object within your
// Firestore Security Rules might NOT be populated with the end-user's UID who initiated the action
// on the client. This can lead to PERMISSION_DENIED errors if your rules rely on 'request.auth.uid'
// for checks like 'isAdmin()' or 'isOwner()'.
//
// Operations MOVED TO CLIENT-SIDE to leverage client's auth context include:
// - Single participant attendance marking (from table actions and profile page)
// - Bulk participant status updates (from main dashboard)
// - Single staff member status marking (from table actions and profile page)
// - Fetching participant lists and individual participant details
// - Fetching staff member lists and individual staff member details
// - Deleting single participants from table actions
// - Updating system settings (logo URL, default attendance status)
//
// REMAINING SERVER ACTIONS and their typical use context:
// - System list management (schools, committees, teams - add/delete): Primarily Owner-only actions. Additions are client-side for now in Superior Admin page. Deletions are server actions.
// - Admin role management (grant/revoke): Owner-only.
// - Getting system settings (read-only): Used by various components.
// - CSV Import, Bulk Delete Participants: These are complex operations well-suited for server actions.
//   However, 'bulkDeleteParticipants' (and 'importParticipants' if it writes) will also face the same
//   Firestore 'request.auth' limitations if rules require specific user roles for writes not accounting for server context.
//
// For robust, user-specific permission handling in Server Actions, the Firebase ADMIN SDK (with ID token verification)
// is the recommended approach. This project currently uses the Client SDK for server actions.

// System Settings Actions (Read-only server actions)
export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Attempting to read default status.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    console.log(`[Server Action - getDefaultAttendanceStatusSetting] No setting found or field missing, returning 'Absent'.`);
    return 'Absent';
  } catch (error) {
    console.error("[Server Action] Error fetching default attendance status setting: ", error);
    return 'Absent'; 
  }
}

export async function getSystemLogoUrlSetting(): Promise<string | null> {
  console.log(`[Server Action - getSystemLogoUrlSetting] Attempting to read logo URL.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().munLogoUrl) {
      return docSnap.data().munLogoUrl as string;
    }
    console.log(`[Server Action - getSystemLogoUrlSetting] No logo URL found or field missing.`);
    return null;
  } catch (error) {
    console.error("[Server Action] Error fetching system logo URL: ", error);
    return null; 
  }
}

// Participant Actions (Data fetching moved client-side)
// The getParticipants & getParticipantById server actions are now primarily for the public page 
// or scenarios where client-side auth context isn't strictly necessary for the read operation itself.
// Admin-facing participant lists/details use client-side fetching.

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
        "[Server Action - getParticipants (Public/Fallback)] Error fetching participants. Filters:",
        filters, "Error:", error
      );
      const firebaseError = error as { code?: string; message?: string };
      let detailedMessage = `Failed to fetch participants (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}.`;
      if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index')) {
        detailedMessage += " Firestore index missing. Check browser console for link to create it.";
      } else if (firebaseError.code === 'permission-denied') {
        detailedMessage += " PERMISSION_DENIED. Firestore rules blocking read.";
      } else {
        detailedMessage += ` Details: ${firebaseError.message || String(error)}.`;
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
    console.error(`[Server Action - getParticipantById (Public/Fallback)] Error fetching participant by ID ${id}: `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch participant (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}.`);
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
    const detailedError = `Failed to delete school (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules for '${SYSTEM_SCHOOLS_COLLECTION}' allow Owner to delete, and server action context meets this. OWNER_UID (${OWNER_UID}).`;
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
    const detailedError = `Failed to delete committee (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules for '${SYSTEM_COMMITTEES_COLLECTION}' allow Owner to delete.`;
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
    const detailedError = `Failed to delete staff team (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules for '${SYSTEM_STAFF_TEAMS_COLLECTION}' allow Owner to delete.`;
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
    // Proceeding without pre-check if this fails, detection will still occur
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
    const batchCommitError = `Batch commit for participants failed (Server Action). Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. This likely means the security rules for writing to '${PARTICIPANTS_COLLECTION}' were not met (e.g., isAdmin() check failing due to server action context).`;
    console.error(batchCommitError);
    // Even if batch fails, return detected schools/committees. Error count reflects all attempted.
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
    throw new Error(`Failed to fetch admin users (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${USERS_COLLECTION}'. Ensure owner (UID: ${OWNER_UID}) has list permission.`);
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
      } else { // User exists but is not admin, upgrade role
        const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
        const updatedFields = { email: currentEmail, displayName: currentDisplayName, role: 'admin' as const, avatarUrl: dataFields.avatarUrl || `https://placehold.co/40x40.png?text=${firstLetter}`, updatedAt: serverTimestamp() };
        await updateDoc(userDocRefByUid, updatedFields); 
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to user ${trimmedAuthUid}.`, admin: { ...existingAdminObject, ...updatedFields, updatedAt: new Date().toISOString() } };
      }
    } else { // User does not exist in users collection, create new admin entry
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
    const detailedError = `Failed to grant admin role (Server Action). Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules allow Owner to write to '${USERS_COLLECTION}'.`;
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
    // Instead of deleting, update role to something else or remove role field if that's preferred.
    // For now, deleting the role document is the existing logic.
    await deleteDoc(adminDocRef); 
    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}. (User record in roles removed)` };
  } catch (error) {
    console.error(`[Server Action] Error revoking admin role for UID ${adminId}:`, error);
    const firebaseError = error as { code?: string; message?: string };
    const detailedError = `Failed to revoke admin role (Server Action). Firebase Error Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Ensure Firestore rules allow Owner to delete from '${USERS_COLLECTION}'.`;
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
    const detailedError = `Failed to bulk delete participants (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${PARTICIPANTS_COLLECTION}' (e.g., isAdmin() check failing due to server action context).`;
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
// Data fetching for staff members is now client-side.
// Single status updates for staff members are client-side.
// The deleteStaffMember server action is still here, used by Superior Admin.
export async function deleteStaffMember(staffMemberId: string): Promise<{ success: boolean, error?: string }> {
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
    const detailedError = `Failed to delete staff member (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}. Check Firestore rules for '${STAFF_MEMBERS_COLLECTION}'.`;
    console.error(detailedError);
    return { success: false, error: detailedError };
  }
}

