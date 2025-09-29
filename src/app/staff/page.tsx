import * as React from 'react';
import { getSystemStaffTeams } from '@/lib/actions';
import { StaffDashboardClient } from '@/components/staff/StaffDashboardClient';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';

/**
 * Server component for the Staff Dashboard.
 * Fetches system teams for filters on the server. The main staff list is now
 * fetched on the client to ensure authentication before hitting Firestore.
 */
export default async function StaffDashboardPage() {
    const systemStaffTeams = await getSystemStaffTeams();

    return (
        <AppLayoutClientShell>
            <StaffDashboardClient
                // Pass empty initial staff; client will fetch them.
                initialStaffMembers={[]}
                systemStaffTeams={['All Teams', ...systemStaffTeams]}
            />
        </AppLayoutClientShell>
    );
}
