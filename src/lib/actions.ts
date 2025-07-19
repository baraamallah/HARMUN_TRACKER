
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
  FieldValue as FirestoreFieldValue,
  updateDoc,
  writeBatch,
  setDoc,
  addDoc,
} from 'firebase/firestore';
import type { Participant, AttendanceStatus, StaffMember, FieldValueType, ActionResult, StaffAttendanceStatus, ActionResultStaff } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Attempting to read default participant status.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultAttendanceStatus) {
      return docSnap.data().defaultAttendanceStatus as AttendanceStatus;
    }
    console.log(`[Server Action - getDefaultAttendanceStatusSetting] No setting found or field missing, returning 'Absent'.`);
    return 'Absent'; // Default fallback
  } catch (error) {
    console.error("[Server Action] Error fetching default participant attendance status setting: ", error);
    return 'Absent'; // Default fallback on error
  }
}

export async function getDefaultStaffStatusSetting(): Promise<StaffAttendanceStatus> {
  console.log(`[Server Action - getDefaultStaffStatusSetting] Attempting to read default staff status.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().defaultStaffStatus) {
      return docSnap.data().defaultStaffStatus as StaffAttendanceStatus;
    }
    console.log(`[Server Action - getDefaultStaffStatusSetting] No setting found or field missing, returning 'Off Duty'.`);
    return 'Off Duty'; // Default fallback
  } catch (error) {
    console.error("[Server Action] Error fetching default staff status setting: ", error);
    return 'Off Duty'; // Default fallback on error
  }
}

export async function getSystemLogoUrlSetting(): Promise<string | null> {
  console.log(`[Server Action - getSystemLogoUrlSetting] Attempting to read event logo URL.`);
  try {
    const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists() && docSnap.data().eventLogoUrl) {
      return docSnap.data().eventLogoUrl as string;
    }
    console.log(`[Server Action - getSystemLogoUrlSetting] No logo URL setting found or field missing.`);
    return null;
  } catch (error) {
    console.error("[Server Action] Error fetching event logo URL setting: ", error);
    return null;
  }
}


export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    const participantsColRef = collection(db, PARTICIPANTS_COLLECTION);
    
    // Base query with ordering
    let q = query(participantsColRef, orderBy('name'));

    // Note: Firestore does not support combining inequality filters with orderBy on a different field,
    // or multiple inequality filters on different fields. Search/filter logic must be carefully constructed.
    // For this reason, we fetch a base set and then apply text search client-side or server-side.
    // Here we apply Firestore 'where' clauses for exact matches.
    
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

    if(queryConstraints.length > 0) {
        q = query(participantsColRef, ...queryConstraints, orderBy('name'));
    }

    const querySnapshot = await getDocs(q);
    let participantsData = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || '',
        school: data.school || '',
        committee: data.committee || '',
        country: data.country || '',
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

    // Apply search term filtering after fetching from Firestore
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      participantsData = participantsData.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.school.toLowerCase().includes(term) ||
        p.committee.toLowerCase().includes(term) ||
        (p.country && p.country.toLowerCase().includes(term))
      );
    }
    return participantsData;
  } catch (error) {
      console.error("[Server Action - getParticipants] Error fetching participants. Filters:", filters, "Error:", error);
      const firebaseError = error as { code?: string; message?: string };
      let detailedMessage = `Failed to fetch participants. Firebase Code: ${firebaseError.code || 'Unknown'}.`;
      if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index')) {
        detailedMessage += " A Firestore index is required. Check browser console or server logs for a link to create it.";
      } else if (firebaseError.code === 'permission-denied') {
        detailedMessage += " Permission denied. Check Firestore rules.";
      }
      throw new Error(detailedMessage);
  }
}

export async function getStaffMembers(filters?: { team?: string; searchTerm?: string; status?: StaffAttendanceStatus | 'All' }): Promise<StaffMember[]> {
    try {
        const staffColRef = collection(db, STAFF_MEMBERS_COLLECTION);
        const queryConstraints = [];

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
                department: data.department || '',
                team: data.team || '',
                email: data.email || '',
                phone: data.phone || '',
                contactInfo: data.contactInfo || '',
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
                s.role.toLowerCase().includes(term) ||
                (s.department && s.department.toLowerCase().includes(term)) ||
                (s.team && s.team.toLowerCase().includes(term))
            );
        }

        return staffData;
    } catch (error) {
        console.error("[Server Action - getStaffMembers] Error fetching staff. Filters:", filters, "Error:", error);
        const firebaseError = error as { code?: string; message?: string };
        let detailedMessage = `Failed to fetch staff members. Firebase Code: ${firebaseError.code || 'Unknown'}.`;
        if (firebaseError.code === 'failed-precondition' || firebaseError.message?.includes('requires an index')) {
            detailedMessage += " A Firestore index is required. Check browser console or server logs for a link to create it.";
        } else if (firebaseError.code === 'permission-denied') {
            detailedMessage += " Permission denied. Check Firestore rules.";
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
        country: data.country || '',
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

export type ParticipantImportValidationResult = {
  detectedNewSchools: string[];
  detectedNewCommittees: string[];
  message?: string;
};

export async function validateParticipantImportData(
  parsedParticipants: Array<Partial<Omit<Participant, 'id' | 'status' | 'imageUrl' | 'attended' | 'checkInTime' | 'createdAt' | 'updatedAt'>> & { name: string; school: string; committee: string; }>
): Promise<ParticipantImportValidationResult> {
  console.log("[Server Action: validateParticipantImportData] Validating participant data and checking for new schools/committees.");

  const detectedNewSchoolNames: Set<string> = new Set();
  const detectedNewCommitteeNames: Set<string> = new Set();

  let existingSystemSchools: string[];
  let existingSystemCommittees: string[];
  try {
    existingSystemSchools = await getSystemSchools();
    existingSystemCommittees = await getSystemCommittees();
  } catch (e: any) {
    const detailedErrorMessage = `[Server Action: validateParticipantImportData] Critical error fetching system schools/committees during validation. Firebase: ${e.code} - ${e.message || String(e)}.`;
    console.error(detailedErrorMessage, e);
    return {
      detectedNewSchools: Array.from(detectedNewSchoolNames),
      detectedNewCommittees: Array.from(detectedNewCommitteeNames),
      message: `Error during validation: ${detailedErrorMessage}`,
    };
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
    } catch (error) {
      console.error("[Server Action: validateParticipantImportData] Error processing a participant record for validation: ", data, error);
    }
  }

  return {
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
        country: updatedData?.country || '',
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
    let message = 'An error occurred while updating participant status. Please try again.';
    let errorType = 'generic_error';
     if (error.code === 'permission-denied') {
      message = `Permission Denied on '${PARTICIPANTS_COLLECTION}' collection: Could not update participant status. This action may require administrator privileges or adjustments to Firestore security rules to allow status updates by general authenticated users.`;
      errorType = 'permission_denied';
    } else if (error.code) {
      message = `Update failed on '${PARTICIPANTS_COLLECTION}'. Error: ${error.code}. Please check server logs and try again.`;
      errorType = error.code;
    }
    return {
      success: false,
      message: message,
      errorType: errorType,
    };
  }
}

export async function quickSetStaffStatusAction(
  staffId: string,
  newStatus: StaffAttendanceStatus
): Promise<ActionResultStaff> {
  if (!staffId) {
    return { success: false, message: 'Staff Member ID is required.', errorType: 'missing_id' };
  }

  try {
    const staffMemberRef = doc(db, STAFF_MEMBERS_COLLECTION, staffId);
    const staffMemberSnap = await getDoc(staffMemberRef);

    if (!staffMemberSnap.exists()) {
      return { success: false, message: `Staff member with ID "${staffId}" not found.`, errorType: 'not_found' };
    }

    const staffMemberData = staffMemberSnap.data() as StaffMember;
    const updates: Partial<StaffMember> & { updatedAt: FieldValueType } = {
      status: newStatus,
      updatedAt: fsServerTimestamp(),
    };

    await updateDoc(staffMemberRef, updates as { [x: string]: any; });

    const updatedSnap = await getDoc(staffMemberRef);
    const updatedData = updatedSnap.data();
    const updatedStaffMember: StaffMember = {
        id: updatedSnap.id,
        name: updatedData?.name || '',
        role: updatedData?.role || '',
        department: updatedData?.department,
        team: updatedData?.team,
        email: updatedData?.email,
        phone: updatedData?.phone,
        contactInfo: updatedData?.contactInfo,
        status: updatedData?.status || 'Off Duty',
        imageUrl: updatedData?.imageUrl,
        notes: updatedData?.notes,
        createdAt: updatedData?.createdAt instanceof Timestamp ? updatedData.createdAt.toDate().toISOString() : updatedData?.createdAt,
        updatedAt: updatedData?.updatedAt instanceof Timestamp ? updatedData.updatedAt.toDate().toISOString() : updatedData?.updatedAt,
    };

    revalidatePath(`/staff-checkin`, 'page');
    revalidatePath(`/staff/${staffId}`);
    revalidatePath('/staff');
    revalidatePath('/superior-admin');


    return {
      success: true,
      message: `Status for ${staffMemberData.name} updated to ${newStatus}.`,
      staffMember: updatedStaffMember,
    };
  } catch (error: any) {
    console.error(`[Server Action - quickSetStaffStatusAction] Error for ID ${staffId}, status ${newStatus}:`, error);
    let message = 'An error occurred while updating staff status. Please try again.';
    let errorType = 'generic_error';
    if (error.code === 'permission-denied') {
      message = `Permission Denied on '${STAFF_MEMBERS_COLLECTION}' collection: Could not update staff status. This action may require administrator privileges or adjustments to Firestore security rules to allow status updates by general authenticated users.`;
      errorType = 'permission_denied';
    } else if (error.code) {
      message = `Update failed on '${STAFF_MEMBERS_COLLECTION}'. Error: ${error.code}. Please check server logs and try again.`;
      errorType = error.code;
    }
    return {
      success: false,
      message: message,
      errorType: errorType,
    };
  }
}

export type StaffImportValidationResult = {
  detectedNewTeams: string[];
  message?: string;
};

export async function validateStaffImportData(
  parsedStaffMembers: Array<Partial<Omit<StaffMember, 'id' | 'status' | 'imageUrl' | 'createdAt' | 'updatedAt'>> & { name: string; role: string; }>
): Promise<StaffImportValidationResult> {
  console.log("[Server Action: validateStaffImportData] Validating staff data and checking for new teams.");
  
  const detectedNewTeamNames: Set<string> = new Set();
  
  let existingSystemStaffTeams: string[];
  try {
    existingSystemStaffTeams = await getSystemStaffTeams();
  } catch(e: any) {
    const detailedErrorMessage = `[Server Action: validateStaffImportData] Critical error fetching system staff teams during validation. Firebase: ${e.code} - ${e.message || String(e)}.`;
    console.error(detailedErrorMessage, e);
    return {
      detectedNewTeams: Array.from(detectedNewTeamNames),
      message: `Error during validation: ${detailedErrorMessage}`,
    };
  }

  for (const data of parsedStaffMembers) {
    try {
      const trimmedTeam = data.team?.trim();
      if (trimmedTeam && !existingSystemStaffTeams.includes(trimmedTeam)) {
        detectedNewTeamNames.add(trimmedTeam);
      }
    } catch (error) {
      console.error("[Server Action: validateStaffImportData] Error processing a staff record for validation: ", data, error);
    }
  }

  return {
    detectedNewTeams: Array.from(detectedNewTeamNames),
  };
}
