
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
  classGrade?: string; // Changed from birthday
  createdAt?: string | any; 
  updatedAt?: string | any; 
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
  selection?: boolean; // Added for upcoming bulk selection
}

export interface AdminManagedUser {
  id: string; 
  email: string;
  displayName?: string | null;
  role: 'admin' | string; 
  createdAt?: string | any; 
  updatedAt?: string | any; 
  avatarUrl?: string; 
}
