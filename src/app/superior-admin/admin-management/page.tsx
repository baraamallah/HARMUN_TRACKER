
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { ShieldAlert, ArrowLeft, Users, TriangleAlert, Home, LogOut, UserPlus, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth'; // Renamed to avoid conflict
import { OWNER_UID } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
// Placeholder type for an Admin user - you'd expand this
type AdminUser = {
  id: string;
  email: string | null;
  displayName?: string | null;
  role: string;
  lastLogin?: string; // Example additional field
  avatarUrl?: string;
};

export default function AdminManagementPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { toast } = useToast();
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]); // Placeholder for admin users list
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false); // Placeholder for loading state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        // TODO: Fetch actual admin users from Firestore based on a 'role' field
        // For now, using placeholder data or an empty list.
        // setIsLoadingAdmins(true);
        // fetchAdminUsers().then(data => {
        //   setAdminUsers(data);
        //   setIsLoadingAdmins(false);
        // });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // router.push('/auth/login'); // Or wherever you want to redirect after logout
    } catch (error)
      {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const handleInviteAdmin = () => {
    // TODO: Implement dialog/modal to invite a new admin
    // This would involve:
    // 1. A form to enter the new admin's email.
    // 2. A server action or Firebase Function to:
    //    a. Create the user in Firebase Authentication (if they don't exist).
    //    b. Add a document to a 'users' collection in Firestore with their UID and a 'role: "admin"' field.
    //    c. Optionally send an invitation email.
    toast({
      title: 'Invite Admin',
      description: 'Functionality to invite new admin (e.g., open dialog) is not yet implemented.',
      variant: 'default',
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
              Create, view, and manage accounts for regular administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={handleInviteAdmin}>
                <UserPlus className="mr-2 h-5 w-5" /> Invite New Admin
              </Button>
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
                        <TableHead>Role</TableHead>
                        <TableHead>Last Login</TableHead>
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
                          <TableCell><Badge variant="secondary">{admin.role}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{admin.lastLogin || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => toast({title: 'Edit Admin', description: 'Edit functionality not implemented.'})} >
                              <Edit3 className="h-4 w-4" /> <span className="sr-only">Edit</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => toast({title: 'Delete Admin', description: 'Delete functionality not implemented.'})}>
                              <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete</span>
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
                    Click "Invite New Admin" to add administrators.
                  </p>
                </div>
              )}
               <p className="text-xs text-muted-foreground mt-4">
                * Admin listing and full management (creation, roles, deletion) requires backend implementation with Firebase Auth & Firestore.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
