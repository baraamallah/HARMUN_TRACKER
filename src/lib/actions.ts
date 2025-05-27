
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
    revalidatePath('/'); 
    return { success: true };
  } catch (error) {
    console.error("Error updating default attendance status setting: ", error);
    let detailedMessage = 'Could not update setting.';
    if (error instanceof Error) {
        detailedMessage += ` Details: ${error.message}. Ensure Firestore rules allow the Owner to write to 'system_config'.`;
    }
    return { success: false, error: detailedMessage };
  }
}


// Participant Actions
export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    const participantsCol = collection(db, PARTICIPANTS_COLLECTION);
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
    
    q = query(participantsCol, ...queryConstraints, orderBy('name'));
    
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
      "HARMUN_TRACKER: Error fetching participants from Firestore. Active filters:", 
      filters, 
      "Underlying error:", 
      error
    );
    let detailedMessage = "Failed to fetch participants from Firestore.";
    if (error instanceof Error && (error.message.includes('firestore/failed-precondition') || error.message.includes('requires an index') || error.message.includes('The query requires an index'))) {
      detailedMessage += " This often indicates a missing Firestore index. Please check your browser's developer console for a Firestore error message that might include a link to create the required index in your Firebase project console.";
    } else if (error instanceof Error) {
      detailedMessage += ` Details: ${error.message}`;
    } else {
      detailedMessage += ` Details: ${String(error)}`;
    }
    throw new Error(detailedMessage);
  }
}

export async function addParticipant(participantData: Omit<Participant, 'id' | 'status' | 'imageUrl'>): Promise<Participant | null> {
  try {
    const defaultStatus = await getDefaultAttendanceStatusSetting();
    const nameInitial = (participantData.name.trim() || 'P').substring(0,2).toUpperCase();
    const newParticipantData = {
      ...participantData,
      status: defaultStatus, 
      imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
      createdAt: serverTimestamp() 
    };
    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipantData);
    revalidatePath('/');
    revalidatePath('/public');
    return { id: docRef.id, ...newParticipantData, status: defaultStatus, imageUrl: newParticipantData.imageUrl, createdAt: Timestamp.now() };
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
    const updatedDocSnap = await getDoc(participantRef); 
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
    let detailedMessage = "Failed to add system school.";
    if (error instanceof Error) {
        detailedMessage += ` Details: ${error.message}. Ensure Firestore rules allow the Owner to write to 'system_schools'.`;
    }
    return {success: false, error: detailedMessage};
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
    let detailedMessage = "Failed to add system committee.";
     if (error instanceof Error) {
        detailedMessage += ` Details: ${error.message}. Ensure Firestore rules allow the Owner to write to 'system_committees'.`;
    }
    return {success: false, error: detailedMessage};
  }
}


// Import Participants Action
export async function importParticipants(parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[]): Promise<{ count: number, errors: number, newSchools: number, newCommittees: number, skippedLines: number }> {
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
    return { count: 0, errors: parsedParticipants.length, newSchools: 0, newCommittees: 0, skippedLines: 0 };
  }

  if (importedCount > 0 || newSchoolsCount > 0 || newCommitteesCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
    if (newSchoolsCount > 0 || newCommitteesCount > 0) {
      revalidatePath('/superior-admin'); 
    }
  }
  return { count: importedCount, errors: errorCount, newSchools: newSchoolsCount, newCommittees: newCommitteesCount, skippedLines: 0 };
}

// Admin Management Actions (Superior Admin)

export async function getAdminUsers(): Promise<AdminManagedUser[]> {
  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const q = query(usersCol, where('role', '==', 'admin'), orderBy('email'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id, 
        uid: data.uid || docSnap.id, 
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
    throw new Error('Failed to fetch admin users.');
  }
}

export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }
  if (!authUid.trim()) {
    return { success: false, message: 'Auth UID cannot be empty.' };
  }

  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const userDocRefByUid = doc(usersCol, authUid); 
    const userDocSnapByUid = await getDoc(userDocRefByUid);

    if (userDocSnapByUid.exists()) {
      const dataFields = userDocSnapByUid.data();
      
      const existingAdminObject: AdminManagedUser = {
        id: userDocSnapByUid.id,
        uid: dataFields.uid || authUid,
        email: dataFields.email,
        displayName: dataFields.displayName,
        role: dataFields.role,
        createdAt: dataFields.createdAt,
        updatedAt: dataFields.updatedAt, 
        avatarUrl: dataFields.avatarUrl,
      };

      if (existingAdminObject.role === 'admin') {
        return { success: true, message: `User ${email} (UID: ${authUid}) is already an admin.`, admin: existingAdminObject };
      } else {
        // User exists but not as admin, update their role
        const updatedFields = {
          role: 'admin' as const,
          email: email.toLowerCase().trim(),
          displayName: displayName?.trim() || existingAdminObject.displayName || null,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(userDocRefByUid, updatedFields);
        
        const updatedAdminForReturn: AdminManagedUser = {
          ...existingAdminObject,
          role: 'admin',
          email: updatedFields.email,
          displayName: updatedFields.displayName,
          updatedAt: Timestamp.now(), // Represent server timestamp for immediate return
        };
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to ${email} (UID: ${authUid}).`, admin: updatedAdminForReturn };
      }
    } else {
      // User document doesn't exist for this authUid, check if email is already used by another UID with admin role
      const qEmail = query(usersCol, where('email', '==', email.toLowerCase().trim()), where('role', '==', 'admin'));
      const emailQuerySnapshot = await getDocs(qEmail);
      if (!emailQuerySnapshot.empty) {
          const conflictingUserDoc = emailQuerySnapshot.docs[0];
          if (conflictingUserDoc.id !== authUid) {
            return { success: false, message: `Error: Email ${email} is already associated with a different admin (UID: ${conflictingUserDoc.id}). Please use a unique email or resolve the conflict.` };
          }
      }
      
      // Safe to create new admin record
      const firstLetter = (displayName?.trim() || email.trim() || 'A').charAt(0).toUpperCase();
      const newAdminDataFields = { 
        uid: authUid,
        email: email.toLowerCase().trim(),
        displayName: displayName?.trim() || null,
        role: 'admin' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`
      };
      await setDoc(userDocRefByUid, newAdminDataFields); 
      
      const createdAdmin: AdminManagedUser = {
        id: authUid, 
        ...newAdminDataFields,
        createdAt: Timestamp.now(), // Represent server timestamp for immediate return
        updatedAt: Timestamp.now(), // Represent server timestamp for immediate return
      };
      
      revalidatePath('/superior-admin/admin-management');
      return { success: true, message: `User ${email} (UID: ${authUid}) granted admin role.`, admin: createdAdmin };
    }

  } catch (error) {
    console.error('Error granting admin role:', error);
    let detailedMessage = 'Failed to grant admin role.';
    if (error instanceof Error) {
      detailedMessage += ` Details: ${error.message}. Check Firestore rules for the 'users' collection.`;
    }
    return { success: false, message: detailedMessage };
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
      return { success: false, message: `Admin with Auth UID ${adminId} not found in roles collection, or role already revoked.` };
    }
    
    await deleteDoc(adminDocRef);
    
    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}. (User record in roles removed)` };
  } catch (error) {
    console.error('Error revoking admin role:', error);
    let detailedMessage = 'Could not revoke admin role.';
    if (error instanceof Error) {
      detailedMessage += ` Details: ${error.message}. Check Firestore rules for the 'users' collection.`;
    }
    return { success: false, message: detailedMessage };
  }
}
    

