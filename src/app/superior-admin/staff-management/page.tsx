'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Users } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { StaffMember } from '@/types';
import { StaffManagementTable } from '@/components/superior-admin/StaffManagementTable';
import { Skeleton } from '@/components/ui/skeleton';

const STAFF_COLLECTION = 'staff_members';

export default function StaffManagementPage() {
  const pathname = usePathname();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const fetchStaffMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const staffColRef = collection(db, STAFF_COLLECTION);
      const q = query(staffColRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const members = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as StaffMember[];
      setStaffMembers(members);
    } catch (error) {
      console.error("Error fetching staff members:", error);
      toast({
        title: 'Error',
        description: 'Failed to fetch staff members.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user) {
        fetchStaffMembers();
      }
    });
    return () => unsubscribe();
  }, [fetchStaffMembers]);

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users size={32} />
            </div>
            <CardTitle className="text-2xl font-bold">Staff Management</CardTitle>
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

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-red-500/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-destructive">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">
              You must be logged in to view this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/auth/login?redirect=${pathname}`} legacyBehavior passHref>
              <Button variant="destructive" size="lg" className="w-full">
                Log In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background to-muted/50">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Staff Management
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
            <CardTitle className="text-2xl">Manage Staff Authorities</CardTitle>
            <CardDescription>
              Easily edit staff roles and other details in place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaffManagementTable staffMembers={staffMembers} isLoading={isLoading} onStaffUpdate={fetchStaffMembers} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}