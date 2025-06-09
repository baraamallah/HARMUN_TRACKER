
import type { FieldValue as FirestoreFieldValue } from 'firebase/firestore'; // Renamed to avoid local conflicts

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
  status: AttendanceStatus;
  imageUrl?: string;
  notes?: string;
  additionalDetails?: string;
  classGrade?: string;
  email?: string;
  phone?: string;
  createdAt?: string | FieldValueType | undefined; // string when read, FieldValueType when writing
  updatedAt?: string | FieldValueType | undefined; // string when read, FieldValueType when writing
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
