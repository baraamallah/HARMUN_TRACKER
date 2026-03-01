'use client';

/**
 * Client-side check-in operations. These run in the browser where the user is authenticated,
 * so Firestore rules allow the write. Server actions run without auth context and get PERMISSION_DENIED.
 */
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentConferenceDay } from '@/lib/actions';
import type { Participant, AttendanceStatus, ActionResult } from '@/types';

const PARTICIPANTS_COLLECTION = 'participants';

function toISODateString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string' && !isNaN(Date.parse(val))) return new Date(val).toISOString();
  return null;
}

function transformParticipantDoc(docSnap: { id: string; data: () => any }): Participant {
  const data = docSnap.data();
  return {
    id: String(docSnap.id),
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
    dayAttendance: data.dayAttendance || { day1: false, day2: false },
    checkInTimes: {
      day1: toISODateString(data.checkInTimes?.day1),
      day2: toISODateString(data.checkInTimes?.day2),
    },
    createdAt: toISODateString(data.createdAt),
    updatedAt: toISODateString(data.updatedAt),
  };
}

export async function quickSetParticipantStatusClient(
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
    const currentDay = await getCurrentConferenceDay();

    const isEffectivelyPresent = newStatus !== 'Absent' && newStatus !== 'Stepped Out';
    const dayAttendance = participantData.dayAttendance || { day1: false, day2: false };
    if (isEffectivelyPresent) {
      dayAttendance[currentDay] = true;
    }

    const updates: Record<string, any> = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    };

    if (isEffectivelyPresent) {
      updates.dayAttendance = dayAttendance;
    }

    if (options?.isCheckIn && newStatus === 'Present') {
      updates.attended = true;
      if (!participantData.attended || !participantData.checkInTime) {
        updates.checkInTime = serverTimestamp();
      }
      const checkInTimes = participantData.checkInTimes || {};
      if (!checkInTimes[currentDay]) {
        checkInTimes[currentDay] = serverTimestamp();
        updates.checkInTimes = checkInTimes;
      }
    }

    await updateDoc(participantRef, updates as any);

    const updatedSnap = await getDoc(participantRef);
    const updatedParticipant = transformParticipantDoc(updatedSnap);

    return {
      success: true,
      message: `Status for ${participantData.name} updated to ${newStatus}.`,
      participant: updatedParticipant,
    };
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    console.error('[Client check-in] Error:', e);
    let message = 'An error occurred while updating participant status.';
    let errorType = 'generic_error';
    if (e?.code === 'permission-denied') {
      message = 'Permission denied. Please ensure you are logged in.';
      errorType = 'permission_denied';
    } else if (e?.code) {
      message = `Update failed. Error: ${e.code}.`;
      errorType = e.code;
    }
    return { success: false, message, errorType };
  }
}

export async function resetParticipantAttendanceClient(participantId: string): Promise<ActionResult> {
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
      updatedAt: serverTimestamp(),
    };

    await updateDoc(participantRef, updates as any);

    const updatedSnap = await getDoc(participantRef);
    const updatedParticipant = transformParticipantDoc(updatedSnap);

    return {
      success: true,
      message: `Attendance for ${updatedParticipant.name} has been reset.`,
      participant: updatedParticipant,
    };
  } catch (error: unknown) {
    const e = error as { code?: string };
    console.error('[Client reset] Error:', e);
    return {
      success: false,
      message: 'Failed to reset attendance.',
      errorType: (e?.code as string) || 'generic_error',
    };
  }
}
