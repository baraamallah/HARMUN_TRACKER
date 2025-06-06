
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShieldAlert, LogOut, Settings, Users, DatabaseZap, TriangleAlert, Home, BookOpenText, Landmark, PlusCircle, ExternalLink, Settings2, UserPlus, ScrollText, Loader2, Trash2, Edit, Users2 as StaffIcon, Network } from 'lucide-react'; // Added Network for Staff Teams
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { OWNER_UID } from '@/lib/constants';
import { getSystemSchools, getSystemCommittees, getStaffMembers, deleteStaffMember as deleteStaffMemberAction, getSystemStaffTeams } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { StaffMember } from '@/types';
import { StaffMemberForm } from '@/components/staff/StaffMemberForm';
import { StaffMemberStatusBadge } from '@/components/staff/StaffMemberStatusBadge';
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

const SYSTEM_SCHOOLS_COLLECTION = 'system_schools';
const SYSTEM_COMMITTEES_COLLECTION = 'system_committees';
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams'; // New

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

  const [systemStaffTeams, setSystemStaffTeams] = useState<string[]>([]); // New state for staff teams
  const [newStaffTeamName, setNewStaffTeamName] = useState(''); // New state for adding staff team
  const [isLoadingStaffTeams, setIsLoadingStaffTeams] = useState(false); // New loading state

  // Staff Management State
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [isDeleteStaffDialogVisible, setIsDeleteStaffDialogVisible] = useState(false);


  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);
    try {
      const schoolsColRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
      const schoolsSnapshot = await getDocs(query(schoolsColRef, orderBy('name')));
      setSystemSchools(schoolsSnapshot.docs.map(doc => doc.data().name as string));
    } catch (error) {
      console.error("Error fetching system schools (client-side): ", error);
      toast({ title: 'Error Fetching Schools', description: 'Failed to load the list of schools.', variant: 'destructive' });
    } finally {
      setIsLoadingSchools(false);
    }
  }, [toast]);

  const fetchCommittees = useCallback(async () => {
    setIsLoadingCommittees(true);
    try {
      const committeesColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
      const committeesSnapshot = await getDocs(query(committeesColRef, orderBy('name')));
      setSystemCommittees(committeesSnapshot.docs.map(doc => doc.data().name as string));
    } catch (error) {
      console.error("Error fetching system committees (client-side): ", error);
      toast({ title: 'Error Fetching Committees', description: 'Failed to load the list of committees.', variant: 'destructive' });
    } finally {
      setIsLoadingCommittees(false);
    }
  }, [toast]);

  const fetchStaffTeams = useCallback(async () => { // New function to fetch staff teams
    setIsLoadingStaffTeams(true);
    try {
      const teamsColRef = collection(db, SYSTEM_STAFF_TEAMS_COLLECTION);
      const teamsSnapshot = await getDocs(query(teamsColRef, orderBy('name')));
      setSystemStaffTeams(teamsSnapshot.docs.map(doc => doc.data().name as string));
    } catch (error) {
      console.error("Error fetching system staff teams (client-side): ", error);
      toast({ title: 'Error Fetching Staff Teams', description: 'Failed to load the list of staff teams.', variant: 'destructive' });
    } finally {
      setIsLoadingStaffTeams(false);
    }
  }, [toast]);

  const fetchStaff = useCallback(async () => {
    setIsLoadingStaff(true);
    try {
      const staffData = await getStaffMembers();
      setStaffMembers(staffData);
    } catch (error) {
      console.error("Error fetching staff members: ", error);
      toast({ title: 'Error Fetching Staff', description: (error as Error).message || 'Failed to load staff members.', variant: 'destructive' });
    } finally {
      setIsLoadingStaff(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        fetchSchools();
        fetchCommittees();
        fetchStaffTeams(); // Fetch staff teams
        fetchStaff();
      }
    });
    return () => unsubscribe();
  }, [fetchSchools, fetchCommittees, fetchStaffTeams, fetchStaff]);

  const handleAddSchoolClientSide = async () => {
    if (!currentUser || currentUser.uid !== OWNER_UID) {
      toast({ title: 'Unauthorized', description: 'Only the owner can perform this action.', variant: 'destructive' });
      return;
    }
    const trimmedSchoolName = newSchoolName.trim();
    if (!trimmedSchoolName) {
      toast({ title: 'Validation Error', description: 'School name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      try {
        const schoolColRef = collection(db, SYSTEM_SCHOOLS_COLLECTION);
        await addDoc(schoolColRef, { name: trimmedSchoolName, createdAt: serverTimestamp() });
        toast({ title: 'School Added', description: `School "${trimmedSchoolName}" has been successfully added.` });
        setNewSchoolName('');
        fetchSchools();
      } catch (error: any) {
        console.error(`Error adding system school "${trimmedSchoolName}" (client-side): `, error);
        toast({ title: 'Error Adding School', description: `Failed: ${error.message || 'Unknown error'}. Make sure Firestore rules allow this.`, variant: 'destructive', duration: 10000 });
      }
    });
  };

  const handleAddCommitteeClientSide = async () => {
    if (!currentUser || currentUser.uid !== OWNER_UID) {
      toast({ title: 'Unauthorized', description: 'Only the owner can perform this action.', variant: 'destructive' });
      return;
    }
    const trimmedCommitteeName = newCommitteeName.trim();
    if (!trimmedCommitteeName) {
      toast({ title: 'Validation Error', description: 'Committee name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      try {
        const committeeColRef = collection(db, SYSTEM_COMMITTEES_COLLECTION);
        await addDoc(committeeColRef, { name: trimmedCommitteeName, createdAt: serverTimestamp() });
        toast({ title: 'Committee Added', description: `Committee "${trimmedCommitteeName}" has been successfully added.` });
        setNewCommitteeName('');
        fetchCommittees();
      } catch (error: any) {
        console.error(`Error adding system committee "${trimmedCommitteeName}" (client-side): `, error);
        toast({ title: 'Error Adding Committee', description: `Failed: ${error.message || 'Unknown error'}. Make sure Firestore rules allow this.`, variant: 'destructive', duration: 10000 });
      }
    });
  };

  const handleAddStaffTeamClientSide = async () => { // New function to add staff team
    if (!currentUser || currentUser.uid !== OWNER_UID) {
      toast({ title: 'Unauthorized', description: 'Only the owner can perform this action.', variant: 'destructive' });
      return;
    }
    const trimmedStaffTeamName = newStaffTeamName.trim();
    if (!trimmedStaffTeamName) {
      toast({ title: 'Validation Error', description: 'Staff team name cannot be empty.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      try {
        const teamColRef = collection(db, SYSTEM_STAFF_TEAMS_COLLECTION);
        await addDoc(teamColRef, { name: trimmedStaffTeamName, createdAt: serverTimestamp() });
        toast({ title: 'Staff Team Added', description: `Staff Team "${trimmedStaffTeamName}" has been successfully added.` });
        setNewStaffTeamName('');
        fetchStaffTeams();
      } catch (error: any) {
        console.error(`Error adding system staff team "${trimmedStaffTeamName}" (client-side): `, error);
        toast({ title: 'Error Adding Staff Team', description: `Failed: ${error.message || 'Unknown error'}. Make sure Firestore rules allow this.`, variant: 'destructive', duration: 10000 });
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

  const handleOpenAddStaffForm = () => {
    setIsStaffFormOpen(true);
  };

  const handleStaffFormSuccess = () => {
    fetchStaff();
    setIsStaffFormOpen(false);
  };

  const confirmDeleteStaff = (staff: StaffMember) => {
    setStaffToDelete(staff);
    setIsDeleteStaffDialogVisible(true);
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    startTransition(async () => {
      try {
        await deleteStaffMemberAction(staffToDelete.id);
        toast({ title: 'Staff Member Deleted', description: `${staffToDelete.name} has been removed.` });
        fetchStaff();
      } catch (error) {
        toast({ title: 'Error Deleting Staff', description: (error as Error).message || 'Could not delete staff member.', variant: 'destructive' });
      } finally {
        setIsDeleteStaffDialogVisible(false);
        setStaffToDelete(null);
      }
    });
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
                    Please <Link href="/auth/login" className="font-semibold text-primary hover:underline">log in</Link> with the designated Superior Admin account.
                 </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4 p-6 pt-2">
            <Link href="/" legacyBehavior passHref>
              <Button variant="outline" className="w-full text-md py-3">
                <Home className="mr-2 h-5 w-5" /> Go to Main Dashboard
              </Button>
            </Link>
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
                  <Button onClick={handleAddSchoolClientSide} disabled={isPending || !newSchoolName.trim()} className="bg-primary hover:bg-primary/90">
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
                  <p className="text-sm text-muted-foreground italic py-4 text-center">No schools registered.</p>
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
                  <Button onClick={handleAddCommitteeClientSide} disabled={isPending || !newCommitteeName.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
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
                  <p className="text-sm text-muted-foreground italic py-4 text-center">No committees registered.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manage Staff Teams Card - NEW */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Manage Staff Teams</CardTitle>
              <Network className="h-7 w-7 text-orange-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="New staff team name"
                    value={newStaffTeamName}
                    onChange={(e) => setNewStaffTeamName(e.target.value)}
                    disabled={isPending}
                    className="flex-grow"
                  />
                  <Button onClick={handleAddStaffTeamClientSide} disabled={isPending || !newStaffTeamName.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <Separator />
                <h4 className="text-md font-medium text-muted-foreground">Existing Staff Teams:</h4>
                {isLoadingStaffTeams ? (
                  <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : systemStaffTeams.length > 0 ? (
                  <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3">
                    <ul className="space-y-1.5">
                      {systemStaffTeams.map((team) => (
                        <li key={team} className="text-sm p-2 bg-background rounded-md shadow-sm hover:bg-orange-500/10">
                          {team}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">No staff teams registered.</p>
                )}
              </div>
            </CardContent>
          </Card>


          {/* Manage Staff Members Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-green-500 md:col-span-3 lg:col-span-3"> {/* Spanning full width on larger screens for better table layout */}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Manage Staff Members</CardTitle>
              <StaffIcon className="h-7 w-7 text-green-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <Button onClick={handleOpenAddStaffForm} className="w-full sm:w-auto mb-4 bg-green-500 hover:bg-green-600 text-white">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Staff Member
              </Button>
              <Separator />
              <h4 className="text-md font-medium text-muted-foreground mt-4 mb-2">Existing Staff:</h4>
              {isLoadingStaff ? (
                <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : staffMembers.length > 0 ? (
                <ScrollArea className="h-80 w-full rounded-md border bg-muted/30 mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Avatar</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden sm:table-cell">Department</TableHead>
                        <TableHead className="hidden md:table-cell">Team</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffMembers.map((staff) => (
                        <TableRow key={staff.id}>
                           <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={staff.imageUrl} alt={staff.name} data-ai-hint="person avatar" />
                              <AvatarFallback>{staff.name.substring(0,1)}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{staff.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{staff.role}</TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{staff.department || 'N/A'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{staff.team || 'N/A'}</TableCell>
                          <TableCell><StaffMemberStatusBadge status={staff.status} /></TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" asChild className="text-blue-500 hover:text-blue-600 h-8 w-8">
                              <Link href={`/staff/${staff.id}`} title={`Edit ${staff.name}`}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => confirmDeleteStaff(staff)} className="text-destructive hover:text-destructive/80 h-8 w-8" title={`Delete ${staff.name}`}>
                              {isPending && staffToDelete?.id === staff.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground italic py-4 text-center mt-2">No staff members registered.</p>
              )}
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

      <StaffMemberForm
        isOpen={isStaffFormOpen}
        onOpenChange={setIsStaffFormOpen}
        staffMemberToEdit={null}
        onFormSubmitSuccess={handleStaffFormSuccess}
        staffTeams={systemStaffTeams} // Pass staff teams to the form
      />

      <AlertDialog open={isDeleteStaffDialogVisible} onOpenChange={setIsDeleteStaffDialogVisible}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {staffToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaffToDelete(null)} disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStaff}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
