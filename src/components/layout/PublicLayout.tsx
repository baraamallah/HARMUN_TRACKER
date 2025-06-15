
'use client';

import * as React from 'react';
import Link from 'next/link'; // Added missing import
import { Logo } from '@/components/shared/Logo';
import { ThemeToggleButton } from '@/components/shared/theme-toggle-button';
import { getSystemLogoUrlSetting } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [munLogoUrl, setMunLogoUrl] = React.useState<string | null>(null);
  const [isLoadingLogo, setIsLoadingLogo] = React.useState(true);

  React.useEffect(() => {
    const fetchLogo = async () => {
      try {
        const url = await getSystemLogoUrlSetting();
        setMunLogoUrl(url);
      } catch (error) {
        console.error("Failed to fetch logo URL for public layout:", error);
      } finally {
        setIsLoadingLogo(false);
      }
    };
    fetchLogo();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto h-16 flex items-center justify-between px-4 md:px-6">
          {isLoadingLogo ? (
            <Skeleton className="h-8 w-32" />
          ) : munLogoUrl ? (
            <Link href="/" legacyBehavior passHref>
                <a className="flex items-center gap-2 group">
                    <img src={munLogoUrl} alt="Event Logo" className="h-8 object-contain" data-ai-hint="event logo organization"/>
                </a>
            </Link>
          ) : (
            <Logo />
          )}
          <ThemeToggleButton />
        </div>
      </header>
      <main className="flex-1 container mx-auto py-8 px-4 md:px-6">
        {children}
      </main>
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {munLogoUrl ? (
             <img src={munLogoUrl} alt="Event Logo Small" className="h-7 object-contain" data-ai-hint="event logo organization small"/>
          ) : (
            <Logo variant="circled-icon" size="sm" />
          )}
          <p className="text-sm text-muted-foreground text-center sm:text-right">
            &copy; {new Date().getFullYear()} MUN Attendance Tracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
