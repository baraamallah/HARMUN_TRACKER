
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
  getDoc
} from 'firebase/firestore';
import type { Participant, AttendanceStatus, AdminManagedUser } from '@/types';
import { v4 as uuidv4 } from 'uuid';


const PARTICIPANTS_COLLECTION = 'participants';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const USERS_COLLECTION = 'users'; // For storing user roles and metadata


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

    // Note: For large datasets, client-side search term filtering is not performant.
    // Consider server-side search solutions (e.g., Algolia, Typesense) or specific field queries.
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
    const newParticipantData = {
      ...participantData,
      status: 'Absent' as AttendanceStatus, 
      imageUrl: `https://placehold.co/40x40.png?text=${(participantData.name || 'P').substring(0,2).toUpperCase()}`, // Ensure name exists
      createdAt: serverTimestamp() 
    };
    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipantData);
    revalidatePath('/');
    revalidatePath('/public');
    return { id: docRef.id, ...newParticipantData, status: 'Absent', imageUrl: newParticipantData.imageUrl };
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
    const updatedDoc = { id: participantId, ...participantData } as Participant; 
    return updatedDoc;
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
    // Fetch the updated participant to return complete data if needed, or just return status
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
    return {success: false, error: "Failed to add system school."};
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
    return {success: false, error: "Failed to add system committee."};
  }
}


// Import Participants Action
export async function importParticipants(parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[]): Promise<{ count: number, errors: number, newSchools: number, newCommittees: number }> {
  let importedCount = 0;
  let errorCount = 0;
  let newSchoolsCount = 0;
  let newCommitteesCount = 0;

  const batch = writeBatch(db);

  const uniqueImportSchools = new Set(parsedParticipants.map(p => p.school.trim()).filter(s => s));
  const uniqueImportCommittees = new Set(parsedParticipants.map(p => p.committee.trim()).filter(c => c));

  const existingSystemSchools = await getSystemSchools();
  const existingSystemCommittees = await getSystemCommittees();

  for (const schoolName of uniqueImportSchools) {
    if (!existingSystemSchools.includes(schoolName)) {
      const schoolRef = doc(collection(db, SYSTEM_SCHOOLS_COLLECTION)); // Creates a ref with auto-ID
      batch.set(schoolRef, { name: schoolName, createdAt: serverTimestamp() });
      newSchoolsCount++;
    }
  }

  for (const committeeName of uniqueImportCommittees) {
    if (!existingSystemCommittees.includes(committeeName)) {
      const committeeRef = doc(collection(db, SYSTEM_COMMITTEES_COLLECTION)); // Creates a ref with auto-ID
      batch.set(committeeRef, { name: committeeName, createdAt: serverTimestamp() });
      newCommitteesCount++;
    }
  }

  for (const data of parsedParticipants) {
    try {
      const newParticipant: Omit<Participant, 'id'> = {
        name: data.name.trim(),
        school: data.school.trim(),
        committee: data.committee.trim(),
        status: 'Absent',
        imageUrl: `https://placehold.co/40x40.png?text=${(data.name || 'P').substring(0,2).toUpperCase()}`, // Ensure name exists
        createdAt: serverTimestamp(),
      };
      const participantRef = doc(collection(db, PARTICIPANTS_COLLECTION)); // Creates a ref with auto-ID
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
    // Note: If batch fails, all operations are rolled back. Error count might not reflect individual failures if batch itself fails.
    throw new Error("Batch import failed. Some participants or new schools/committees might not have been added.");
  }

  if (importedCount > 0 || newSchoolsCount > 0 || newCommitteesCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/superior-admin');
  }
  return { count: importedCount, errors: errorCount, newSchools: newSchoolsCount, newCommittees: newCommitteesCount };
}

// Admin Management Actions (Superior Admin)

/**
 * Fetches users marked with an 'admin' role from the 'users' Firestore collection.
 */
export async function getAdminUsers(): Promise<AdminManagedUser[]> {
  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const q = query(usersCol, where('role', '==', 'admin'), orderBy('email'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({
      id: docSnap.id, // Firestore document ID (which is the user's Auth UID)
      uid: docSnap.data().uid, 
      ...docSnap.data(),
    } as AdminManagedUser));
  } catch (error) {
    console.error('Error fetching admin users:', error);
    throw new Error('Failed to fetch admin users.');
  }
}

/**
 * Grants admin role to a user by creating/updating their record in the 'users' Firestore collection.
 * This does NOT create a Firebase Auth user. Assumes the user already exists in Firebase Auth.
 * The document ID in the 'users' collection will be the user's Firebase Auth UID.
 *
 * @param email The email of the user to grant admin role.
 * @param displayName Optional display name for the user.
 * @param authUid The Firebase Auth UID of the user.
 */
export async function grantAdminRole({ email, displayName, authUid }: { email: string; displayName?: string; authUid: string }): Promise<{ success: boolean; message: string; admin?: AdminManagedUser }> {
  if (!email || !authUid) {
    return { success: false, message: 'Email and Auth UID are required.' };
  }

  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const userDocRefByUid = doc(usersCol, authUid); // Document ID is the authUid
    const userDocSnapByUid = await getDoc(userDocRefByUid);

    if (userDocSnapByUid.exists()) {
      const existingUserData = userDocSnapByUid.data() as AdminManagedUser;
      if (existingUserData.role === 'admin') {
        return { success: true, message: `User ${email} is already an admin.`, admin: { id: userDocSnapByUid.id, ...existingUserData} };
      } else {
        // User exists but is not an admin, update their role
        await updateDoc(userDocRefByUid, {
          role: 'admin',
          email: email.toLowerCase(), 
          displayName: displayName || existingUserData.displayName || null,
          updatedAt: serverTimestamp(),
        });
        revalidatePath('/superior-admin/admin-management');
        return { success: true, message: `Admin role granted to ${email}.`, admin: { id: userDocSnapByUid.id, uid: authUid, email, displayName, role: 'admin'} as AdminManagedUser };
      }
    } else {
      // User does not exist with this UID, create new record
      // Check if another user record exists with this email (could be an old record or different UID if data wasn't clean)
      const qEmail = query(usersCol, where('email', '==', email.toLowerCase()));
      const emailQuerySnapshot = await getDocs(qEmail);
      if (!emailQuerySnapshot.empty) {
          // A user with this email but different/no UID record exists. This indicates a potential data conflict.
          return { success: false, message: `Error: A user record with email ${email} already exists but is not linked to this Auth UID (${authUid}). Please resolve manually or ensure the correct Auth UID is provided.` };
      }
      
      const firstLetter = (displayName || email || 'A').substring(0,1).toUpperCase();
      const newAdminData: Omit<AdminManagedUser, 'id'> = {
        uid: authUid,
        email: email.toLowerCase(),
        displayName: displayName || null,
        role: 'admin',
        createdAt: serverTimestamp(),
        avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`
      };
      // Use setDoc since the document ID is known (authUid)
      await setDoc(userDocRefByUid, newAdminData); 
      
      revalidatePath('/superior-admin/admin-management');
      return { success: true, message: `User ${email} granted admin role.`, admin: { id: authUid, ...newAdminData } as AdminManagedUser };
    }

  } catch (error) {
    console.error('Error granting admin role:', error);
    // It's good to be specific if possible, but generic fallback is okay
    const errorMessage = error instanceof Error ? error.message : 'Could not grant admin role.';
    throw new Error(`Failed to grant admin role: ${errorMessage}`);
  }
}


/**
 * Revokes admin role from a user by deleting their record from the 'users' Firestore collection.
 * This uses the user's Auth UID as the document ID in the 'users' collection.
 *
 * @param adminId The Firebase Auth UID of the admin whose role is to be revoked.
 */
export async function revokeAdminRole(adminId: string): Promise<{ success: boolean; message: string }> {
  if (!adminId) {
    return { success: false, message: 'Admin Auth UID is required.' };
  }
  try {
    const adminDocRef = doc(db, USERS_COLLECTION, adminId); // adminId here is the Auth UID
    const adminDocSnap = await getDoc(adminDocRef);

    if (!adminDocSnap.exists()) {
      return { success: false, message: `Admin with Auth UID ${adminId} not found in roles collection.` };
    }
    
    await deleteDoc(adminDocRef);
    
    revalidatePath('/superior-admin/admin-management');
    return { success: true, message: `Admin role revoked for user with Auth UID ${adminId}.` };
  } catch (error) {
    console.error('Error revoking admin role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Could not revoke admin role.';
    throw new Error(`Failed to revoke admin role: ${errorMessage}`);
  }
}

