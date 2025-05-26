
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { OWNER_UID } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AddAdminDialog } from '@/components/superior-admin/AddAdminDialog';
import { getAdminUsers, revokeAdminRole } from '@/lib/actions';
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
    setIsLoadingAdmins(true);
    try {
      const admins = await getAdminUsers();
      setAdminUsers(admins);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load admin users.', variant: 'destructive' });
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [toast]);

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
      // Redirect or state update will be handled by onAuthStateChanged
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
        const result = await revokeAdminRole(userToRevoke.id);
        if (result.success) {
          toast({ title: 'Admin Role Revoked', description: result.message });
          fetchAdmins(); // Refresh list
        } else {
          toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
      } catch (error: any) {
        toast({ title: 'Operation Failed', description: error.message || 'Could not revoke admin role.', variant: 'destructive' });
      } finally {
        setIsRevokeDialogVisible(false);
        setUserToRevoke(null);
      }
    });
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
              Grant or revoke admin privileges for existing Firebase Authentication users.
              This does not create or delete their main Firebase Auth accounts.
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
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
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
                              <AvatarImage src={admin.avatarUrl || `https://placehold.co/40x40.png?text=${admin.email?.[0].toUpperCase() ?? 'A'}`} alt={admin.displayName || admin.email || 'Admin'} data-ai-hint="user avatar" />
                              <AvatarFallback>{admin.displayName?.[0] || admin.email?.[0].toUpperCase() || 'A'}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{admin.displayName || admin.email}</div>
                            {admin.displayName && <div className="text-xs text-muted-foreground">{admin.email}</div>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{admin.uid || admin.id}</TableCell>
                          <TableCell><Badge variant="secondary">{admin.role}</Badge></TableCell>
                           <TableCell className="text-sm text-muted-foreground">
                            {admin.createdAt?.toDate ? admin.createdAt.toDate().toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive/80" 
                              onClick={() => confirmRevokeAdmin(admin)}
                              disabled={isPendingAction}
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
                    Click "Grant Admin Role" to assign admin privileges to an existing user.
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
              Are you sure you want to revoke admin privileges for {userToRevoke?.email || 'this user'}?
              They will no longer have admin access. This does not delete their Firebase Authentication account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToRevoke(null)} disabled={isPendingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAdmin}
              disabled={isPendingAction}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPendingAction ? 'Revoking...' : 'Yes, Revoke Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
