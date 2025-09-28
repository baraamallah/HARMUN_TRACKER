
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
  getCountFromServer,
} from 'firebase/firestore';
import type { Participant, AttendanceStatus, StaffMember, FieldValueType, ActionResult, StaffAttendanceStatus, ActionResultStaff, AnalyticsData } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';
const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';


// --- Data Transformation Helpers ---

/**
 * Safely converts a Firestore Timestamp, a date string, or other values to an ISO string or null.
 * @param dateValue The value to convert.
 * @returns An ISO date string or null.
 */
function toISODateString(dateValue: any): string | null {
  if (!dateValue) return null;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toISOString();
  }
  if (typeof dateValue === 'string') {
    // Basic check if it's already an ISO string
    if (!isNaN(Date.parse(dateValue))) {
       return new Date(dateValue).toISOString();
    }
  }
  // For serverTimestamp() on write/update, this might be null on immediate read.
  // Returning null is a safe default.
  return null;
}


/**
 * Transforms raw Firestore participant data into a consistent, serializable Participant object.
 * @param docSnap A Firestore document snapshot.
 * @returns A Participant object with standardized data types.
 */
function transformParticipantDoc(docSnap: { id: string; data: () => any; }): Participant {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        name: data.name || '',
        school: data.school || '',
        committee: data.committee || '',
        country: data.country || '',
        status: data.status || 'Absent',
        imageUrl: data.imageUrl,
        notes: data.notes || '',
        additionalDetails: data.additionalDetails || '',
        classGrade: data.classGrade || '',
        email: data.email || '',
        phone: data.phone || '',
        attended: data.attended || false,
        checkInTime: toISODateString(data.checkInTime),
        createdAt: toISODateString(data.createdAt),
        updatedAt: toISODateString(data.updatedAt),
    };
}

/**
 * Transforms raw Firestore staff data into a consistent, serializable StaffMember object.
 * @param docSnap A Firestore document snapshot.
 * @returns A StaffMember object with standardized data types.
 */
function transformStaffDoc(docSnap: { id: string; data: () => any; }): StaffMember {
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
        notes: data.notes || '',
        createdAt: toISODateString(data.createdAt),
        updatedAt: toISODateString(data.updatedAt),
    };
}


// --- Setting Actions ---

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

// --- Data Fetching Actions ---

export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    const participantsColRef = collection(db, PARTICIPANTS_COLLECTION);
    
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

    const q = query(participantsColRef, ...queryConstraints, orderBy('name'));

    const querySnapshot = await getDocs(q);
    let participantsData = querySnapshot.docs.map(docSnap => transformParticipantDoc(docSnap));

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

        let staffData = querySnapshot.docs.map(docSnap => transformStaffDoc(docSnap));

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
        }
        throw new Error(detailedMessage);
    }
}

export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  try {
    const staffMemberRef = doc(db, STAFF_MEMBERS_COLLECTION, id);
    const docSnap = await getDoc(staffMemberRef);
    return docSnap.exists() ? transformStaffDoc(docSnap) : null;
  } catch (error) {
    console.error(`[Server Action - getStaffMemberById] Error fetching staff member by ID ${id}: `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch staff member (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}.`);
  }
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, id);
    const docSnap = await getDoc(participantRef);
    return docSnap.exists() ? transformParticipantDoc(docSnap) : null;
  } catch (error) {
    console.error(`[Server Action - getParticipantById (Public/Fallback)] Error fetching participant by ID ${id}: `, error);
    const firebaseError = error as { code?: string; message?: string };
    throw new Error(`Failed to fetch participant (Server Action). Firebase Code: ${firebaseError.code || 'Unknown'}. Message: ${firebaseError.message || String(error)}.`);
  }
}


// System List Actions
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

export async function addSystemItems(items: { newSchools: string[], newCommittees: string[], newTeams: string[] }): Promise<{ success: boolean; message?: string }> {
  console.log("[Server Action: addSystemItems] Attempting to add new system items.", items);
  const batch = writeBatch(db);
  const { newSchools, newCommittees, newTeams } = items;

  try {
    // Handle new schools
    if (newSchools.length > 0) {
      const schoolsRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
      const existingSchools = (await getDocs(schoolsRef)).docs.map(d => d.data().name);
      newSchools.forEach(schoolName => {
        if (!existingSchools.includes(schoolName)) {
          const docRef = doc(schoolsRef);
          batch.set(docRef, { name: schoolName, createdAt: fsServerTimestamp() });
        }
      });
    }

    // Handle new committees
    if (newCommittees.length > 0) {
      const committeesRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
      const existingCommittees = (await getDocs(committeesRef)).docs.map(d => d.data().name);
      newCommittees.forEach(committeeName => {
        if (!existingCommittees.includes(committeeName)) {
          const docRef = doc(committeesRef);
          batch.set(docRef, { name: committeeName, createdAt: fsServerTimestamp() });
        }
      });
    }

    // Handle new staff teams
    if (newTeams.length > 0) {
      const teamsRef = collection(db, SYSTEM_STAFF_TEAMS_COLLECTION);
      const existingTeams = (await getDocs(teamsRef)).docs.map(d => d.data().name);
      newTeams.forEach(teamName => {
        if (!existingTeams.includes(teamName)) {
          const docRef = doc(teamsRef);
          batch.set(docRef, { name: teamName, createdAt: fsServerTimestamp() });
        }
      });
    }

    await batch.commit();
    console.log("[Server Action: addSystemItems] Successfully added new system items.");
    revalidatePath('/'); // Revalidate relevant paths
    revalidatePath('/staff');
    return { success: true };

  } catch (error: any) {
    console.error("[Server Action: addSystemItems] Error adding new system items: ", error);
    return { success: false, message: `Failed to add new system items. Server error: ${error.message}` };
  }
}


// --- Import Validation Actions ---

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

  try {
    const [existingSystemSchools, existingSystemCommittees] = await Promise.all([getSystemSchools(), getSystemCommittees()]);

    for (const data of parsedParticipants) {
        const trimmedSchool = data.school.trim();
        const trimmedCommittee = data.committee.trim();

        if (trimmedSchool && !existingSystemSchools.includes(trimmedSchool)) {
            detectedNewSchoolNames.add(trimmedSchool);
        }
        if (trimmedCommittee && !existingSystemCommittees.includes(trimmedCommittee)) {
            detectedNewCommitteeNames.add(trimmedCommittee);
        }
    }

    return {
        detectedNewSchools: Array.from(detectedNewSchoolNames),
        detectedNewCommittees: Array.from(detectedNewCommitteeNames),
    };
  } catch (e: any) {
    const detailedErrorMessage = `[Server Action: validateParticipantImportData] Critical error fetching system lists during validation. Firebase: ${e.code} - ${e.message || String(e)}.`;
    console.error(detailedErrorMessage, e);
    return {
      detectedNewSchools: [],
      detectedNewCommittees: [],
      message: `Error during validation: ${detailedErrorMessage}`,
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
  
  try {
    const existingSystemStaffTeams = await getSystemStaffTeams();

    for (const data of parsedStaffMembers) {
      const trimmedTeam = data.team?.trim();
      if (trimmedTeam && !existingSystemStaffTeams.includes(trimmedTeam)) {
        detectedNewTeamNames.add(trimmedTeam);
      }
    }
    return { detectedNewTeams: Array.from(detectedNewTeamNames) };
  } catch(e: any) {
    const detailedErrorMessage = `[Server Action: validateStaffImportData] Critical error fetching system staff teams during validation. Firebase: ${e.code} - ${e.message || String(e)}.`;
    console.error(detailedErrorMessage, e);
    return {
      detectedNewTeams: [],
      message: `Error during validation: ${detailedErrorMessage}`,
    };
  }
}


// --- Mutation Actions ---

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

    const participantData = participantSnap.data();
    const updates: { [key: string]: any } = {
      status: newStatus,
      updatedAt: fsServerTimestamp(),
    };

    if (options?.isCheckIn && newStatus === 'Present') {
      updates.attended = true;
      if (!participantData.attended || !participantData.checkInTime) {
        updates.checkInTime = fsServerTimestamp();
      }
    }

    await updateDoc(participantRef, updates);

    const updatedSnap = await getDoc(participantRef);
    const updatedParticipant = transformParticipantDoc(updatedSnap);

    revalidatePath(`/checkin`, 'page');
    revalidatePath(`/participants/${participantId}`);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/superior-admin/analytics');


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
    return { success: false, message, errorType };
  }
}

export async function resetParticipantAttendanceAction(participantId: string): Promise<ActionResult> {
  if (!participantId) {
    return { success: false, message: 'Participant ID is required.', errorType: 'missing_id' };
  }

  try {
    const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId);
    const participantSnap = await getDoc(participantRef);

    if (!participantSnap.exists()) {
      return { success: false, message: `Participant with ID "${participantId}" not found.`, errorType: 'not_found' };
    }

    const updates = {
      status: 'Absent' as AttendanceStatus,
      attended: false,
      checkInTime: null,
      updatedAt: fsServerTimestamp(),
    };

    await updateDoc(participantRef, updates);

    const updatedSnap = await getDoc(participantRef);
    const updatedParticipant = transformParticipantDoc(updatedSnap);
    
    revalidatePath(`/checkin`, 'page');
    revalidatePath(`/participants/${participantId}`);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/superior-admin/analytics');

    return {
      success: true,
      message: `Attendance for ${updatedParticipant.name} has been reset.`,
      participant: updatedParticipant,
    };
  } catch (error: any) {
    console.error(`[Server Action - resetParticipantAttendanceAction] Error for ID ${participantId}:`, error);
    return { success: false, message: 'Failed to reset attendance.', errorType: 'generic_error' };
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

    const staffMemberData = staffMemberSnap.data();
    const updates = {
      status: newStatus,
      updatedAt: fsServerTimestamp(),
    };

    await updateDoc(staffMemberRef, updates);

    const updatedSnap = await getDoc(staffMemberRef);
    const updatedStaffMember = transformStaffDoc(updatedSnap);

    revalidatePath(`/staff-checkin`, 'page');
    revalidatePath(`/staff/${staffId}`);
    revalidatePath('/staff');
    revalidatePath('/superior-admin');
    revalidatePath('/superior-admin/analytics');

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
    return { success: false, message, errorType };
  }
}



// --- Analytics Actions ---
export async function getAllAnalyticsData(): Promise<AnalyticsData> {
  try {
    const participantsSnapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const totalParticipants = participantsSnapshot.size;

    const committeeCounts: { [key: string]: number } = {};
    const statusCounts: { [key: string]: number } = {};
    
    participantsSnapshot.docs.forEach(doc => {
      const p = doc.data();
      if (p.committee) {
        committeeCounts[p.committee] = (committeeCounts[p.committee] || 0) + 1;
      }
      if (p.status) {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      }
    });

    const staffSnapshot = await getDocs(collection(db, STAFF_MEMBERS_COLLECTION));
    const totalStaff = staffSnapshot.size;

    const staffStatusCounts: { [key: string]: number } = {};
    const staffTeamCounts: { [key: string]: number } = {};

    staffSnapshot.docs.forEach(doc => {
      const s = doc.data();
      if (s.status) {
        staffStatusCounts[s.status] = (staffStatusCounts[s.status] || 0) + 1;
      }
      if (s.team) {
        staffTeamCounts[s.team] = (staffTeamCounts[s.team] || 0) + 1;
      }
    });

    const [
      totalSchools,
      totalCommittees,
    ] = await Promise.all([
      getCountFromServer(collection(db, SYSTEM_SCHOOLS_COLLECTION)).then(snap => snap.data().count),
      getCountFromServer(collection(db, SYSTEM_COMMITTEES_COLLECTION)).then(snap => snap.data().count),
    ]);

    return {
      totalParticipants,
      totalStaff,
      totalSchools,
      totalCommittees,
      participantsByCommittee: Object.entries(committeeCounts).map(([committee, count]) => ({ committee, count })).sort((a, b) => b.count - a.count),
      statusDistribution: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      staffStatusDistribution: Object.entries(staffStatusCounts).map(([status, count]) => ({ status, count })),
      staffByTeam: Object.entries(staffTeamCounts).map(([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error("[Server Action - getAllAnalyticsData] Error fetching comprehensive analytics: ", error);
    throw new Error("Failed to fetch analytics data. Check server logs for details.");
  }
}
