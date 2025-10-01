
'use client';

import * as React from 'react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export function AppLayoutClientShell({ children }: { children: React.ReactNode }) {
  const { authSessionLoading } = useAuth();

  if (authSessionLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavbar />
      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
