export type AttendanceStatus = "Present" | "Absent" | "Present On Account";

export interface Participant {
  id: string;
  name: string;
  school: string;
  committee: string;
  status: AttendanceStatus;
  imageUrl?: string; 
}

export interface School {
  id: string;
  name: string;
}

export interface Committee {
  id: string;
  name: string;
}
