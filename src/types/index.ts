
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
  country?: string;
  status: AttendanceStatus;
  imageUrl?: string;
  notes?: string;
  additionalDetails?: string;
  classGrade?: string;
  email?: string;
  phone?: string;
  attended?: boolean;
  checkInTime?: string | FieldValueType | null | undefined;
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
  email?: string; // Ensure this exists for import/export
  phone?: string; // Ensure this exists for import/export
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
  country: boolean;
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
  contactInfo: boolean; // Keep this, could be other forms of contact
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

export interface CheckinResult {
  success: boolean;
  message: string;
  participantName?: string;
  checkInDetails?: string;
  errorType?: 'not_found' | 'already_checked_in' | 'generic_error' | 'missing_id';
}

export interface ActionResult {
  success: boolean;
  message: string;
  participant?: Participant;
  errorType?: string;
}

export interface ActionResultStaff {
  success: boolean;
  message: string;
  staffMember?: StaffMember;
  errorType?: string;
}
