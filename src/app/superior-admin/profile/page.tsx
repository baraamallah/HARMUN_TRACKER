
'use client';

import React from 'react';
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
import { ArrowLeft, Home, User, TriangleAlert, LogOut, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import type { AdminManagedUser } from '@/types';
import { ProfileForm } from '@/components/superior-admin/ProfileForm';

export default function ProfilePage() {
  const pathname = usePathname();
  const { loggedInUser: currentUser, adminUser, authSessionLoading: isLoading, userAppRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold">My Profile</CardTitle>
            <CardDescription>Loading your profile and verifying credentials...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // The useAuth hook now handles creating the owner's virtual profile, so we only need to check if you are NOT the owner.
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
              Only the Superior Admin can access this profile page.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-4 mt-4">
             <Button asChild variant="outline" className="w-full">
              <Link href="/superior-admin">
                <span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Superior Admin</span>
              </Link>
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
  
  // By this point, if you are the owner, `adminUser` is guaranteed to be populated by the useAuth hook.
  if (!adminUser) {
     return (
       <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-yellow-500/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-yellow-500">
          <CardHeader>
             <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
              <TriangleAlert size={48} />
            </div>
            <CardTitle className="text-3xl font-bold text-yellow-600">Profile Data Missing</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">
              An unexpected error occurred and your profile data could not be loaded. Please try refreshing the page.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-4 mt-4">
             <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <span><Home className="mr-2 h-4 w-4" /> Go to Main Dashboard</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
     )
  }


  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background to-muted/50">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              My Profile
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

      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Your Profile</CardTitle>
            <CardDescription>
              Update your display name and avatar. Changes will be reflected across the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm adminUser={adminUser} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
