
'use client';

import * as React from 'react';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggleButton } from '@/components/shared/theme-toggle-button';
// import { getSystemLogoUrlSetting } from '@/lib/actions'; // Removed
import { Skeleton } from '@/components/ui/skeleton';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  // const [munLogoUrl, setMunLogoUrl] = React.useState<string | null>(null); // Removed
  // const [isLoadingLogo, setIsLoadingLogo] = React.useState(true); // Removed

  // React.useEffect(() => { // Removed
  //   const fetchLogo = async () => {
  //     try {
  //       const url = await getSystemLogoUrlSetting();
  //       setMunLogoUrl(url);
  //     } catch (error) {
  //       console.error("Failed to fetch logo URL for public layout:", error);
  //     } finally {
  //       setIsLoadingLogo(false);
  //     }
  //   };
  //   fetchLogo();
  // }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto h-16 flex items-center justify-between px-4 md:px-6">
          <Logo />
          <ThemeToggleButton />
        </div>
      </header>
      <main className="flex-1 container mx-auto py-8 px-4 md:px-6">
        {children}
      </main>
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="circled-icon" size="sm" />
          <p className="text-sm text-muted-foreground text-center sm:text-right">
            &copy; {new Date().getFullYear()} MUN Attendance Tracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
