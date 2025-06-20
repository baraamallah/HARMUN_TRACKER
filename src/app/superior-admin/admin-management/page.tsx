
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShieldAlert, ArrowLeft, Users, TriangleAlert, Home, LogOut, Trash2, Loader2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, deleteDoc, getDoc } from 'firebase/firestore'; // Ensured getDoc is here
import { OWNER_UID } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AddAdminDialog } from '@/components/superior-admin/AddAdminDialog';
import type { AdminManagedUser } from '@/types';
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
import { format, parseISO } from 'date-fns';

const USERS_COLLECTION = 'users';

export default function AdminManagementPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { toast } = useToast();
  
  const [adminUsers, setAdminUsers] = useState<AdminManagedUser[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isPendingAction, startTransitionAction] = useTransition();

  const [userToRevoke, setUserToRevoke] = useState<AdminManagedUser | null>(null);
  const [isRevokeDialogVisible, setIsRevokeDialogVisible] = useState(false);

  const fetchAdmins = useCallback(async () => {
    if (!currentUser || currentUser.uid !== OWNER_UID) return;
    setIsLoadingAdmins(true);
    try {
      const usersColRef = collection(db, USERS_COLLECTION);
      const q = query(usersColRef, where('role', '==', 'admin'), orderBy('email'));
      const querySnapshot = await getDocs(q);
      const admins = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, 
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          avatarUrl: data.avatarUrl,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as AdminManagedUser;
      });
      setAdminUsers(admins);
    } catch (error: any) {
      console.error("Error fetching admins (client-side):", error);
      let errorMessage = "Failed to load admin users. Please try again.";
      if (error.code === 'permission-denied') {
        errorMessage = `Permission denied fetching admins. Ensure the Owner (UID: ${OWNER_UID}) has 'list' permission on the '${USERS_COLLECTION}' collection in Firestore rules and that you are logged in as this owner.`;
      } else if (error.message?.includes('requires an index')) {
        errorMessage = "A Firestore index is required. Check browser console for a link to create it.";
      }
      toast({ title: 'Error Fetching Admins', description: errorMessage, variant: 'destructive', duration: 7000 });
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [toast, currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        fetchAdmins();
      }
    });
    return () => unsubscribe();
  }, [fetchAdmins]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const confirmRevokeAdmin = (admin: AdminManagedUser) => {
    setUserToRevoke(admin);
    setIsRevokeDialogVisible(true);
  };

  const handleRevokeAdmin = () => {
    if (!userToRevoke) return;
    startTransitionAction(async () => {
      try {
        const adminDocRef = doc(db, USERS_COLLECTION, userToRevoke.id);
        const adminDocSnap = await getDoc(adminDocRef);
        if (!adminDocSnap.exists()) {
          toast({ title: 'Error', description: `Admin with UID ${userToRevoke.id} not found. Role might have already been revoked.`, variant: 'destructive'});
        } else {
          await deleteDoc(adminDocRef);
          toast({ title: 'Admin Role Revoked', description: `Admin role revoked for ${userToRevoke.displayName || userToRevoke.email}.` });
          fetchAdmins(); 
        }
      } catch (error: any) {
        console.error(`Client-side Error revoking admin role for UID ${userToRevoke.id}:`, error);
        toast({ 
          title: 'Operation Failed', 
          description: error.message || 'Could not revoke admin role. Check permissions.', 
          variant: 'destructive' 
        });
      } finally {
        setIsRevokeDialogVisible(false);
        setUserToRevoke(null);
      }
    });
  };

  const formatDateString = (dateString: string | any): string => {
    if (!dateString) return 'N/A';
    try {
      if (typeof dateString === 'string') {
        return format(parseISO(dateString), 'PP'); 
      }
      if (typeof dateString === 'object' && dateString.toDate) {
        return format(dateString.toDate(), 'PP');
      }
    } catch (e) {
      console.warn("Could not parse date:", dateString, e);
      return 'Invalid Date';
    }
    return String(dateString); 
  };


  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users size={32} />
            </div>
            <CardTitle className="text-2xl font-bold">Admin Account Management</CardTitle>
            <CardDescription>Verifying your credentials...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
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
              You do not have permission to manage admin accounts.
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
              Admin Account Management
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
            <CardTitle className="text-2xl">Manage Administrator Accounts</CardTitle>
            <CardDescription>
              Grant or revoke admin privileges for existing Firebase Authentication users by providing their Auth UID.
              This action manages their role within this application; it does not create or delete their main Firebase Auth accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-end">
              <AddAdminDialog onAdminAdded={fetchAdmins} />
            </div>
            
            <Separator />

            <div>
              <h3 className="text-xl font-semibold mb-4">Existing Administrators</h3>
              {isLoadingAdmins ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-3 border rounded-md">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-60" />
                        </div>
                        <Skeleton className="h-8 w-20 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : adminUsers.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Avatar</TableHead>
                        <TableHead>Name/Email</TableHead>
                        <TableHead>Auth UID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Granted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={admin.avatarUrl || `https://placehold.co/40x40.png?text=${(admin.displayName || admin.email || 'A')?.[0].toUpperCase()}`} alt={admin.displayName || admin.email || 'Admin'} data-ai-hint="user avatar" />
                              <AvatarFallback>{(admin.displayName?.[0] || admin.email?.[0] || 'A').toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{admin.displayName || admin.email}</div>
                            {admin.displayName && <div className="text-xs text-muted-foreground">{admin.email}</div>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{admin.id}</TableCell>
                          <TableCell><Badge variant="secondary">{admin.role}</Badge></TableCell>
                           <TableCell className="text-sm text-muted-foreground">
                            {formatDateString(admin.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive/80" 
                              onClick={() => confirmRevokeAdmin(admin)}
                              disabled={isPendingAction}
                              title="Revoke Admin Role"
                            >
                              {isPendingAction && userToRevoke?.id === admin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              <span className="sr-only">Revoke Admin Role</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 border rounded-md">
                  <Users size={48} className="mx-auto text-muted-foreground opacity-50" />
                  <p className="mt-4 text-lg text-muted-foreground">
                    No administrator accounts found.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click "Grant Admin Role" to assign admin privileges to an existing user who already has a Firebase Authentication account.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={isRevokeDialogVisible} onOpenChange={setIsRevokeDialogVisible}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Revoke Admin Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke admin privileges for {userToRevoke?.displayName || userToRevoke?.email || 'this user'} (UID: {userToRevoke?.id})?
              They will no longer have admin access within this application. This does not delete their Firebase Authentication account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToRevoke(null)} disabled={isPendingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAdmin}
              disabled={isPendingAction}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPendingAction ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Revoking...</> : 'Yes, Revoke Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    
