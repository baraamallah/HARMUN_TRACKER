
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
  // 2-Day Conference Support
  dayAttendance?: {
    day1?: boolean;
    day2?: boolean;
  };
  checkInTimes?: {
    day1?: string | FieldValueType | null | undefined;
    day2?: string | FieldValueType | null | undefined;
  };
  createdAt?: string | FieldValueType | null | undefined;
  updatedAt?: string | FieldValueType | null | undefined;
  restroomBreakStartTime?: string | null;
}

export type StaffAttendanceStatus =
  | "On Duty"
  | "Off Duty"
  | "On Break"
  | "Away";

export interface StaffPermissions {
  canEditParticipants: boolean;
  canEditParticipantStatus: boolean;
  canEditStaff: boolean;
  canEditStaffStatus: boolean;
}

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
  permissions?: StaffPermissions;
  createdAt?: string | FieldValueType | null | undefined;
  updatedAt?: string | FieldValueType | null | undefined;
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


export type UserRole = 'owner' | 'admin' | 'session_manager' | 'user';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type LogCategory = 'authentication' | 'data_change' | 'user_action' | 'system_event' | 'error' | 'security';

export interface SystemLog {
  id: string;
  timestamp: string | FieldValueType;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  ipAddress?: string;
  userAgent?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  restroomAlerts: boolean;
  systemNotifications: boolean;
  userActivityAlerts: boolean;
  errorNotifications: boolean;
  securityAlerts: boolean;
}

export interface AdminManagedUser {
  id: string;
  email: string;
  displayName?: string | null;
  role: 'admin' | 'session_manager' | string;
  defaultCommittee?: string | null;
  sessionNotes?: string;
  canAccessSuperiorAdmin?: boolean; // New permission flag
  sessionState?: {
    lastActivity?: string | FieldValueType;
    currentSession?: string;
    isActive?: boolean;
    preferences?: Record<string, any>;
  };
  notificationPreferences?: NotificationPreferences;
  permissions?: {
    canEditParticipants: boolean;
    canDeleteParticipants: boolean;
    canCreateStaff: boolean;
    canEditStaff: boolean;
    canDeleteStaff: boolean;
    canAccessAnalytics: boolean;
    canManageQRCodes: boolean;
    canReceiveNotifications: boolean;
    canAccessLogs: boolean;
    canExportData: boolean;
    canManageSessions: boolean;
    canViewSystemStatus: boolean;
  };
  createdAt?: string | FieldValueType | undefined;
  updatedAt?: string | FieldValueType | undefined;
  imageUrl?: string;
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

export interface AnalyticsData {
  totalParticipants: number;
  totalStaff: number;
  totalSchools: number;
  totalCommittees: number;
  participantsByCommittee: { committee: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
  staffStatusDistribution: { status: string; count: number }[];
  staffByTeam: { team: string; count: number }[];
}
