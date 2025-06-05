
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
  birthday?: string | null; // Store as ISO string (YYYY-MM-DD) or null
  createdAt?: string | any; // Can be Firebase Timestamp client-side or ISO string from server
  updatedAt?: string | any; // Can be Firebase Timestamp client-side or ISO string from server
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
}

// Used for managing admin users in the superior admin panel
export interface AdminManagedUser {
  id: string; // Firestore document ID (this IS the Auth UID)
  email: string;
  displayName?: string | null;
  role: 'admin' | string; 
  createdAt?: string | any; // Firebase Timestamp or ISO string
  updatedAt?: string | any; // Firebase Timestamp or ISO string
  avatarUrl?: string; // Optional avatar URL
}
