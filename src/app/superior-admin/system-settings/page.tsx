
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldAlert, ArrowLeft, Settings, TriangleAlert, Home, LogOut, Loader2, Image as ImageIcon, Workflow } from 'lucide-react';
import { auth, db } from '@/lib/firebase'; 
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  getDefaultAttendanceStatusSetting, 
  getDefaultStaffStatusSetting,
  getSystemLogoUrlSetting,
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
  const [currentEventLogoUrl, setCurrentEventLogoUrl] = useState<string | null>(null);
  
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isUpdatingSetting, startUpdateTransition] = useTransition();

  const fetchAllSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const [participantStatus, staffStatus, logoUrl] = await Promise.all([
        getDefaultAttendanceStatusSetting(),
        getDefaultStaffStatusSetting(),
        getSystemLogoUrlSetting(),
      ]);
      setCurrentDefaultParticipantStatus(participantStatus);
      setCurrentDefaultStaffStatus(staffStatus);
      setCurrentEventLogoUrl(logoUrl);
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

  const handleSettingUpdate = async (settingKey: string, newValue: string | AttendanceStatus | StaffAttendanceStatus) => {
    startUpdateTransition(async () => {
      try {
        const configDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
        await setDoc(configDocRef, { [settingKey]: newValue, updatedAt: serverTimestamp() }, { merge: true });
        
        if (settingKey === 'defaultAttendanceStatus') setCurrentDefaultParticipantStatus(newValue as AttendanceStatus);
        if (settingKey === 'defaultStaffStatus') setCurrentDefaultStaffStatus(newValue as StaffAttendanceStatus);
        if (settingKey === 'eventLogoUrl') setCurrentEventLogoUrl(newValue as string);

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
            <Link href="/superior-admin" legacyBehavior passHref>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Superior Admin
              </Button>
            </Link>
            <Link href="/" legacyBehavior passHref>
              <Button variant="outline" className="w-full mt-2">
                <Home className="mr-2 h-4 w-4" /> Go to Main Dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background to-muted/50">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              System Settings
            </h1>
          </div>
          <Link href="/superior-admin" passHref legacyBehavior>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Superior Admin
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Configure System Settings</CardTitle>
            <CardDescription>
              Modify application-wide operational parameters here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Default Participant Attendance Status Setting */}
            <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                <Label htmlFor="defaultParticipantStatusSelect" className="text-lg font-semibold flex items-center">
                    <Workflow className="mr-2 h-5 w-5 text-primary" /> Default Participant Attendance Status
                </Label>
                <p className="text-sm text-muted-foreground">
                    Status assigned to new participants (manual or CSV import).
                </p>
                {isLoadingSettings ? (
                    <Skeleton className="h-10 w-full md:w-[300px]" />
                ) : (
                    <Select
                        value={currentDefaultParticipantStatus || 'Absent'}
                        onValueChange={(value) => handleSettingUpdate('defaultAttendanceStatus', value as AttendanceStatus)}
                        disabled={isUpdatingSetting}
                    >
                        <SelectTrigger id="defaultParticipantStatusSelect" className="w-full md:w-[300px]">
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
                {isUpdatingSetting && currentDefaultParticipantStatus !== null && <p className="text-sm text-primary flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</p>}
            </div>

            {/* Default Staff Attendance Status Setting */}
            <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                <Label htmlFor="defaultStaffStatusSelect" className="text-lg font-semibold flex items-center">
                    <Workflow className="mr-2 h-5 w-5 text-blue-500" /> Default Staff Status
                </Label>
                <p className="text-sm text-muted-foreground">
                    Status assigned to new staff members (manual or CSV import).
                </p>
                {isLoadingSettings ? (
                    <Skeleton className="h-10 w-full md:w-[300px]" />
                ) : (
                    <Select
                        value={currentDefaultStaffStatus || 'Off Duty'}
                        onValueChange={(value) => handleSettingUpdate('defaultStaffStatus', value as StaffAttendanceStatus)}
                        disabled={isUpdatingSetting}
                    >
                        <SelectTrigger id="defaultStaffStatusSelect" className="w-full md:w-[300px]">
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
                {isUpdatingSetting && currentDefaultStaffStatus !== null && <p className="text-sm text-blue-500 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</p>}
            </div>

            {/* Event Logo URL Setting */}
            <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                <Label htmlFor="eventLogoUrlInput" className="text-lg font-semibold flex items-center">
                    <ImageIcon className="mr-2 h-5 w-5 text-green-500" /> Event Logo URL
                </Label>
                <p className="text-sm text-muted-foreground">
                    URL for the event logo. Used for QR codes and public page branding. Leave blank for default.
                </p>
                {isLoadingSettings ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <div className="flex items-center gap-2">
                        <Input 
                            id="eventLogoUrlInput"
                            placeholder="https://example.com/your-logo.png"
                            defaultValue={currentEventLogoUrl || ''}
                            onBlur={(e) => handleSettingUpdate('eventLogoUrl', e.target.value)}
                            disabled={isUpdatingSetting}
                            className="flex-grow"
                        />
                        <Button onClick={() => handleSettingUpdate('eventLogoUrl', (document.getElementById('eventLogoUrlInput') as HTMLInputElement)?.value || '')} disabled={isUpdatingSetting}>
                            {isUpdatingSetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Logo URL
                        </Button>
                    </div>
                )}
                {currentEventLogoUrl && (
                    <div className="mt-2">
                        <p className="text-xs text-muted-foreground">Current Logo Preview:</p>
                        <img src={currentEventLogoUrl} alt="Event Logo Preview" className="max-h-20 border rounded bg-muted p-1" onError={(e) => (e.currentTarget.style.display='none')} />
                    </div>
                )}
            </div>
            
            <div className="mt-8 p-4 border border-dashed rounded-lg text-center">
                <Settings size={48} className="mx-auto text-muted-foreground opacity-30 mb-2" />
                <p className="text-muted-foreground">More system settings will be available here in the future.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
