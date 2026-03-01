
'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from './supabase';
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
 * Transforms raw Supabase participant data into a consistent, serializable Participant object.
 */
function transformParticipant(data: any): Participant {
    return {
        id: String(data.id),
        name: data.name || '',
        school: data.school || '',
        committee: data.committee || '',
        country: data.country || '',
        status: data.status || 'Absent',
        imageUrl: data.image_url,
        notes: data.notes || '',
        additionalDetails: data.additional_details || '',
        classGrade: data.class_grade || '',
        email: data.email || '',
        phone: data.phone || '',
        attended: data.attended || false,
        checkInTime: data.check_in_time,
        dayAttendance: data.day_attendance || { day1: false, day2: false },
        checkInTimes: {
            day1: data.check_in_times?.day1,
            day2: data.check_in_times?.day2,
        },
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

/**
 * Transforms raw Supabase staff data into a consistent, serializable StaffMember object.
 */
function transformStaff(data: any): StaffMember {
    return {
        id: String(data.id),
        name: data.name || '',
        role: data.role || '',
        department: data.department || '',
        team: data.team || '',
        email: data.email || '',
        phone: data.phone || '',
        contactInfo: data.contact_info || '',
        status: data.status || 'Off Duty',
        imageUrl: data.image_url,
        notes: data.notes || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}


// --- Setting Actions ---

export async function getDefaultAttendanceStatusSetting(): Promise<AttendanceStatus> {
  console.log(`[Server Action - getDefaultAttendanceStatusSetting] Attempting to read default participant status.`);
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('default_attendance_status')
      .eq('id', APP_SETTINGS_DOC_ID)
      .single();

    if (data && !error) {
      return data.default_attendance_status as AttendanceStatus;
    }
    return 'Absent'; // Default fallback
  } catch (error) {
    console.error("[Server Action] Error fetching default participant attendance status setting: ", error);
    return 'Absent'; // Default fallback on error
  }
}

export async function getDefaultStaffStatusSetting(): Promise<StaffAttendanceStatus> {
  console.log(`[Server Action - getDefaultStaffStatusSetting] Attempting to read default staff status.`);
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('default_staff_status')
      .eq('id', APP_SETTINGS_DOC_ID)
      .single();

    if (data && !error) {
      return data.default_staff_status as StaffAttendanceStatus;
    }
    return 'Off Duty'; // Default fallback
  } catch (error) {
    console.error("[Server Action] Error fetching default staff status setting: ", error);
    return 'Off Duty'; // Default fallback on error
  }
}

export async function getSystemLogoUrlSetting(): Promise<string | null> {
  console.log(`[Server Action - getSystemLogoUrlSetting] Attempting to read event logo URL.`);
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('event_logo_url')
      .eq('id', APP_SETTINGS_DOC_ID)
      .single();

    if (data && !error) {
      return data.event_logo_url as string;
    }
    return null;
  } catch (error) {
    console.error("[Server Action] Error fetching event logo URL setting: ", error);
    return null;
  }
}

export async function getCurrentConferenceDay(): Promise<'day1' | 'day2'> {
  console.log(`[Server Action - getCurrentConferenceDay] Attempting to read current conference day.`);
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('current_conference_day')
      .eq('id', APP_SETTINGS_DOC_ID)
      .single();

    if (data && !error) {
      return data.current_conference_day as 'day1' | 'day2';
    }
    return 'day1'; // Default fallback
  } catch (error) {
    console.error("[Server Action] Error fetching current conference day setting: ", error);
    return 'day1'; // Default fallback on error
  }
}

// --- Data Fetching Actions ---

export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string; status?: AttendanceStatus | 'All' }): Promise<Participant[]> {
  try {
    let query = supabase.from('participants').select('*');
    
    if (filters?.school && filters.school !== "All Schools") {
      query = query.eq('school', filters.school);
    }
    if (filters?.committee && filters.committee !== "All Committees") {
      query = query.eq('committee', filters.committee);
    }
    if (filters?.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }
    if (filters?.searchTerm) {
      const term = `%${filters.searchTerm}%`;
      query = query.or(`name.ilike.${term},school.ilike.${term},committee.ilike.${term},country.ilike.${term}`);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return (data || []).map(transformParticipant);
  } catch (error) {
      console.error("[Server Action - getParticipants] Error fetching participants. Filters:", filters, "Error:", error);
      throw new Error(`Failed to fetch participants. ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getStaffMembers(filters?: { team?: string; searchTerm?: string; status?: StaffAttendanceStatus | 'All' }): Promise<StaffMember[]> {
    try {
        let query = supabase.from('staff_members').select('*');
        
        if (filters?.team && filters.team !== "All Teams") {
            query = query.eq('team', filters.team);
        }
        if (filters?.status && filters.status !== 'All') {
            query = query.eq('status', filters.status);
        }
        if (filters?.searchTerm) {
            const term = `%${filters.searchTerm}%`;
            query = query.or(`name.ilike.${term},role.ilike.${term},department.ilike.${term},team.ilike.${term}`);
        }

        const { data, error } = await query.order('name');

        if (error) throw error;

        return (data || []).map(transformStaff);
    } catch (error) {
        console.error("[Server Action - getStaffMembers] Error fetching staff. Filters:", filters, "Error:", error);
        throw new Error(`Failed to fetch staff members. ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  try {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return transformStaff(data);
  } catch (error) {
    console.error(`[Server Action - getStaffMemberById] Error fetching staff member by ID ${id}: `, error);
    throw new Error(`Failed to fetch staff member.`);
  }
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return transformParticipant(data);
  } catch (error) {
    console.error(`[Server Action - getParticipantById (Public/Fallback)] Error fetching participant by ID ${id}: `, error);
    throw new Error(`Failed to fetch participant.`);
  }
}


// System List Actions
export async function getSystemSchools(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('schools').select('name').order('name');
    if (error) throw error;
    return (data || []).map(d => d.name);
  } catch (error) {
    console.error("[Server Action] Error fetching system schools: ", error);
    throw new Error("Failed to fetch system schools.");
  }
}

export async function getSystemCommittees(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('committees').select('name').order('name');
    if (error) throw error;
    return (data || []).map(d => d.name);
  } catch (error) {
    console.error("[Server Action] Error fetching system committees: ", error);
    throw new Error("Failed to fetch system committees.");
  }
}

export async function getSystemStaffTeams(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('staff_teams').select('name').order('name');
    if (error) throw error;
    return (data || []).map(d => d.name);
  } catch (error) {
    console.error("[Server Action] Error fetching system staff teams: ", error);
    throw new Error("Failed to fetch system staff teams.");
  }
}

export async function addSystemItems(items: { newSchools: string[], newCommittees: string[], newTeams: string[] }): Promise<{ success: boolean; message?: string }> {
  console.log("[Server Action: addSystemItems] Attempting to add new system items.", items);
  const { newSchools, newCommittees, newTeams } = items;

  try {
    // Handle new schools
    if (newSchools.length > 0) {
      const { data: existing } = await supabase.from('schools').select('name');
      const existingNames = (existing || []).map(d => d.name);
      const toInsert = newSchools.filter(name => !existingNames.includes(name)).map(name => ({ name }));
      if (toInsert.length > 0) await supabase.from('schools').insert(toInsert);
    }

    // Handle new committees
    if (newCommittees.length > 0) {
      const { data: existing } = await supabase.from('committees').select('name');
      const existingNames = (existing || []).map(d => d.name);
      const toInsert = newCommittees.filter(name => !existingNames.includes(name)).map(name => ({ name }));
      if (toInsert.length > 0) await supabase.from('committees').insert(toInsert);
    }

    // Handle new staff teams
    if (newTeams.length > 0) {
      const { data: existing } = await supabase.from('staff_teams').select('name');
      const existingNames = (existing || []).map(d => d.name);
      const toInsert = newTeams.filter(name => !existingNames.includes(name)).map(name => ({ name }));
      if (toInsert.length > 0) await supabase.from('staff_teams').insert(toInsert);
    }

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
    const { data: participantData, error: fetchError } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (fetchError || !participantData) {
      return { success: false, message: `Participant with ID "${participantId}" not found.`, errorType: 'not_found' };
    }

    const updates: { [key: string]: any } = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Get current conference day
    const currentDay = await getCurrentConferenceDay();

    // ALWAYS mark day attendance when status is updated
    const dayAttendance = participantData.day_attendance || { day1: false, day2: false };
    dayAttendance[currentDay] = true;
    updates.day_attendance = dayAttendance;

    if (options?.isCheckIn && newStatus === 'Present') {
      updates.attended = true;
      if (!participantData.attended || !participantData.check_in_time) {
        updates.check_in_time = new Date().toISOString();
      }
      
      // Update day-specific check-in time
      const checkInTimes = participantData.check_in_times || {};
      if (!checkInTimes[currentDay]) {
        checkInTimes[currentDay] = new Date().toISOString();
        updates.check_in_times = checkInTimes;
      }
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('participants')
      .update(updates)
      .eq('id', participantId)
      .select()
      .single();

    if (updateError) throw updateError;

    revalidatePath(`/checkin`, 'page');
    revalidatePath(`/participants/${participantId}`);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/superior-admin/analytics');

    return {
      success: true,
      message: `Status for ${participantData.name} updated to ${newStatus}.`,
      participant: transformParticipant(updatedData),
    };
  } catch (error: any) {
    console.error(`[Server Action - quickSetParticipantStatusAction] Error for ID ${participantId}, status ${newStatus}:`, error);
    return { success: false, message: error.message || 'An error occurred while updating participant status.', errorType: 'generic_error' };
  }
}

export async function resetParticipantAttendanceAction(participantId: string): Promise<ActionResult> {
  if (!participantId) {
    return { success: false, message: 'Participant ID is required.', errorType: 'missing_id' };
  }

  try {
    const updates = {
      status: 'Absent' as AttendanceStatus,
      attended: false,
      check_in_time: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('participants')
      .update(updates)
      .eq('id', participantId)
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath(`/checkin`, 'page');
    revalidatePath(`/participants/${participantId}`);
    revalidatePath('/');
    revalidatePath('/public');
    revalidatePath('/superior-admin/analytics');

    return {
      success: true,
      message: `Attendance for ${data.name} has been reset.`,
      participant: transformParticipant(data),
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
    const updates = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('staff_members')
      .update(updates)
      .eq('id', staffId)
      .select()
      .single();

    if (error) throw error;

    revalidatePath(`/staff-checkin`, 'page');
    revalidatePath(`/staff/${staffId}`);
    revalidatePath('/staff');
    revalidatePath('/superior-admin');
    revalidatePath('/superior-admin/analytics');

    return {
      success: true,
      message: `Status for ${data.name} updated to ${newStatus}.`,
      staffMember: transformStaff(data),
    };
  } catch (error: any) {
    console.error(`[Server Action - quickSetStaffStatusAction] Error for ID ${staffId}, status ${newStatus}:`, error);
    return { success: false, message: error.message || 'An error occurred while updating staff status.', errorType: 'generic_error' };
  }
}



// --- Analytics Actions ---
export async function switchConferenceDayAction(
  newDay: 'day1' | 'day2'
): Promise<{ success: boolean; message: string; archiveCount?: number }> {
  console.log(`[Server Action - switchConferenceDayAction] Switching to ${newDay}`);
  
  try {
    const currentDay = await getCurrentConferenceDay();
    if (currentDay === newDay) return { success: true, message: `Already on ${newDay}` };

    const defaultStatus = await getDefaultAttendanceStatusSetting();

    const { data: participants, error: fetchError } = await supabase.from('participants').select('id, status, status_history');
    if (fetchError) throw fetchError;

    const updates = (participants || []).map(p => ({
      id: p.id,
      status: defaultStatus,
      updated_at: new Date().toISOString(),
      status_history: {
        ...(p.status_history || {}),
        [currentDay]: {
          status: p.status,
          day: currentDay,
          timestamp: new Date().toISOString()
        }
      }
    }));

    // Chunk updates if needed (Supabase has limits)
    const { error: updateError } = await supabase.from('participants').upsert(updates);
    if (updateError) throw updateError;

    const { error: configError } = await supabase
      .from('system_config')
      .update({ current_conference_day: newDay, updated_at: new Date().toISOString() })
      .eq('id', APP_SETTINGS_DOC_ID);

    if (configError) throw configError;

    revalidatePath('/');
    revalidatePath('/checkin');
    revalidatePath('/public');
    revalidatePath('/superior-admin/analytics');
    revalidatePath('/superior-admin/system-settings');

    return {
      success: true,
      message: `Switched to ${newDay}. ${updates.length} participants archived and reset to "${defaultStatus}".`,
      archiveCount: updates.length,
    };
  } catch (error: any) {
    console.error('[Server Action - switchConferenceDayAction] Error:', error);
    return { success: false, message: `Failed to switch conference day: ${error.message}` };
  }
}

export async function getAllAnalyticsData(): Promise<AnalyticsData> {
  try {
    const [
      { count: totalParticipants },
      { count: totalStaff },
      { count: totalSchools },
      { count: totalCommittees },
      { data: participants },
      { data: staff }
    ] = await Promise.all([
      supabase.from('participants').select('*', { count: 'exact', head: true }),
      supabase.from('staff_members').select('*', { count: 'exact', head: true }),
      supabase.from('schools').select('*', { count: 'exact', head: true }),
      supabase.from('committees').select('*', { count: 'exact', head: true }),
      supabase.from('participants').select('committee, status'),
      supabase.from('staff_members').select('team, status')
    ]);

    const committeeCounts: { [key: string]: number } = {};
    const statusCounts: { [key: string]: number } = {};
    (participants || []).forEach(p => {
      if (p.committee) committeeCounts[p.committee] = (committeeCounts[p.committee] || 0) + 1;
      if (p.status) statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    const staffStatusCounts: { [key: string]: number } = {};
    const staffTeamCounts: { [key: string]: number } = {};
    (staff || []).forEach(s => {
      if (s.status) staffStatusCounts[s.status] = (staffStatusCounts[s.status] || 0) + 1;
      if (s.team) staffTeamCounts[s.team] = (staffTeamCounts[s.team] || 0) + 1;
    });

    return {
      totalParticipants: totalParticipants || 0,
      totalStaff: totalStaff || 0,
      totalSchools: totalSchools || 0,
      totalCommittees: totalCommittees || 0,
      participantsByCommittee: Object.entries(committeeCounts).map(([committee, count]) => ({ committee, count })).sort((a, b) => b.count - a.count),
      statusDistribution: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      staffStatusDistribution: Object.entries(staffStatusCounts).map(([status, count]) => ({ status, count })),
      staffByTeam: Object.entries(staffTeamCounts).map(([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count),
    };
  } catch (error: any) {
    console.error("[Server Action - getAllAnalyticsData] Error fetching comprehensive analytics: ", error);
    throw new Error(`Failed to fetch analytics data.`);
  }
}
