
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldAlert, ArrowLeft, Settings, TriangleAlert, Home, LogOut, Loader2, Workflow, Calendar } from 'lucide-react';
import { auth, db } from '@/lib/firebase'; 
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  getDefaultAttendanceStatusSetting, 
  getDefaultStaffStatusSetting,
  switchConferenceDayAction,
} from '@/lib/actions';
import type { AttendanceStatus, StaffAttendanceStatus } from '@/types';

const ALL_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "Present", "Absent", "Present On Account", "In Break", 
  "Restroom Break", "Technical Issue", "Stepped Out"
];

const ALL_STAFF_ATTENDANCE_STATUSES: StaffAttendanceStatus[] = [
  "On Duty", "Off Duty", "On Break", "Away"
];

const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';

export default function SystemSettingsPage() {
  const pathname = usePathname();
  const { loggedInUser: currentUser, authSessionLoading: isLoadingAuth, userAppRole } = useAuth();
  const { toast } = useToast();
  
  const [currentDefaultParticipantStatus, setCurrentDefaultParticipantStatus] = useState<AttendanceStatus | null>(null);
  const [currentDefaultStaffStatus, setCurrentDefaultStaffStatus] = useState<StaffAttendanceStatus | null>(null);
  const [currentConferenceDay, setCurrentConferenceDay] = useState<'day1' | 'day2'>('day1');
  
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isUpdatingSetting, startUpdateTransition] = useTransition();
  
  const [pendingDaySwitch, setPendingDaySwitch] = useState<'day1' | 'day2' | null>(null);
  const [isSwitchingDay, setIsSwitchingDay] = useState(false);

  const fetchAllSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const [participantStatus, staffStatus] = await Promise.all([
        getDefaultAttendanceStatusSetting(),
        getDefaultStaffStatusSetting(),
      ]);
      setCurrentDefaultParticipantStatus(participantStatus);
      setCurrentDefaultStaffStatus(staffStatus);
      
      // Fetch current conference day
      const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
      const docSnap = await getDoc(configDocRef);
      if (docSnap.exists() && docSnap.data().currentConferenceDay) {
        setCurrentConferenceDay(docSnap.data().currentConferenceDay as 'day1' | 'day2');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load system settings.', variant: 'destructive' });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (!isLoadingAuth && userAppRole === 'owner') {
      fetchAllSettings();
    }
  }, [isLoadingAuth, userAppRole]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const handleConferenceDayChange = (newDay: 'day1' | 'day2') => {
    // Show confirmation dialog
    setPendingDaySwitch(newDay);
  };

  const confirmDaySwitch = async () => {
    if (!pendingDaySwitch) return;
    
    setIsSwitchingDay(true);
    try {
      const result = await switchConferenceDayAction(pendingDaySwitch);
      
      if (result.success) {
        setCurrentConferenceDay(pendingDaySwitch);
        toast({ 
          title: 'Conference Day Switched', 
          description: result.message,
        });
      } else {
        toast({ 
          title: 'Switch Failed', 
          description: result.message, 
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      console.error('Error switching conference day:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to switch conference day.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSwitchingDay(false);
      setPendingDaySwitch(null);
    }
  };

  const handleSettingUpdate = async (settingKey: string, newValue: string | AttendanceStatus | StaffAttendanceStatus) => {
    startUpdateTransition(async () => {
      try {
        const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
        await setDoc(configDocRef, { [settingKey]: newValue, updatedAt: serverTimestamp() }, { merge: true });
        
        if (settingKey === 'defaultAttendanceStatus') setCurrentDefaultParticipantStatus(newValue as AttendanceStatus);
        if (settingKey === 'defaultStaffStatus') setCurrentDefaultStaffStatus(newValue as StaffAttendanceStatus);

        toast({ title: 'Setting Updated', description: `Configuration for "${settingKey}" has been saved.` });
      } catch (error: any) {
        console.error(`Error updating setting ${settingKey}:`, error);
        toast({ 
          title: 'Update Failed', 
          description: error.message || `Could not update ${settingKey}.`, 
          variant: 'destructive' 
        });
        fetchAllSettings(); 
      }
    });
  };

  if (isLoadingAuth || (userAppRole === 'owner' && isLoadingSettings)) { 
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Settings size={32} />
            </div>
            <CardTitle className="text-2xl font-bold">System Settings</CardTitle>
            <CardDescription>Loading settings and verifying credentials...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userAppRole !== 'owner') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-red-500/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-destructive">
          <CardHeader>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert size={48} />
            </div>
            <CardTitle className="text-3xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">
              You do not have permission to access system settings. This page is for the designated Superior Admin only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentUser ? (
              <Button onClick={handleLogout} variant="destructive" size="lg" className="w-full">
                <LogOut className="mr-2 h-5 w-5" /> Logout ({currentUser.email || 'Wrong User'})
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground mt-4">
                Please <Link href={`/auth/login?redirect=${pathname}`} className="text-primary hover:underline">log in</Link> with the superior admin account.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4 mt-4">
            <Button asChild variant="outline" className="w-full">
              <Link href="/superior-admin">
                <span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Superior Admin</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link href="/">
                <span><Home className="mr-2 h-4 w-4" /> Go to Main Dashboard</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background to-muted/50">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 sm:h-20 items-center justify-between px-3 sm:px-4 lg:px-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <ShieldAlert className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
              System Settings
            </h1>
          </div>
          <Button asChild variant="outline" size="sm" className="flex-shrink-0">
            <Link href="/superior-admin">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl">Configure System Settings</CardTitle>
            <CardDescription className="text-sm">
              Modify application-wide operational parameters here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 sm:space-y-8 px-4 sm:px-6">
            {/* Conference Day Setting */}
            <div className="space-y-3 p-3 sm:p-4 border rounded-lg shadow-sm bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                <Label htmlFor="conferenceDaySelect" className="text-base sm:text-lg font-semibold flex items-center">
                    <Calendar className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" /> Current Conference Day
                </Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Select which day of the conference is currently active. This affects attendance tracking for all participants.
                </p>
                {isLoadingSettings ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <Select
                        value={currentConferenceDay}
                        onValueChange={handleConferenceDayChange}
                        disabled={isSwitchingDay}
                    >
                        <SelectTrigger id="conferenceDaySelect" className="w-full">
                        <SelectValue placeholder="Select conference day" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day1">Day 1</SelectItem>
                            <SelectItem value="day2">Day 2</SelectItem>
                        </SelectContent>
                    </Select>
                )}
                {isSwitchingDay && <p className="text-xs sm:text-sm text-orange-500 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Switching day and resetting statuses...</p>}
            </div>

            {/* Default Participant Attendance Status Setting */}
            <div className="space-y-3 p-3 sm:p-4 border rounded-lg shadow-sm">
                <Label htmlFor="defaultParticipantStatusSelect" className="text-base sm:text-lg font-semibold flex items-center">
                    <Workflow className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" /> Default Participant Attendance Status
                </Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Status assigned to new participants (manual or CSV import).
                </p>
                {isLoadingSettings ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <Select
                        value={currentDefaultParticipantStatus || 'Absent'}
                        onValueChange={(value) => handleSettingUpdate('defaultAttendanceStatus', value as AttendanceStatus)}
                        disabled={isUpdatingSetting}
                    >
                        <SelectTrigger id="defaultParticipantStatusSelect" className="w-full">
                        <SelectValue placeholder="Select default participant status" />
                        </SelectTrigger>
                        <SelectContent>
                        {ALL_ATTENDANCE_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                            {status}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                )}
                {isUpdatingSetting && currentDefaultParticipantStatus !== null && <p className="text-xs sm:text-sm text-primary flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</p>}
            </div>

            {/* Default Staff Attendance Status Setting */}
            <div className="space-y-3 p-3 sm:p-4 border rounded-lg shadow-sm">
                <Label htmlFor="defaultStaffStatusSelect" className="text-base sm:text-lg font-semibold flex items-center">
                    <Workflow className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" /> Default Staff Status
                </Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Status assigned to new staff members (manual or CSV import).
                </p>
                {isLoadingSettings ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <Select
                        value={currentDefaultStaffStatus || 'Off Duty'}
                        onValueChange={(value) => handleSettingUpdate('defaultStaffStatus', value as StaffAttendanceStatus)}
                        disabled={isUpdatingSetting}
                    >
                        <SelectTrigger id="defaultStaffStatusSelect" className="w-full">
                        <SelectValue placeholder="Select default staff status" />
                        </SelectTrigger>
                        <SelectContent>
                        {ALL_STAFF_ATTENDANCE_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                            {status}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                )}
                {isUpdatingSetting && currentDefaultStaffStatus !== null && <p className="text-xs sm:text-sm text-blue-500 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</p>}
            </div>

            
            <div className="mt-8 p-4 border border-dashed rounded-lg text-center">
                <Settings size={48} className="mx-auto text-muted-foreground opacity-30 mb-2" />
                <p className="text-muted-foreground">More system settings will be available here in the future.</p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Conference Day Switch Confirmation Dialog */}
      <AlertDialog open={pendingDaySwitch !== null} onOpenChange={(open) => !open && setPendingDaySwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Conference Day?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  You are about to switch to <strong>{pendingDaySwitch === 'day1' ? 'Day 1' : 'Day 2'}</strong>.
                </p>
                <p className="text-orange-600 dark:text-orange-400 font-semibold">
                  ⚠️ This will:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Archive current participant statuses</li>
                  <li>Reset ALL participant statuses to the default status</li>
                  <li>Mark the new day as active</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  This action cannot be undone. Are you sure you want to proceed?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSwitchingDay}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDaySwitch} 
              disabled={isSwitchingDay}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSwitchingDay ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Switching...</>
              ) : (
                'Yes, Switch Day'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
