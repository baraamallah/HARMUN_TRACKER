
'use server';

import { revalidatePath } from 'next/cache';
import { db } from './firebase';
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp as fsServerTimestamp,
  getDoc,
  writeBatch as fsWriteBatch,
  collection as fsCollection,
  doc as fsDoc,
  FieldValue as FirestoreFieldValue, 
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import type { Participant, AttendanceStatus, AdminManagedUser, StaffMember, FieldValueType, ActionResult } from '@/types';

const PARTICIPANTS_COLLECTION = 'participants';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


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
        email: data.email,
        phone: data.phone,
        attended: data.attended || false, 
        checkInTime: data.checkInTime instanceof Timestamp ? data.checkInTime.toDate().toISOString() : null, 
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
        email: data.email,
        phone: data.phone,
        attended: data.attended || false,
        checkInTime: data.checkInTime instanceof Timestamp ? data.checkInTime.toDate().toISOString() : null,
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


// Import Participants Action
export async function importParticipants(
  parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl' | 'notes' | 'additionalDetails' | 'classGrade' | 'email' | 'phone' | 'createdAt' | 'updatedAt' | 'attended' | 'checkInTime'>[]
): Promise<{ count: number; errors: number; detectedNewSchools: string[]; detectedNewCommittees: string[] }> {

  if (parsedParticipants.length === 0) {
    console.log("[Server Action: importParticipants] No parsed participants to import.");
    return { count: 0, errors: 0, detectedNewSchools: [], detectedNewCommittees: [] };
  }

  let importedCount = 0;
  let errorCount = 0;
  const detectedNewSchoolNames: Set<string> = new Set();
  const detectedNewCommitteeNames: Set<string> = new Set();

  const batch = fsWriteBatch(db);
  const defaultMunStatus = await getDefaultAttendanceStatusSetting();

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
      const newParticipantData: Omit<Participant, 'id'> & { createdAt: FieldValueType, updatedAt: FieldValueType, checkInTime: null } = {
        name: data.name.trim(),
        school: trimmedSchool,
        committee: trimmedCommittee,
        status: defaultMunStatus, 
        imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
        notes: '',
        additionalDetails: '',
        classGrade: '',
        email: '',
        phone: '',
        attended: false, 
        checkInTime: null, 
        createdAt: fsServerTimestamp(),
        updatedAt: fsServerTimestamp(),
      };
      const participantRef = fsDoc(fsCollection(db, PARTICIPANTS_COLLECTION));
      batch.set(participantRef, newParticipantData);
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

export async function quickSetParticipantStatusAction(
  participantId: string,
  newStatus: AttendanceStatus,
  options?: { isCheckIn?: boolean }
): Promise<ActionResult> {
  if (!participantId) {
    return { success: false, message: 'Participant ID is required.', errorType: 'missing_id' };
  }

  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    const participantSnap = await getDoc(participantRef);

    if (!participantSnap.exists()) {
      return { success: false, message: `Participant with ID "${participantId}" not found.`, errorType: 'not_found' };
    }

    const participantData = participantSnap.data() as Participant; 
    const updates: Partial<Participant> & { updatedAt: FieldValueType } = { 
      status: newStatus,
      updatedAt: fsServerTimestamp(),
    };

    if (options?.isCheckIn && newStatus === 'Present') {
      updates.attended = true;
      if (!participantData.attended || !participantData.checkInTime) { 
        updates.checkInTime = fsServerTimestamp();
      }
    }
    
    await updateDoc(participantRef, updates as { [x: string]: any; }); 

    const updatedSnap = await getDoc(participantRef);
    const updatedData = updatedSnap.data();
    const updatedParticipant: Participant = {
        id: updatedSnap.id,
        name: updatedData?.name || '',
        school: updatedData?.school || '',
        committee: updatedData?.committee || '',
        status: updatedData?.status || 'Absent',
        imageUrl: updatedData?.imageUrl,
        notes: updatedData?.notes,
        additionalDetails: updatedData?.additionalDetails,
        classGrade: updatedData?.classGrade,
        email: updatedData?.email,
        phone: updatedData?.phone,
        attended: updatedData?.attended || false,
        checkInTime: updatedData?.checkInTime instanceof Timestamp ? updatedData.checkInTime.toDate().toISOString() : updatedData?.checkInTime,
        createdAt: updatedData?.createdAt instanceof Timestamp ? updatedData.createdAt.toDate().toISOString() : updatedData?.createdAt,
        updatedAt: updatedData?.updatedAt instanceof Timestamp ? updatedData.updatedAt.toDate().toISOString() : updatedData?.updatedAt,
    };

    revalidatePath(`/checkin`, 'page'); 
    revalidatePath(`/participants/${participantId}`); 
    revalidatePath('/'); 
    revalidatePath('/public');

    return {
      success: true,
      message: `Status for ${participantData.name} updated to ${newStatus}.`,
      participant: updatedParticipant,
    };
  } catch (error: any) {
    console.error(`[Server Action - quickSetParticipantStatusAction] Error for ID ${participantId}, status ${newStatus}:`, error);
    let message = 'An error occurred while updating status. Please try again.';
    let errorType = 'generic_error';
    if (error.code === 'permission-denied') {
      message = 'Permission Denied: Could not update participant status. This action may require administrator privileges. Please ensure Firestore rules allow this update or the user has sufficient rights.';
      errorType = 'permission_denied';
    } else if (error.code) { 
      message = `Update failed. Error: ${error.code}. Please check server logs and try again.`;
      errorType = error.code;
    }
    return {
      success: false,
      message: message,
      errorType: errorType,
    };
  }
}
