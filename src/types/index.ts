
import type { FieldValue as FirestoreFieldValue } from 'firebase/firestore';

// Generic type for server timestamps used in writes
export type FieldValueType = FirestoreFieldValue;

export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Present On Account"
  | "In Break"
  | "Restroom Break"
  | "Technical Issue"
  | "Stepped Out";

export interface Participant {
  id: string;
  name: string;
  school: string;
  committee: string;
  status: AttendanceStatus; // This status is for general MUN session attendance
  imageUrl?: string;
  notes?: string;
  additionalDetails?: string;
  classGrade?: string;
  email?: string;
  phone?: string;
  attended?: boolean; // For QR code check-in, default false
  checkInTime?: string | FieldValueType | null | undefined; // For QR code check-in time
  createdAt?: string | FieldValueType | undefined;
  updatedAt?: string | FieldValueType | undefined;
}

export type StaffAttendanceStatus =
  | "On Duty"
  | "Off Duty"
  | "On Break"
  | "Away";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department?: string;
  team?: string;
  email?: string;
  phone?: string;
  contactInfo?: string;
  status: StaffAttendanceStatus;
  notes?: string;
  imageUrl?: string;
  createdAt?: string | FieldValueType | undefined;
  updatedAt?: string | FieldValueType | undefined;
}

export interface School {
  id: string;
  name: string;
}

export interface Committee {
  id: string;
  name: string;
}

export interface VisibleColumns {
  avatar: boolean;
  name: boolean;
  school: boolean;
  committee: boolean;
  status: boolean;
  actions: boolean;
  selection?: boolean;
}

export interface StaffVisibleColumns {
  selection?: boolean;
  avatar: boolean;
  name: boolean;
  role: boolean;
  department: boolean;
  team: boolean;
  contactInfo: boolean;
  status: boolean;
  actions: boolean;
}


export interface AdminManagedUser {
  id: string;
  email: string;
  displayName?: string | null;
  role: 'admin' | string;
  createdAt?: string | FieldValueType | undefined;
  updatedAt?: string | FieldValueType | undefined;
  avatarUrl?: string;
}

export interface CheckinResult { // Kept for reference if any part still uses it, but should be replaced by ActionResult
  success: boolean;
  message: string;
  participantName?: string;
  checkInDetails?: string;
  errorType?: 'not_found' | 'already_checked_in' | 'generic_error' | 'missing_id';
}

export interface ActionResult {
  success: boolean;
  message: string;
  participant?: Participant; // Optionally return updated participant data
  errorType?: string; // e.g., 'not_found', 'update_failed', 'missing_id'
}

export interface ActionResultStaff {
  success: boolean;
  message: string;
  staffMember?: StaffMember;
  errorType?: string;
}
