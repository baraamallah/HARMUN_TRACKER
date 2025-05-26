
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
  writeBatch
} from 'firebase/firestore';
import type { Participant, AttendanceStatus } from '@/types';

const PARTICIPANTS_COLLECTION = 'participants';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';

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
    const newParticipantData = {
      ...participantData,
      status: 'Absent' as AttendanceStatus, 
      imageUrl: `https://placehold.co/40x40.png?text=${participantData.name.substring(0,2).toUpperCase()}`,
      createdAt: Timestamp.now() 
    };
    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipantData);
    revalidatePath('/');
    revalidatePath('/public');
    return { id: docRef.id, ...newParticipantData };
  } catch (error) {
    console.error("Error adding participant: ", error);
    throw new Error("Failed to add participant.");
  }
}

export async function updateParticipant(participantId: string, participantData: Partial<Omit<Participant, 'id'>>): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await updateDoc(participantRef, {...participantData, updatedAt: Timestamp.now()});
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
    await updateDoc(participantRef, { status, updatedAt: Timestamp.now() });
    revalidatePath('/');
    revalidatePath('/public');
    return { id: participantId, status } as Partial<Participant> as Participant;
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
    // Check if school already exists
    const q = query(collection(db, SYSTEM_SCHOOLS_COLLECTION), where('name', '==', schoolName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return {success: false, error: "School already exists."};
    }

    const docRef = await addDoc(collection(db, SYSTEM_SCHOOLS_COLLECTION), { name: schoolName.trim(), createdAt: Timestamp.now() });
    revalidatePath('/superior-admin');
    revalidatePath('/'); // For participant form dropdowns
    revalidatePath('/public'); // For public filters
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
    // Check if committee already exists
    const q = query(collection(db, SYSTEM_COMMITTEES_COLLECTION), where('name', '==', committeeName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return {success: false, error: "Committee already exists."};
    }

    const docRef = await addDoc(collection(db, SYSTEM_COMMITTEES_COLLECTION), { name: committeeName.trim(), createdAt: Timestamp.now() });
    revalidatePath('/superior-admin');
    revalidatePath('/'); // For participant form dropdowns
    revalidatePath('/public'); // For public filters
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

  // Step 1: Identify unique schools and committees from the import
  const uniqueImportSchools = new Set(parsedParticipants.map(p => p.school.trim()).filter(s => s));
  const uniqueImportCommittees = new Set(parsedParticipants.map(p => p.committee.trim()).filter(c => c));

  // Step 2: Get existing system schools and committees
  const existingSystemSchools = await getSystemSchools();
  const existingSystemCommittees = await getSystemCommittees();

  // Step 3: Add new schools to system_schools collection
  for (const schoolName of uniqueImportSchools) {
    if (!existingSystemSchools.includes(schoolName)) {
      const schoolRef = doc(collection(db, SYSTEM_SCHOOLS_COLLECTION));
      batch.set(schoolRef, { name: schoolName, createdAt: Timestamp.now() });
      newSchoolsCount++;
    }
  }

  // Step 4: Add new committees to system_committees collection
  for (const committeeName of uniqueImportCommittees) {
    if (!existingSystemCommittees.includes(committeeName)) {
      const committeeRef = doc(collection(db, SYSTEM_COMMITTEES_COLLECTION));
      batch.set(committeeRef, { name: committeeName, createdAt: Timestamp.now() });
      newCommitteesCount++;
    }
  }

  // Step 5: Add participants
  for (const data of parsedParticipants) {
    try {
      const newParticipant: Omit<Participant, 'id'> = {
        name: data.name.trim(),
        school: data.school.trim(),
        committee: data.committee.trim(),
        status: 'Absent',
        imageUrl: `https://placehold.co/40x40.png?text=${data.name.substring(0,2).toUpperCase()}`,
        createdAt: Timestamp.now(),
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
    // If batch fails, all operations are rolled back.
    // The counts will reflect what was attempted, not what succeeded.
    throw new Error("Batch import failed. No participants or new schools/committees were added.");
  }

  if (importedCount > 0 || newSchoolsCount > 0 || newCommitteesCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/superior-admin');
  }
  return { count: importedCount, errors: errorCount, newSchools: newSchoolsCount, newCommittees: newCommitteesCount };
}
