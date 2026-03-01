import * as React from 'react';
import { getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { ParticipantDashboardClient } from '@/components/participants/ParticipantDashboardClient';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { redirect }from 'next/navigation';

/**
 * This is a server component that fetches initial data for filters, but participant
 * data is now fetched on the client to ensure authentication before access.
 */
export default async function AdminDashboardPage() {
  // Fetch non-protected data on the server, like system lists for filters.
  const [systemSchools, systemCommittees] = await Promise.all([
    getSystemSchools(),
    getSystemCommittees(),
  ]);

  return (
    <AppLayoutClientShell>
      <ParticipantDashboardClient
        // Pass empty initial participants; client will fetch them.
        initialParticipants={[]} 
        systemSchools={['All Schools', ...systemSchools]}
        systemCommittees={['All Committees', ...systemCommittees]}
      />
    </AppLayoutClientShell>
  );
}
