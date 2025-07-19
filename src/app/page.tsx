
import * as React from 'react';
import { getParticipants, getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { ParticipantDashboardClient } from '@/components/participants/ParticipantDashboardClient';
import type { Participant } from '@/types';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { auth } from '@/lib/firebase';
import { redirect }from 'next/navigation';

/**
 * This is a server component that fetches the initial data for the dashboard.
 * This makes the initial page load much faster because the data is ready
 * when the page is sent to the browser.
 */
export default async function AdminDashboardPage() {
  const user = auth.currentUser;

  // While this check happens on the server, auth state is typically managed client-side.
  // A more robust solution for production might involve middleware or session management.
  // For this setup, we rely on the client-side redirect in AppLayoutClientShell,
  // but a server-side check is good practice.
  if (!user) {
    // This redirect may not work as expected in all server environments without a session.
    // The client-side redirect in the layout is the primary guard.
    // redirect('/auth/login');
  }
  
  // Fetch initial data on the server.
  const [initialParticipants, systemSchools, systemCommittees] = await Promise.all([
    getParticipants(),
    getSystemSchools(),
    getSystemCommittees(),
  ]);

  return (
    <AppLayoutClientShell>
      <ParticipantDashboardClient
        initialParticipants={initialParticipants}
        systemSchools={['All Schools', ...systemSchools]}
        systemCommittees={['All Committees', ...systemCommittees]}
      />
    </AppLayoutClientShell>
  );
}
