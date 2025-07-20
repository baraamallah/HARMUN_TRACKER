// src/lib/constants.ts
import { 
  CheckCircle, XCircle, Coffee, UserRound,
  Wrench, LogOutIcon, AlertOctagon, Users as UsersIcon,
} from 'lucide-react';
import type { AttendanceStatus, StaffAttendanceStatus } from '@/types';


/**
 * The Firebase Authentication UID of the designated "Owner" or "Superior Administrator" of the application.
 * This UID is used to grant special permissions for accessing sensitive areas like the Superior Admin panel
 * and for performing system-wide administrative actions.
 *
 * !!! CRITICAL SECURITY NOTE !!!
 * If you change this UID, you MUST ALSO update it in your Firebase project's
 * Firestore Security Rules. The rules provided in README.md use this UID to grant
 * elevated permissions. A mismatch will result in the new owner not having the correct
 * access, or the old owner retaining unintended access via Firestore rules.
 *
 * This UID is referenced in:
 * - src/app/superior-admin/** (all pages for access control)
 * - src/components/layout/AppLayoutClientShell.tsx (to conditionally show the Superior Admin link)
 * - Firestore Security Rules (in your Firebase project console, see README.md for examples)
 */
export const OWNER_UID = "JZgMG6xdwAYInXsdciaGj6qNAsG2";


export const ALL_ATTENDANCE_STATUSES_OPTIONS: { status: AttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'Present', label: 'Present', icon: CheckCircle },
    { status: 'Absent', label: 'Absent', icon: XCircle },
    { status: 'Present On Account', label: 'Present (On Account)', icon: AlertOctagon },
    { status: 'In Break', label: 'In Break', icon: Coffee },
    { status: 'Restroom Break', label: 'Restroom Break', icon: UserRound },
    { status: 'Technical Issue', label: 'Technical Issue', icon: Wrench },
    { status: 'Stepped Out', label: 'Stepped Out', icon: LogOutIcon },
];

export const ALL_STAFF_STATUS_FILTER_OPTIONS: { status: StaffAttendanceStatus | 'All'; label: string; }[] = [
    { status: 'All', label: 'All Statuses' },
    { status: 'On Duty', label: 'On Duty' },
    { status: 'Off Duty', label: 'Off Duty' },
    { status: 'On Break', label: 'On Break' },
    { status: 'Away', label: 'Away' },
];

export const STAFF_BULK_STATUS_OPTIONS: { status: StaffAttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'On Duty', label: 'On Duty', icon: UsersIcon },
    { status: 'Off Duty', label: 'Off Duty', icon: UsersIcon },
    { status: 'On Break', label: 'On Break', icon: UsersIcon },
    { status: 'Away', label: 'Away', icon: UsersIcon },
];
