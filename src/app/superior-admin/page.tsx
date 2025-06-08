
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
import { ShieldAlert, LogOut, Settings, Users, DatabaseZap, TriangleAlert, Home, BookOpenText, Landmark, PlusCircle, ExternalLink, Settings2, UserPlus, ScrollText, Loader2, Trash2, Edit, Users2 as StaffIcon, Network } from 'lucide-react';
import { auth, db } from '@/lib/firebase'; // db from client SDK
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, Timestamp, where, deleteDoc } from 'firebase/firestore'; // direct firestore calls
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { OWNER_UID } from '@/lib/constants';
import { 
  getSystemSchools, 
  getSystemCommittees, 
  deleteStaffMember as deleteStaffMemberAction, 
  getSystemStaffTeams,
  deleteSystemSchool as deleteSystemSchoolAction,
  deleteSystemCommittee as deleteSystemCommitteeAction,
  deleteSystemStaffTeam as deleteSystemStaffTeamAction
} from '@/lib/actions'; // Server Actions
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
const SYSTEM_STAFF_TEAMS_COLLECTION = 'system_staff_teams';
const STAFF_MEMBERS_COLLECTION = 'staff_members';


export default function SuperiorAdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [systemSchools, setSystemSchools] = useState<string[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'school' | 'committee' | 'staffTeam' | 'staffMember'; name: string; id?: string } | null>(null);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);


  const [systemCommittees, setSystemCommittees] = useState<string[]>([]);
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(false);

  const [systemStaffTeams, setSystemStaffTeams] = useState<string[]>([]);
  const [newStaffTeamName, setNewStaffTeamName] = useState('');
  const [isLoadingStaffTeams, setIsLoadingStaffTeams] = useState(false);

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  

  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);
    try {
      const schoolsData = await getSystemSchools(); 
      setSystemSchools(schoolsData);
    } catch (error) {
      console.error("Error fetching system schools (client-side, via action): ", error);
      toast({ title: 'Error Fetching Schools', description: (error as Error).message || 'Failed to load the list of schools.', variant: 'destructive' });
    } finally {
      setIsLoadingSchools(false);
    }
  }, [toast]);

  const fetchCommittees = useCallback(async () => {
    setIsLoadingCommittees(true);
    try {
      const committeesData = await getSystemCommittees();
      setSystemCommittees(committeesData);
    } catch (error) {
      console.error("Error fetching system committees (client-side, via action): ", error);
      toast({ title: 'Error Fetching Committees', description: (error as Error).message || 'Failed to load the list of committees.', variant: 'destructive' });
    } finally {
      setIsLoadingCommittees(false);
    }
  }, [toast]);

  const fetchStaffTeams = useCallback(async () => {
    setIsLoadingStaffTeams(true);
    try {
      const teamsData = await getSystemStaffTeams();
      setSystemStaffTeams(teamsData);
    } catch (error) {
      console.error("Error fetching system staff teams (client-side, via action): ", error);
      toast({ title: 'Error Fetching Staff Teams', description: (error as Error).message || 'Failed to load the list of staff teams.', variant: 'destructive' });
    } finally {
      setIsLoadingStaffTeams(false);
    }
  }, [toast]);

  const fetchStaff = useCallback(async () => {
    if (!currentUser || currentUser.uid !== OWNER_UID) return;
    setIsLoadingStaff(true);
    try {
      const staffColRef = collection(db, STAFF_MEMBERS_COLLECTION);
      const q = query(staffColRef, orderBy('name'));
      const staffQuerySnapshot = await getDocs(q);
      const fetchedStaffData = staffQuerySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          role: data.role || '',
          department: data.department,
          team: data.team,
          contactInfo: data.contactInfo,
          status: data.status || 'Off Duty',
          imageUrl: data.imageUrl,
          notes: data.notes,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as StaffMember;
      });
      setStaffMembers(fetchedStaffData);
    } catch (error: any) {
      console.error("Error fetching staff members (client-side, Superior Admin): ", error);
      let errorMessage = "Failed to load staff members.";
       if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Ensure Firestore rules for 'staff_members' allow Owner read access.";
      }
      toast({ title: 'Error Fetching Staff', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoadingStaff(false);
    }
  }, [toast, currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        fetchSchools();
        fetchCommittees();
        fetchStaffTeams();
        fetchStaff();
      }
    });
    return () => unsubscribe();
  }, [fetchSchools, fetchCommittees, fetchStaffTeams, fetchStaff]);

  const handleAddItem = async (type: 'school' | 'committee' | 'staffTeam') => {
    if (!currentUser || currentUser.uid !== OWNER_UID) {
      toast({ title: 'Unauthorized', description: 'Only the owner can perform this action.', variant: 'destructive' });
      return;
    }

    let itemName = '';
    let collectionName = '';
    let fetchFunction: () => void = () => {};
    let setNewItemName: (name: string) => void = () => {};

    if (type === 'school') {
      itemName = newSchoolName.trim();
      collectionName = SYSTEM_SCHOOLS_COLLECTION;
      fetchFunction = fetchSchools;
      setNewItemName = setNewSchoolName;
    } else if (type === 'committee') {
      itemName = newCommitteeName.trim();
      collectionName = SYSTEM_COMMITTEES_COLLECTION;
      fetchFunction = fetchCommittees;
      setNewItemName = setNewCommitteeName;
    } else if (type === 'staffTeam') {
      itemName = newStaffTeamName.trim();
      collectionName = SYSTEM_STAFF_TEAMS_COLLECTION;
      fetchFunction = fetchStaffTeams;
      setNewItemName = setNewStaffTeamName;
    }

    if (!itemName) {
      toast({ title: 'Validation Error', description: `${type.charAt(0).toUpperCase() + type.slice(1)} name cannot be empty.`, variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const colRef = collection(db, collectionName);
        await addDoc(colRef, { name: itemName, createdAt: serverTimestamp() });
        toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Added`, description: `"${itemName}" has been successfully added.` });
        setNewItemName('');
        fetchFunction(); 
      } catch (error: any) {
        console.error(`Error adding system ${type} "${itemName}" (Client-side direct addDoc): `, error);
        const firebaseError = error as { code?: string; message?: string };
        toast({ 
          title: `Error Adding ${type}`, 
          description: `Failed: ${firebaseError.code === 'permission-denied' ? `PERMISSION_DENIED. Firestore rules (isOwner) are blocking this. Ensure OWNER_UID (${OWNER_UID}) in rules matches the logged-in user and constants.ts.` : (firebaseError.message || 'Unknown error')}.`, 
          variant: 'destructive', 
          duration: 10000 
        });
      }
    });
  };
  
  const confirmDeleteItem = (type: 'school' | 'committee' | 'staffTeam' | 'staffMember', name: string, id?: string) => {
    setItemToDelete({ type, name, id });
    setIsDeleteDialogVisible(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || !currentUser || currentUser.uid !== OWNER_UID) {
      toast({ title: 'Unauthorized or Item not specified', variant: 'destructive' });
      setIsDeleteDialogVisible(false);
      setItemToDelete(null);
      return;
    }
    const { type, name, id } = itemToDelete;

    startTransition(async () => {
      let result: { success: boolean; error?: string } | { success: boolean } = { success: false, error: "Unknown error during delete item action." };
      try {
        if (type === 'school') result = await deleteSystemSchoolAction(name);
        else if (type === 'committee') result = await deleteSystemCommitteeAction(name);
        else if (type === 'staffTeam') result = await deleteSystemStaffTeamAction(name);
        else if (type === 'staffMember' && id) result = await deleteStaffMemberAction(id);
        
        if ('error' in result && result.error) {
          toast({ title: `Error Deleting ${type}`, description: result.error, variant: 'destructive', duration: 7000 });
        } else if (result.success) {
          toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Deleted`, description: `"${name}" has been removed.` });
          if (type === 'school') fetchSchools();
          else if (type === 'committee') fetchCommittees();
          else if (type === 'staffTeam') fetchStaffTeams();
          else if (type === 'staffMember') fetchStaff();
        } else {
           toast({ title: `Error Deleting ${type}`, description: "An unexpected error occurred or action was not successful.", variant: 'destructive', duration: 7000 });
        }
      } catch (error: any) {
        toast({ title: `Error Deleting ${type}`, description: (error as Error).message || `Could not delete ${type}.`, variant: 'destructive', duration: 7000 });
      } finally {
        setIsDeleteDialogVisible(false);
        setItemToDelete(null);
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
    if (!currentUser || currentUser.uid !== OWNER_UID) {
      toast({ title: 'Unauthorized', description: 'Only the owner can add staff.', variant: 'destructive' });
      return;
    }
    setIsStaffFormOpen(true);
  };

  const handleStaffFormSuccess = () => {
    fetchStaff();
    setIsStaffFormOpen(false);
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

  const renderSystemListManagementCard = (
    title: string,
    icon: React.ElementType,
    iconColorClass: string,
    newItemName: string,
    setNewItemName: (name: string) => void,
    isLoadingItems: boolean,
    items: string[],
    addItemType: 'school' | 'committee' | 'staffTeam',
    itemTypeName: string
  ) => (
    <Card className={`shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 ${iconColorClass.replace('text-', 'border-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        {React.createElement(icon, { className: `h-7 w-7 ${iconColorClass}` })}
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={`New ${itemTypeName.toLowerCase()} name`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              disabled={isPending}
              className="flex-grow"
            />
            <Button 
              onClick={() => handleAddItem(addItemType)} 
              disabled={isPending || !newItemName.trim()} 
              className={`bg-${iconColorClass.split('-')[1]}-500 hover:bg-${iconColorClass.split('-')[1]}-600 ${iconColorClass.includes('orange') ? 'text-white' : (iconColorClass.includes('accent') ? 'text-accent-foreground' : 'text-primary-foreground')}`}
            >
              {isPending && (addItemType === 'school' && newSchoolName.trim() || addItemType === 'committee' && newCommitteeName.trim() || addItemType === 'staffTeam' && newStaffTeamName.trim()) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add
            </Button>
          </div>
          <Separator />
          <h4 className="text-md font-medium text-muted-foreground">Existing {itemTypeName}s:</h4>
          {isLoadingItems ? (
            <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : items.length > 0 ? (
            <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-1">
              <Table>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item}>
                      <TableCell className="text-sm font-medium py-2 px-3">{item}</TableCell>
                      <TableCell className="text-right py-2 px-3">
                        <Button variant="ghost" size="icon" onClick={() => confirmDeleteItem(addItemType, item)} className="text-destructive hover:text-destructive/80 h-8 w-8" title={`Delete ${itemTypeName} ${item}`}>
                          {isPending && itemToDelete?.name === item && itemToDelete?.type === addItemType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground italic py-4 text-center">No {itemTypeName.toLowerCase()}s registered.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
                {currentUser && ( 
                    <p className="text-xs text-green-600 dark:text-green-400">
                        Authenticated as: {currentUser.email} (UID: {currentUser.uid})
                    </p>
                )}
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
          {renderSystemListManagementCard("Manage Schools", Landmark, "text-primary", newSchoolName, setNewSchoolName, isLoadingSchools, systemSchools, "school", "School")}
          {renderSystemListManagementCard("Manage Committees", BookOpenText, "text-accent", newCommitteeName, setNewCommitteeName, isLoadingCommittees, systemCommittees, "committee", "Committee")}
          {renderSystemListManagementCard("Manage Staff Teams", Network, "text-orange-500", newStaffTeamName, setNewStaffTeamName, isLoadingStaffTeams, systemStaffTeams, "staffTeam", "Staff Team")}

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-green-500 md:col-span-3 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <CardTitle className="text-xl font-semibold">Manage Staff Members</CardTitle>
              <StaffIcon className="h-7 w-7 text-green-500" />
            </CardHeader>
            <CardContent className="pt-2">
              <Button onClick={handleOpenAddStaffForm} className="w-full sm:w-auto mb-4 bg-green-500 hover:bg-green-600 text-white" disabled={isPending}>
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
                            <Button variant="ghost" size="icon" onClick={() => confirmDeleteItem('staffMember', staff.name, staff.id)} className="text-destructive hover:text-destructive/80 h-8 w-8" title={`Delete ${staff.name}`} disabled={isPending}>
                              {isPending && itemToDelete?.id === staff.id && itemToDelete?.type === 'staffMember' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
           {currentUser && (
            <p className="text-xs text-muted-foreground mt-1">
                Owner UID: {OWNER_UID} (Current User UID: {currentUser.uid})
            </p>
           )}
        </div>
      </footer>

      <StaffMemberForm
        isOpen={isStaffFormOpen}
        onOpenChange={setIsStaffFormOpen}
        staffMemberToEdit={null}
        onFormSubmitSuccess={handleStaffFormSuccess}
        staffTeams={systemStaffTeams.filter(t => t !== 'All Teams')}
      />

      <AlertDialog open={isDeleteDialogVisible} onOpenChange={setIsDeleteDialogVisible}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? 
              This action cannot be undone. Deleting system items like schools, committees, or teams might affect participant or staff records assigned to them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)} disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? 'Deleting...' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    