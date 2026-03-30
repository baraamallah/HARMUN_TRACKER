import { Timestamp } from 'firebase/firestore';
import type { Participant, StaffMember } from '@/types';

/**
 * Safely converts a Firestore Timestamp, a date string, or other values to an ISO string or null.
 * Browser-safe version of server-side toISODateString.
 */
export function toISODateString(dateValue: any): string | null {
  if (!dateValue) return null;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toISOString();
  }
  if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
    // Handle plain objects that look like Timestamps (sometimes happens in HMR)
    return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate().toISOString();
  }
  if (typeof dateValue === 'string') {
    if (!isNaN(Date.parse(dateValue))) {
       return new Date(dateValue).toISOString();
    }
  }
  return null;
}

/**
 * Transforms raw Firestore participant data into a serializable Participant object (Client Side).
 */
export function transformParticipantDoc(docId: string, data: any): Participant {
    return {
        id: String(docId),
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

/**
 * Transforms raw Firestore staff data into a serializable StaffMember object (Client Side).
 */
export function transformStaffDoc(docId: string, data: any): StaffMember {
    return {
        id: String(docId),
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
