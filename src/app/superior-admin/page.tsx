
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
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
import { ShieldAlert, LogOut, Settings, Users, DatabaseZap, TriangleAlert, Home, BookMarked, Landmark, PlusCircle, Trash2, List } from 'lucide-react';
import { auth } from '@/lib/firebase'; 
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import Link from 'next/link';
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

  // State for managing schools
  const [systemSchools, setSystemSchools] = useState<string[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  // State for managing committees
  const [systemCommittees, setSystemCommittees] = useState<string[]>([]);
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(false);


  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);
    try {
      const schools = await getSystemSchools();
      setSystemSchools(schools);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch schools.', variant: 'destructive' });
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
      toast({ title: 'Error', description: 'Failed to fetch committees.', variant: 'destructive' });
    } finally {
      setIsLoadingCommittees(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
    if (!newSchoolName.trim()) {
      toast({ title: 'Validation Error', description: 'School name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await addSystemSchool(newSchoolName);
      if (result.success) {
        toast({ title: 'Success', description: `School "${newSchoolName}" added.` });
        setNewSchoolName('');
        fetchSchools(); // Re-fetch schools
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to add school.', variant: 'destructive' });
      }
    });
  };

  const handleAddCommittee = async () => {
    if (!newCommitteeName.trim()) {
      toast({ title: 'Validation Error', description: 'Committee name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await addSystemCommittee(newCommitteeName);
      if (result.success) {
        toast({ title: 'Success', description: `Committee "${newCommitteeName}" added.` });
        setNewCommitteeName('');
        fetchCommittees(); // Re-fetch committees
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to add committee.', variant: 'destructive' });
      }
    });
  };

  const handleSuperAdminLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldAlert size={32} />
              </div>
            <CardTitle className="text-2xl font-bold">Superior Admin Access</CardTitle>
            <CardDescription>Verifying your credentials...</CardDescription>
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
              You do not have permission to access this page.
              This area is restricted to the Superior Administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentUser && ( 
              <Button onClick={handleSuperAdminLogout} variant="destructive" size="lg" className="w-full">
                <LogOut className="mr-2 h-5 w-5" /> Logout ({currentUser.email || 'Wrong User'})
              </Button>
            )}
            {!currentUser && (
                 <p className="text-sm text-muted-foreground mt-4">
                    Please <Link href="/auth/login" className="text-primary hover:underline">log in</Link> with the superior admin account.
                 </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Link href="/" legacyBehavior passHref>
              <Button variant="outline" className="w-full">
                <Home className="mr-2 h-4 w-4" /> Go to Homepage
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              If you believe this is an error, please contact support or ensure you are logged in with the correct account.
            </p>
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
              Superior Admin Dashboard
            </h1>
          </div>
          <Button variant="outline" onClick={handleSuperAdminLogout} size="lg">
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 p-6 bg-card border rounded-xl shadow-lg">
          <h2 className="text-3xl font-semibold mb-2 text-foreground">Welcome, Superior Administrator!</h2>
          <p className="text-lg text-muted-foreground">
            You have master control over the MUN Attendance Tracker system.
          </p>
           <p className="text-xs text-green-600 dark:text-green-500 mt-1">
            Authenticated as: {currentUser.email || currentUser.uid}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Manage Schools Card */}
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Manage Schools</CardTitle>
              <Landmark className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
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
                  <Button onClick={handleAddSchool} disabled={isPending || !newSchoolName.trim()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Existing Schools:</h4>
                {isLoadingSchools ? (
                  <Skeleton className="h-20 w-full" />
                ) : systemSchools.length > 0 ? (
                  <ScrollArea className="h-48 w-full rounded-md border p-2">
                    <ul className="space-y-1">
                      {systemSchools.map((school) => (
                        <li key={school} className="text-sm p-1.5 hover:bg-muted rounded-sm">
                          {school}
                          {/* Future: Add delete/edit icons here */}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No schools added yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manage Committees Card */}
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Manage Committees</CardTitle>
              <BookMarked className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
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
                  <Button onClick={handleAddCommittee} disabled={isPending || !newCommitteeName.trim()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Existing Committees:</h4>
                {isLoadingCommittees ? (
                  <Skeleton className="h-20 w-full" />
                ) : systemCommittees.length > 0 ? (
                  <ScrollArea className="h-48 w-full rounded-md border p-2">
                    <ul className="space-y-1">
                      {systemCommittees.map((committee) => (
                        <li key={committee} className="text-sm p-1.5 hover:bg-muted rounded-sm">
                          {committee}
                           {/* Future: Add delete/edit icons here */}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No committees added yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Global Participant Data</CardTitle>
              <DatabaseZap className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View, edit, and manage all participant records.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary" disabled>Access Data Controls (Not Implemented)</Button>
            </CardFooter>
          </Card>

          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">System Settings</CardTitle>
              <Settings className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure application-wide settings and operational parameters.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary" disabled>Adjust System Settings (Not Implemented)</Button>
            </CardFooter>
          </Card>

          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Admin Account Management</CardTitle>
              <Users className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create, modify, and manage accounts for regular administrators.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary" disabled>Manage Admin Accounts (Not Implemented)</Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="mt-8 p-4 bg-green-600/10 border border-green-600/30 rounded-lg text-center">
          <p className="font-medium text-green-700 dark:text-green-500">
            Security Notice: Access to this panel is restricted by Firebase Authentication to the designated Owner UID. Ensure your account remains secure.
          </p>
        </div>
      </main>

      <footer className="py-8 border-t mt-12 bg-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            MUN Tracker - Superior Administration Panel &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
