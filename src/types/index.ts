
import type { FieldValue } from 'firebase/firestore';

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
  createdAt?: string | FieldValue | undefined;
  updatedAt?: string | FieldValue | undefined;
}

export type StaffAttendanceStatus =
  | "On Duty"
  | "Off Duty"
  | "On Break"
  | "Away";

export interface StaffMember {
  id: string;
  name: string;
  role: string; // e.g., "Director", "Volunteer", "Security"
  department?: string; // e.g., "Logistics", "Press", "Crisis"
  team?: string; // New: e.g., "Logistics Team A", "Security Alpha"
  email?: string;
  phone?: string;
  contactInfo?: string;
  status: StaffAttendanceStatus;
  notes?: string;
  imageUrl?: string;
  createdAt?: string | FieldValue | undefined;
  updatedAt?: string | FieldValue | undefined;
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

// Specific for Staff Table, if columns differ significantly or for clarity
export interface StaffVisibleColumns {
  selection?: boolean; // Added selection column
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
  createdAt?: string | FieldValue | undefined;
  updatedAt?: string | FieldValue | undefined;
  avatarUrl?: string;
}

