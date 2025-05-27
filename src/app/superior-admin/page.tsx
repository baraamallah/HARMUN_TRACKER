
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldAlert, LogOut, Settings, Users, DatabaseZap, TriangleAlert, Home, BookOpenText, Landmark, PlusCircle, ExternalLink, Settings2, UserPlus, ScrollText, Loader2 } from 'lucide-react'; // Updated icons
import { auth } from '@/lib/firebase'; 
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { OWNER_UID } from '@/lib/constants'; 
import { getSystemSchools, addSystemSchool, getSystemCommittees, addSystemCommittee } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function SuperiorAdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [systemSchools, setSystemSchools] = useState<string[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  const [systemCommittees, setSystemCommittees] = useState<string[]>([]);
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(false);


  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);
    try {
      const schools = await getSystemSchools();
      setSystemSchools(schools);
    } catch (error) {
      toast({ title: 'Error Fetching Schools', description: 'Failed to load the list of schools.', variant: 'destructive' });
    } finally {
      setIsLoadingSchools(false);
    }
  }, [toast]);

  const fetchCommittees = useCallback(async () => {
    setIsLoadingCommittees(true);
    try {
      const committees = await getSystemCommittees();
      setSystemCommittees(committees);
    } catch (error) {
      toast({ title: 'Error Fetching Committees', description: 'Failed to load the list of committees.', variant: 'destructive' });
    } finally {
      setIsLoadingCommittees(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log(
        "[Superior Admin Page Auth Check] Current User UID:", 
        user ? user.uid : 'Not Logged In', 
        "| Required Owner UID:", 
        OWNER_UID,
        "| Match:", user ? user.uid === OWNER_UID : false
      );
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        fetchSchools();
        fetchCommittees();
      }
    });
    return () => unsubscribe();
  }, [fetchSchools, fetchCommittees]);

  const handleAddSchool = async () => {
    console.log("[Superior Admin Action] Attempting to add school. Current auth.currentUser?.uid:", auth.currentUser?.uid, "Required Owner UID:", OWNER_UID);
    if (!newSchoolName.trim()) {
      toast({ title: 'Validation Error', description: 'School name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await addSystemSchool(newSchoolName);
      if (result.success) {
        toast({ title: 'School Added', description: `School "${newSchoolName}" has been successfully added to the system.` });
        setNewSchoolName('');
        fetchSchools(); 
      } else {
        toast({ 
          title: 'Error Adding School', 
          description: result.error || `Failed to add school. Ensure you are logged in as Owner (UID: ${OWNER_UID}) and that Firestore rules for 'system_schools' allow writes by the owner. Check browser console for more details.`, 
          variant: 'destructive',
          duration: 10000,
        });
      }
    });
  };

  const handleAddCommittee = async () => {
    console.log("[Superior Admin Action] Attempting to add committee. Current auth.currentUser?.uid:", auth.currentUser?.uid, "Required Owner UID:", OWNER_UID);
    if (!newCommitteeName.trim()) {
      toast({ title: 'Validation Error', description: 'Committee name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await addSystemCommittee(newCommitteeName);
      if (result.success) {
        toast({ title: 'Committee Added', description: `Committee "${newCommitteeName}" has been successfully added.` });
        setNewCommitteeName('');
        fetchCommittees(); 
      } else {
        toast({ 
          title: 'Error Adding Committee', 
          description: result.error || `Failed to add committee. Ensure you are logged in as Owner (UID: ${OWNER_UID}) and that Firestore rules for 'system_committees' allow writes by the owner. Check browser console for more details.`, 
          variant: 'destructive',
          duration: 10000, 
        });
      }
    });
  };

  const handleSuperAdminLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out from the Superior Admin panel.' });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-md shadow-2xl border-t-4 border-primary">
          <CardHeader className="text-center py-8">
             <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-10 w-10 animate-spin" />
              </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Superior Admin Access</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">Verifying credentials...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser || currentUser.uid !== OWNER_UID) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-destructive/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-t-4 border-destructive">
          <CardHeader className="py-8">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert size={60} />
            </div>
            <CardTitle className="text-4xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-xl mt-3 text-muted-foreground">
              This area is restricted to the Superior Administrator.
              Current User UID: {currentUser ? `'${currentUser.uid}'` : 'Not Logged In'}. Required Owner UID: '{OWNER_UID}'.
              {currentUser && currentUser.uid !== OWNER_UID && " (This is NOT the Owner Account)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {currentUser && ( 
              <Button onClick={handleSuperAdminLogout} variant="destructive" size="lg" className="w-full text-lg py-3">
                <LogOut className="mr-2 h-5 w-5" /> Logout ({currentUser.email || 'Restricted User'})
              </Button>
            )}
            {!currentUser && (
                 <p className="text-md text-muted-foreground mt-4">
                    Please <Link href="/auth/login" className="font-semibold text-primary hover:underline">log in</Link> with the designated Superior Admin account ({OWNER_UID}).
                 </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4 p-6 pt-2">
            <Link href="/" legacyBehavior passHref>
              <Button variant="outline" className="w-full text-md py-3">
                <Home className="mr-2 h-5 w-5" /> Go to Main Dashboard
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-4">
              If you believe this is an error, please verify your login credentials or contact system support. Ensure your Firestore Security Rules in your Firebase project are correctly published (see README.md).
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-10 w-10 text-primary" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Superior Admin Panel
                </h1>
                <p className="text-xs text-green-600 dark:text-green-400">
                    Authenticated as: {currentUser.email} (UID: {currentUser.uid})
                </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSuperAdminLogout} size="lg" className="text-md">
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-10 p-8 bg-card border border-primary/20 rounded-xl shadow-lg">
          <h2 className="text-4xl font-semibold mb-3 text-foreground">Welcome, System Owner!</h2>
          <p className="text-xl text-muted-foreground">
            You have master control over the MUN Attendance Tracker. Manage system lists, user access, and global settings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Manage Schools Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Manage Schools</CardTitle>
              <Landmark className="h-7 w-7 text-primary" />
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="New school name"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    disabled={isPending}
                    className="flex-grow"
                  />
                  <Button onClick={handleAddSchool} disabled={isPending || !newSchoolName.trim()} className="bg-primary hover:bg-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <Separator />
                <h4 className="text-md font-medium text-muted-foreground">Existing Schools:</h4>
                {isLoadingSchools ? (
                  <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : systemSchools.length > 0 ? (
                  <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3">
                    <ul className="space-y-1.5">
                      {systemSchools.map((school) => (
                        <li key={school} className="text-sm p-2 bg-background rounded-md shadow-sm hover:bg-accent/10">
                          {school}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">No schools registered in the system yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manage Committees Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Manage Committees</CardTitle>
              <BookOpenText className="h-7 w-7 text-accent" /> 
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="New committee name"
                    value={newCommitteeName}
                    onChange={(e) => setNewCommitteeName(e.target.value)}
                    disabled={isPending}
                    className="flex-grow"
                  />
                  <Button onClick={handleAddCommittee} disabled={isPending || !newCommitteeName.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <Separator />
                <h4 className="text-md font-medium text-muted-foreground">Existing Committees:</h4>
                {isLoadingCommittees ? (
                  <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : systemCommittees.length > 0 ? (
                  <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3">
                    <ul className="space-y-1.5">
                      {systemCommittees.map((committee) => (
                        <li key={committee} className="text-sm p-2 bg-background rounded-md shadow-sm hover:bg-primary/10">
                          {committee}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">No committees registered in the system yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Global Participant Data</CardTitle>
              <DatabaseZap className="h-7 w-7 text-blue-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm text-muted-foreground mb-4">
                View, edit, and manage all participant records directly from the main admin dashboard.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/" passHref legacyBehavior>
                <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                  <ExternalLink className="mr-2 h-4 w-4" /> Go to Participant Dashboard
                </Button>
              </Link>
            </CardFooter>
          </Card>
        
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">System Settings</CardTitle>
              <Settings2 className="h-7 w-7 text-purple-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm text-muted-foreground mb-4">
                Configure application-wide settings and operational parameters, like default attendance status.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/superior-admin/system-settings" passHref legacyBehavior>
                <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                   <Settings className="mr-2 h-4 w-4" /> Configure System Settings
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-teal-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Admin Account Management</CardTitle>
              <UserPlus className="h-7 w-7 text-teal-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm text-muted-foreground mb-4">
                Grant or revoke admin privileges for existing application users.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/superior-admin/admin-management" passHref legacyBehavior>
                <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white">
                    <Users className="mr-2 h-4 w-4" /> Manage Admin Accounts
                </Button>
              </Link>
            </CardFooter>
          </Card>
           <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-gray-500 md:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">View System Logs</CardTitle>
              <ScrollText className="h-7 w-7 text-gray-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm text-muted-foreground mb-4">
                (Placeholder) Access detailed system and audit logs for monitoring and troubleshooting.
              </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full" variant="secondary" disabled>
                    <ExternalLink className="mr-2 h-4 w-4" /> View Logs (Not Implemented)
                </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="mt-12 p-6 bg-green-600/10 border border-green-700/30 rounded-xl text-center">
          <p className="font-medium text-lg text-green-700 dark:text-green-400">
            <ShieldAlert className="inline-block mr-2 h-6 w-6 align-middle" />
            Security Notice: Access to this panel is restricted. Ensure your account credentials remain secure.
          </p>
        </div>
      </main>

      <footer className="py-10 border-t mt-16 bg-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-md text-muted-foreground">
            MUN Tracker - Superior Administration Panel &copy; {new Date().getFullYear()}
          </p>
           <p className="text-xs text-muted-foreground mt-1">
            Owner UID: {OWNER_UID}
          </p>
        </div>
      </footer>
    </div>
  );
}
    

    