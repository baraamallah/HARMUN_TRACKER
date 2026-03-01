'use client';

import * as React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggleButton } from '@/components/shared/theme-toggle-button';
import { Footer } from '@/components/layout/Footer';
import { PUBLIC_EVENT_CONFIG } from '@/lib/public-event-config';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [logoError, setLogoError] = React.useState(false);
  const [logoChecked, setLogoChecked] = React.useState(false);

  React.useEffect(() => {
    const img = new Image();
    img.onerror = () => setLogoError(true);
    img.onload = () => setLogoChecked(true);
    img.src = PUBLIC_EVENT_CONFIG.eventLogoPath;
  }, []);

  const useEventLogo = logoChecked && !logoError;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto h-16 flex items-center justify-between px-4 md:px-6">
          {useEventLogo ? (
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src={PUBLIC_EVENT_CONFIG.eventLogoPath}
                alt="Event Logo"
                className="h-8 object-contain"
                data-ai-hint="event logo organization"
              />
            </Link>
          ) : (
            <Logo />
          )}
          <ThemeToggleButton />
        </div>
      </header>

      <main className="flex-1 min-h-0 container mx-auto py-8 px-4 md:px-6">
        {children}
      </main>

      <Footer />
    </div>
  );
}
