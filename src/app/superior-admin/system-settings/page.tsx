
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
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
import { ShieldAlert, ArrowLeft, Settings, TriangleAlert, Home, LogOut, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { OWNER_UID } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getDefaultAttendanceStatusSetting, updateDefaultAttendanceStatusSetting } from '@/lib/actions';
import type { AttendanceStatus } from '@/types';

const ALL_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "Present", "Absent", "Present On Account", "In Break", 
  "Restroom Break", "Technical Issue", "Stepped Out"
];

export default function SystemSettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { toast } = useToast();
  
  const [currentDefaultStatus, setCurrentDefaultStatus] = useState<AttendanceStatus | null>(null);
  const [isLoadingSetting, setIsLoadingSetting] = useState(true);
  const [isUpdatingSetting, startUpdateTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        fetchSetting();
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchSetting = async () => {
    setIsLoadingSetting(true);
    try {
      const status = await getDefaultAttendanceStatusSetting();
      setCurrentDefaultStatus(status);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load default attendance status.', variant: 'destructive' });
    } finally {
      setIsLoadingSetting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (newStatus: AttendanceStatus) => {
    startUpdateTransition(async () => {
      const result = await updateDefaultAttendanceStatusSetting(newStatus);
      if (result.success) {
        setCurrentDefaultStatus(newStatus);
        toast({ title: 'Setting Updated', description: `Default attendance status set to "${newStatus}".` });
      } else {
        toast({ title: 'Update Failed', description: result.error || 'Could not update setting.', variant: 'destructive' });
        // Re-fetch to show the actual current server value if update failed
        fetchSetting(); 
      }
    });
  };

  if (isLoadingAuth || (currentUser && currentUser.uid === OWNER_UID && isLoadingSetting)) {
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
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser || currentUser.uid !== OWNER_UID) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-red-500/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-destructive">
          <CardHeader>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert size={48} />
            </div>
            <CardTitle className="text-3xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">
              You do not have permission to access system settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentUser && (
              <Button onClick={handleLogout} variant="destructive" size="lg" className="w-full">
                <LogOut className="mr-2 h-5 w-5" /> Logout ({currentUser.email || 'Wrong User'})
              </Button>
            )}
            {!currentUser && (
              <p className="text-sm text-muted-foreground mt-4">
                Please <Link href="/auth/login" className="text-primary hover:underline">log in</Link> with the superior admin account.
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
              <Button variant="outline" className="w-full">
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
          <CardContent className="space-y-6">
            {isLoadingSetting ? (
                <div className="flex items-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading current setting...</span>
                </div>
            ) : (
                <div className="space-y-2">
                <Label htmlFor="defaultStatusSelect" className="text-base font-medium">Default Attendance Status for New Participants</Label>
                <p className="text-sm text-muted-foreground">
                    Choose the status that will be automatically assigned to participants when they are newly added manually or via CSV import.
                </p>
                <Select
                    value={currentDefaultStatus || 'Absent'} // Fallback if null
                    onValueChange={(value) => handleStatusChange(value as AttendanceStatus)}
                    disabled={isUpdatingSetting}
                >
                    <SelectTrigger id="defaultStatusSelect" className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select a default status" />
                    </SelectTrigger>
                    <SelectContent>
                    {ALL_ATTENDANCE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                        {status}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                {isUpdatingSetting && <p className="text-sm text-primary flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</p>}
                </div>
            )}
            
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

    