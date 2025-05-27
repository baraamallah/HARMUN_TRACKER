
'use server';

import { revalidatePath } from 'next/cache';
import { db } from './firebase'; // Import Firestore instance
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
import { v4 as uuidv4 } from 'uuid';


const PARTICIPANTS_COLLECTION = 'participants';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const USERS_COLLECTION = 'users'; // For storing user roles and metadata
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


// System Settings Actions
export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    return 'Absent'; // Fallback default status
  } catch (error) {
    console.error("Error fetching default attendance status setting: ", error);
    return 'Absent'; // Fallback on error
  }
}

export async function updateDefaultAttendanceStatusSetting(newStatus: AttendanceStatus): Promise<{success: boolean, error?: string}> {
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    await setDoc(configDocRef, { defaultAttendanceStatus: newStatus }, { merge: true });
    revalidatePath('/superior-admin/system-settings');
    // Potentially revalidate other paths if new participant forms might be open elsewhere
    revalidatePath('/'); // Revalidate dashboard where new participants might be added
    return { success: true };
  } catch (error) {
    console.error("Error updating default attendance status setting: ", error);
    const errorMessage = error instanceof Error ? error.message : 'Could not update setting.';
    return { success: false, error: `Failed to update setting: ${errorMessage}` };
  }
}


// Participant Actions
export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    const participantsCol = collection(db, PARTICIPANTS_COLLECTION);
    let q = query(participantsCol, orderBy('name')); 

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
    
    if (queryConstraints.length > 0) {
      q = query(participantsCol, ...queryConstraints, orderBy('name'));
    } else {
       q = query(participantsCol, orderBy('name'));
    }
    
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
    console.error("Error fetching participants: ", error);
    throw new Error("Failed to fetch participants.");
  }
}

export async function addParticipant(participantData: Omit<Participant, 'id' | 'status' | 'imageUrl'>): Promise<Participant | null> {
  try {
    const defaultStatus = await getDefaultAttendanceStatusSetting();
    const newParticipantData = {
      ...participantData,
      status: defaultStatus, 
      imageUrl: `https://placehold.co/40x40.png?text=${(participantData.name || 'P').substring(0,2).toUpperCase()}`,
      createdAt: serverTimestamp() 
    };
    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipantData);
    revalidatePath('/');
    revalidatePath('/public');
    return { id: docRef.id, ...newParticipantData, status: defaultStatus, imageUrl: newParticipantData.imageUrl };
  } catch (error) {
    console.error("Error adding participant: ", error);
    throw new Error("Failed to add participant.");
  }
}

export async function updateParticipant(participantId: string, participantData: Partial<Omit<Participant, 'id'>>): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await updateDoc(participantRef, {...participantData, updatedAt: serverTimestamp()});
    revalidatePath('/');
    revalidatePath('/public');
    const updatedDocSnap = await getDoc(participantRef); // Fetch the updated document to return complete data
    if (updatedDocSnap.exists()) {
      return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as Participant;
    }
    return null;
  } catch (error) {
    console.error("Error updating participant: ", error);
    throw new Error("Failed to update participant.");
  }
}

export async function deleteParticipant(participantId: string): Promise<{ success: boolean }> {
  try {
    await deleteDoc(doc(db, PARTICIPANTS_COLLECTION, participantId));
    revalidatePath('/');
    revalidatePath('/public');
    return { success: true };
  } catch (error) {
    console.error("Error deleting participant: ", error);
    throw new Error("Failed to delete participant.");
  }
}

export async function markAttendance(participantId: string, status: AttendanceStatus): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
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
    throw new Error("Failed to mark attendance.");
  }
}

// System School Actions
export async function getSystemSchools(): Promise<string[]> {
  try {
    const schoolsSnapshot = await getDocs(query(collection(db, SYSTEM_SCHOOLS_COLLECTION), orderBy('name')));
    return schoolsSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system schools: ", error);
    throw new Error("Failed to fetch system schools.");
  }
}

export async function addSystemSchool(schoolName: string): Promise<{success: boolean, id?: string, error?: string}> {
  if (!schoolName.trim()) {
    return {success: false, error: "School name cannot be empty."};
  }
  try {
    const q = query(collection(db, SYSTEM_SCHOOLS_COLLECTION), where('name', '==', schoolName.trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return {success: false, error: "School already exists."};
    }

    const docRef = await addDoc(collection(db, SYSTEM_SCHOOLS_COLLECTION), { name: schoolName.trim(), createdAt: serverTimestamp() });
    revalidatePath('/superior-admin');
    revalidatePath('/'); 
    revalidatePath('/public'); 
    return {success: true, id: docRef.id};
  } catch (error) {
    console.error("Error adding system school: ", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return {success: false, error: `Failed to add system school: ${errorMessage}`};
  }
}

// System Committee Actions
export async function getSystemCommittees(): Promise<string[]> {
  try {
    const committeesSnapshot = await getDocs(query(collection(db, SYSTEM_COMMITTEES_COLLECTION), orderBy('name')));
    return committeesSnapshot.docs.map(doc => doc.data().name as string);
  } catch (error) {
    console.error("Error fetching system committees: ", error);
    throw new Error("Failed to fetch system committees.");
  }
}

export async function addSystemCommittee(committeeName: string): Promise<{success: boolean, id?: string, error?: string}> {
   if (!committeeName.trim()) {
    return {success: false, error: "Committee name cannot be empty."};
  }
  try {
    const q = query(collection(db, SYSTEM_COMMITTEES_COLLECTION), where('name', '==', committeeName.trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return {success: false, error: "Committee already exists."};
    }

    const docRef = await addDoc(collection(db, SYSTEM_COMMITTEES_COLLECTION), { name: committeeName.trim(), createdAt: serverTimestamp() });
    revalidatePath('/superior-admin');
    revalidatePath('/'); 
    revalidatePath('/public'); 
    return {success: true, id: docRef.id};
  } catch (error) {
    console.error("Error adding system committee: ", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return {success: false, error: `Failed to add system committee: ${errorMessage}`};
  }
}


// Import Participants Action
export async function importParticipants(parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[]): Promise<{ count: number, errors: number, newSchools: number, newCommittees: number }> {
  let importedCount = 0;
  let errorCount = 0;
  let newSchoolsCount = 0;
  let newCommitteesCount = 0;

  const batch = writeBatch(db);
  const defaultStatus = await getDefaultAttendanceStatusSetting();

  const uniqueImportSchools = new Set(parsedParticipants.map(p => p.school.trim()).filter(s => s));
  const uniqueImportCommittees = new Set(parsedParticipants.map(p => p.committee.trim()).filter(c => c));

  const existingSystemSchools = await getSystemSchools();
  const existingSystemCommittees = await getSystemCommittees();

  for (const schoolName of uniqueImportSchools) {
    if (!existingSystemSchools.includes(schoolName)) {
      const schoolRef = doc(collection(db, SYSTEM_SCHOOLS_COLLECTION)); 
      batch.set(schoolRef, { name: schoolName, createdAt: serverTimestamp() });
      newSchoolsCount++;
    }
  }

  for (const committeeName of uniqueImportCommittees) {
    if (!existingSystemCommittees.includes(committeeName)) {
      const committeeRef = doc(collection(db, SYSTEM_COMMITTEES_COLLECTION)); 
      batch.set(committeeRef, { name: committeeName, createdAt: serverTimestamp() });
      newCommitteesCount++;
    }
  }

  for (const data of parsedParticipants) {
    try {
      // Use robust placeholder logic consistent with addParticipant
      const nameInitial = (data.name.trim() || 'P').substring(0,2).toUpperCase();
      const newParticipant: Omit<Participant, 'id'> = {
        name: data.name.trim(),
        school: data.school.trim(),
        committee: data.committee.trim(),
        status: defaultStatus,
        imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`, 
        createdAt: serverTimestamp(),
      };
      const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION)); 
      batch.set(participantRef, newParticipant);
      importedCount++;
    } catch (error) {
      console.error("Error preparing participant for batch import: ", data, error);
      errorCount++;
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error("Error committing batch import: ", error);
    // Consider not re-throwing here to allow partial success reporting, 
    // but ensure the calling function knows about the batch commit failure.
    // For simplicity, we'll let it throw, and the caller (ImportCsvDialog) handles it.
    throw new Error("Batch import failed. Some participants or new schools/committees might not have been added.");
  }

  if (importedCount > 0 || newSchoolsCount > 0 || newCommitteesCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
    if (newSchoolsCount > 0 || newCommitteesCount > 0) {
      revalidatePath('/superior-admin'); // Only revalidate if schools/committees changed
    }
  }
  return { count: importedCount, errors: errorCount, newSchools: newSchoolsCount, newCommittees: newCommitteesCount };
}

// Admin Management Actions (Superior Admin)

export async function getAdminUsers(): Promise<AdminManagedUser[]> {
  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const q = query(usersCol, where('role', '==', 'admin'), orderBy('email'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({
      id: docSnap.id, 
      uid: docSnap.data().uid || docSnap.id, // Use docSnap.id as UID if uid field is missing for some reason
      ...docSnap.data(),
      // Ensure createdAt is a Firebase Timestamp or can be converted
      createdAt: docSnap.data().createdAt, 
    } as AdminManagedUser));
  } catch (error) {
    console.error('Error fetching admin users:', error);
    throw new Error('Failed to fetch admin users.');
  }
}

export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }

  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const userDocRefByUid = doc(usersCol, authUid); 
    const userDocSnapByUid = await getDoc(userDocRefByUid);

    if (userDocSnapByUid.exists()) {
      const existingUserData = userDocSnapByUid.data() as AdminManagedUser;
      if (existingUserData.role === 'admin') {
        return { success: true, message: `User ${email} (UID: ${authUid}) is already an admin.`, admin: { id: userDocSnapByUid.id, ...existingUserData} };
      } else {
        // User exists but not as admin, update their role
        await updateDoc(userDocRefByUid, {
          role: 'admin',
          email: email.toLowerCase(), 
          displayName: displayName || existingUserData.displayName || null,
          updatedAt: serverTimestamp(),
        });
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to ${email} (UID: ${authUid}).`, admin: { id: userDocSnapByUid.id, uid: authUid, email, displayName, role: 'admin'} as AdminManagedUser };
      }
    } else {
      // User document doesn't exist for this authUid, check if email is already used by another UID
      const qEmail = query(usersCol, where('email', '==', email.toLowerCase()));
      const emailQuerySnapshot = await getDocs(qEmail);
      if (!emailQuerySnapshot.empty) {
          const conflictingUserDoc = emailQuerySnapshot.docs[0];
          return { success: false, message: `Error: Email ${email} is already associated with a different admin (UID: ${conflictingUserDoc.id}). Please use a unique email or resolve the conflict.` };
      }
      
      // Safe to create new admin record
      const firstLetter = (displayName?.trim() || email.trim() || 'A').charAt(0).toUpperCase();
      const newAdminData: Omit<AdminManagedUser, 'id'> = {
        uid: authUid,
        email: email.toLowerCase().trim(),
        displayName: displayName?.trim() || null,
        role: 'admin',
        createdAt: serverTimestamp(),
        avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`
      };
      await setDoc(userDocRefByUid, newAdminData); 
      
      revalidatePath('/superior-admin/admin-management');
      return { success: true, message: `User ${email} (UID: ${authUid}) granted admin role.`, admin: { id: authUid, ...newAdminData } as AdminManagedUser };
    }

  } catch (error) {
    console.error('Error granting admin role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Could not grant admin role.';
    return { success: false, message: `Failed to grant admin role: ${errorMessage}` };
  }
}


export async function revokeAdminRole(adminId: string): Promise<{ success: boolean; message: string }> {
  if (!adminId) {
    return { success: false, message: 'Admin Auth UID is required.' };
  }
  try {
    const adminDocRef = doc(db, USERS_COLLECTION, adminId); 
    const adminDocSnap = await getDoc(adminDocRef);

    if (!adminDocSnap.exists()) {
      return { success: false, message: `Admin with Auth UID ${adminId} not found in roles collection.` };
    }
    
    // Instead of deleting, consider setting role to null or a 'revoked' status if you want to keep user record
    // For this implementation, we'll delete the document from the users collection that marks them as admin.
    await deleteDoc(adminDocRef);
    
    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}.` };
  } catch (error) {
    console.error('Error revoking admin role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Could not revoke admin role.';
    return { success: false, message: `Failed to revoke admin role: ${errorMessage}` };
  }
}
