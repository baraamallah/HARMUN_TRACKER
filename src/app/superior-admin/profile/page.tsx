'use client';

import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, Home, User, TriangleAlert, Loader2, Edit, Mail, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import type { AdminManagedUser } from '@/types';
import { ProfileForm } from '@/components/superior-admin/ProfileForm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function ProfilePage() {
  const pathname = usePathname();
  const { adminUser, authSessionLoading: isLoading, userAppRole, refreshAuth } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleFormSubmitSuccess = () => {
    refreshAuth(); // Re-fetch user data to show updated info
    setIsFormOpen(false);
  };

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
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
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
              Only the Superior Admin can access this profile page.
            </CardDescription>
          </CardHeader>
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
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-2xl">
      <Button asChild variant="outline" className="mb-6">
       <Link href="/superior-admin"><span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Superior Admin</span></Link>
     </Button>
      <Card className="shadow-lg">
        <CardHeader className="items-center text-center p-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <Avatar className="h-32 w-32 border-4 border-primary mb-4 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
            <AvatarImage src={adminUser.imageUrl} alt={`${adminUser.displayName}'s avatar`} />
            <AvatarFallback className="text-4xl">{(adminUser.displayName || 'A').substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl font-bold">{adminUser.displayName}</CardTitle>
          <CardDescription className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" /> Superior Admin
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3 px-6 pb-6 pt-6">
          <div className="flex justify-between items-center">
            <span className="font-medium text-muted-foreground flex items-center"><Mail className="mr-2 h-4 w-4 text-primary/70" />Email:</span>
            <span className="text-right break-all">{adminUser.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium text-muted-foreground flex items-center"><User className="mr-2 h-4 w-4 text-primary/70" />User ID:</span>
            <span className="text-right font-mono text-xs bg-muted p-1 rounded">{adminUser.id}</span>
          </div>
        </CardContent>
        <CardFooter className="p-4 border-t">
          <Button onClick={() => setIsFormOpen(true)} className="w-full">
            <Edit className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
        </CardFooter>
      </Card>

      <ProfileForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        adminUser={adminUser}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </div>
  );
}