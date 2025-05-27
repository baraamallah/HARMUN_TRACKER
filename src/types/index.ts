
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
  createdAt?: any; // Can be Firebase Timestamp
  updatedAt?: any; // Can be Firebase Timestamp
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
  id: string; // Firestore document ID (should be the Auth UID)
  uid?: string; // Firebase Auth UID (stored as a field, potentially redundant if id is always Auth UID)
  email: string;
  displayName?: string | null;
  role: 'admin' | string; 
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
  avatarUrl?: string; // Optional avatar URL
}

