'use client';

import * as React from 'react';
import { TopNavbar } from '@/components/layout/TopNavbar';

export function AppLayoutClientShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavbar />
      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}