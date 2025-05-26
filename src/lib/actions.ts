
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
  limit,
  Timestamp // Import Timestamp for potential future use
} from 'firebase/firestore';
import type { Participant, AttendanceStatus } from '@/types';

const PARTICIPANTS_COLLECTION = 'participants';

export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    const participantsCol = collection(db, PARTICIPANTS_COLLECTION);
    let q = query(participantsCol, orderBy('name')); // Default sort by name

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
    
    // Apply where clauses if any
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

    // Client-side filtering for searchTerm as Firestore doesn't support partial text search across multiple fields easily
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
    return [];
  }
}

export async function getSchools(): Promise<string[]> {
  try {
    const participantsSnapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const schools = new Set<string>();
    participantsSnapshot.docs.forEach(doc => {
      schools.add(doc.data().school as string);
    });
    return Array.from(schools).sort();
  } catch (error) {
    console.error("Error fetching schools: ", error);
    return [];
  }
}

export async function getCommittees(): Promise<string[]> {
  try {
    const participantsSnapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const committees = new Set<string>();
    participantsSnapshot.docs.forEach(doc => {
      committees.add(doc.data().committee as string);
    });
    return Array.from(committees).sort();
  } catch (error) {
    console.error("Error fetching committees: ", error);
    return [];
  }
}

export async function addParticipant(participantData: Omit<Participant, 'id' | 'status' | 'imageUrl'>): Promise<Participant | null> {
  try {
    const newParticipantData = {
      ...participantData,
      status: 'Absent' as AttendanceStatus, // Default status
      imageUrl: 'https://placehold.co/40x40.png', // Default placeholder
      // Firestore typically uses server timestamps for creation/update times
      // createdAt: Timestamp.now() 
    };
    const docRef = await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipantData);
    revalidatePath('/');
    revalidatePath('/public');
    return { id: docRef.id, ...newParticipantData };
  } catch (error) {
    console.error("Error adding participant: ", error);
    return null;
  }
}

export async function updateParticipant(participantId: string, participantData: Partial<Omit<Participant, 'id'>>): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await updateDoc(participantRef, participantData);
    revalidatePath('/');
    revalidatePath('/public');
    // To return the updated participant, we might need to fetch it again or merge
    // For simplicity, we'll assume the update was successful and the client can update its state
    const updatedDoc = { id: participantId, ...participantData } as Participant; // This is partial, client needs to merge
    return updatedDoc; // Or fetch the document again to return the full object
  } catch (error) {
    console.error("Error updating participant: ", error);
    return null;
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
    return { success: false };
  }
}

export async function markAttendance(participantId: string, status: AttendanceStatus): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    await updateDoc(participantRef, { status });
    revalidatePath('/');
    revalidatePath('/public');
    // Similar to updateParticipant, returning a partial or re-fetching might be needed
    return { id: participantId, status } as Partial<Participant> as Participant; // Cast for now
  } catch (error) {
    console.error("Error marking attendance: ", error);
    return null;
  }
}

export async function importParticipants(parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[]): Promise<{ count: number, errors: number }> {
  let importedCount = 0;
  let errorCount = 0;

  for (const data of parsedParticipants) {
    try {
      // Check for duplicates based on name, school, and committee before adding
      // This requires a query, which can be slow for large batch imports.
      // For simplicity, we're not implementing a robust duplicate check here.
      // A more robust solution might involve a batch write or unique constraints if supported.
      const newParticipant: Omit<Participant, 'id'> = {
        ...data,
        status: 'Absent',
        imageUrl: 'https://placehold.co/40x40.png',
      };
      await addDoc(collection(db, PARTICIPANTS_COLLECTION), newParticipant);
      importedCount++;
    } catch (error) {
      console.error("Error importing participant data: ", data, error);
      errorCount++;
    }
  }

  if (importedCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
  }
  return { count: importedCount, errors: errorCount };
}
