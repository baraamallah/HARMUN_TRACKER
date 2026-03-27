'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
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
import { ShieldAlert, ArrowLeft, Users, TriangleAlert, Home, LogOut, Trash2, Loader2, Edit, UserPlus } from 'lucide-react';
import { auth, db } from '@/lib/firebase'; 
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { OWNER_UID } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
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
  const pathname = usePathname();
  const { loggedInUser: currentUser, authSessionLoading: isLoadingAuth, userAppRole } = useAuth();
  const { toast } = useToast();
  
  const [adminUsers, setAdminUsers] = useState<AdminManagedUser[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isPendingAction, startTransitionAction] = useTransition();

  const [userToRevoke, setUserToRevoke] = useState<AdminManagedUser | null>(null);
  const [isRevokeDialogVisible, setIsRevokeDialogVisible] = useState(false);

  const [isAddAdminDialogOpen, setIsAddAdminDialogOpen] = useState(false);
  const [adminToEdit, setAdminToEdit] = useState<AdminManagedUser | null>(null);

  const handleOpenAddDialog = () => {
    setAdminToEdit(null);
    setIsAddAdminDialogOpen(true);
  };

  const handleOpenEditDialog = (admin: AdminManagedUser) => {
    setAdminToEdit(admin);
    setIsAddAdminDialogOpen(true);
  };


  const fetchAdmins = useCallback(async () => {
    if (userAppRole !== 'owner') return;
    setIsLoadingAdmins(true);
    try {
      const usersColRef = collection(db, USERS_COLLECTION);
      const q = query(usersColRef, where('role', 'in', ['admin', 'session_manager']), orderBy('email'));
      const querySnapshot = await getDocs(q);
      const admins = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, 
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          defaultCommittee: data.defaultCommittee,
          imageUrl: data.imageUrl,
          canAccessSuperiorAdmin: data.canAccessSuperiorAdmin === true,
          permissions: data.permissions,
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
  }, [toast, userAppRole]);

  useEffect(() => {
    if (!isLoadingAuth && userAppRole === 'owner') {
      fetchAdmins();
    }
  }, [isLoadingAuth, userAppRole, fetchAdmins]);

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
              You do not have permission to manage admin accounts. This page is for the designated Superior Admin only.
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
            <Button asChild variant="outline" className="w-full">
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
        <div className="container mx-auto flex h-16 sm:h-20 items-center justify-between px-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Admin Account Management
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/superior-admin">
              <span>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Superior Admin
              </span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-4 sm:py-8 px-2 sm:px-6 lg:px-8">
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
              <Button onClick={handleOpenAddDialog}>
                <UserPlus className="mr-2 h-5 w-5" /> Grant Admin/Manager Role
              </Button>
            </div>
            
            <Separator />

            <div>
              <h3 className="text-xl font-semibold mb-4">Existing Administrators & Managers</h3>
              {isLoadingAdmins ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-xl bg-card/50 shadow-sm animate-pulse">
                        <div className="h-12 w-12 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-muted rounded" />
                            <div className="h-3 w-48 bg-muted rounded" />
                        </div>
                    </div>
                  ))}
                </div>
              ) : adminUsers.length > 0 ? (
                <div className="space-y-4">
                  {/* Mobile Card View */}
                  <div className="grid grid-cols-1 gap-4 sm:hidden">
                    {adminUsers.map((admin) => (
                      <Card key={admin.id} className="overflow-hidden border-2 hover:border-primary/50 transition-colors shadow-sm">
                        <div className="p-4 sm:p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12 border-2 border-primary/10">
                                <AvatarImage src={admin.imageUrl || `https://placehold.co/40x40.png?text=${(admin.displayName || admin.email || 'A')?.[0].toUpperCase()}`} />
                                <AvatarFallback>{(admin.displayName?.[0] || admin.email?.[0] || 'A').toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-bold text-foreground leading-tight">{admin.displayName || 'No Name'}</h4>
                                <p className="text-xs text-muted-foreground truncate max-w-[150px]">{admin.email}</p>
                              </div>
                            </div>
                            <Badge variant={admin.role === 'admin' ? 'default' : 'outline'} className="capitalize shadow-sm">
                              {admin.role?.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                              {admin.canAccessSuperiorAdmin && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">SUP</Badge>}
                              {Object.values(admin.permissions || {}).filter(Boolean).length > 0 && (
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 h-5 px-1.5 text-[10px]">
                                  {Object.values(admin.permissions || {}).filter(Boolean).length} Permissions
                                </Badge>
                              )}
                              {admin.role === 'session_manager' && admin.defaultCommittee && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] truncate max-w-[120px]">
                                  {admin.defaultCommittee}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t mt-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                Joined {formatDateString(admin.createdAt)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 w-9 rounded-lg"
                                  onClick={() => handleOpenEditDialog(admin)}
                                  disabled={isPendingAction}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-9 w-9 rounded-lg"
                                  onClick={() => confirmRevokeAdmin(admin)}
                                  disabled={isPendingAction}
                                >
                                  {isPendingAction && userToRevoke?.id === admin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border-2 shadow-sm bg-background">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[60px] pl-6">Avatar</TableHead>
                          <TableHead>User Identity</TableHead>
                          <TableHead>Role / Committee</TableHead>
                          <TableHead>Permissions Overview</TableHead>
                          <TableHead>Granted</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminUsers.map((admin) => (
                          <TableRow key={admin.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="pl-6">
                              <Avatar className="h-10 w-10 border">
                                <AvatarImage src={admin.imageUrl || `https://placehold.co/40x40.png?text=${(admin.displayName || admin.email || 'A')?.[0].toUpperCase()}`} />
                                <AvatarFallback>{(admin.displayName?.[0] || admin.email?.[0] || 'A').toUpperCase()}</AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground">{admin.displayName || 'No Name'}</span>
                                <span className="text-xs text-muted-foreground">{admin.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={admin.role === 'admin' ? 'default' : 'outline'} className="w-fit capitalize shadow-sm">
                                  {admin.role?.replace('_', ' ')}
                                </Badge>
                                {admin.role === 'session_manager' && admin.defaultCommittee && (
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                                    {admin.defaultCommittee}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {admin.canAccessSuperiorAdmin && <Badge variant="destructive" className="text-[10px] px-1.5 h-5">SUP</Badge>}
                                {Object.entries(admin.permissions || {}).map(([key, value]) => 
                                  value && (
                                    <Badge key={key} variant="secondary" className="text-[10px] px-1.5 h-5 bg-background border">
                                      {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </TableCell>
                             <TableCell className="text-xs font-medium text-muted-foreground">
                              {formatDateString(admin.createdAt)}
                            </TableCell>
                            <TableCell className="text-right pr-6 space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => handleOpenEditDialog(admin)}
                                disabled={isPendingAction}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors" 
                                onClick={() => confirmRevokeAdmin(admin)}
                                disabled={isPendingAction}
                              >
                                {isPendingAction && userToRevoke?.id === admin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border rounded-md">
                  <Users size={48} className="mx-auto text-muted-foreground opacity-50" />
                  <p className="mt-4 text-lg text-muted-foreground">
                    No administrator or session manager accounts found.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click "Grant Admin/Manager Role" to assign privileges to an existing user who already has a Firebase Authentication account.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      
      <AddAdminDialog
        isOpen={isAddAdminDialogOpen}
        onOpenChange={setIsAddAdminDialogOpen}
        adminToEdit={adminToEdit}
        onAdminAdded={() => {
          fetchAdmins();
          setIsAddAdminDialogOpen(false);
          setAdminToEdit(null);
        }}
      />

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