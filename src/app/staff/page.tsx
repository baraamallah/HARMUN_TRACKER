
import * as React from 'react';
import { getStaffMembers, getSystemStaffTeams } from '@/lib/actions';
import { StaffDashboardClient } from '@/components/staff/StaffDashboardClient';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { auth } from '@/lib/firebase';
import { redirect }from 'next/navigation';


/**
 * Server component for the Staff Dashboard.
 * Fetches initial staff members and teams on the server for a faster initial page load.
 * The client component handles all interactivity like filtering, searching, and forms.
 */
export default async function StaffDashboardPage() {
    const user = auth.currentUser;
    if (!user) {
        // As with the main dashboard, client-side checks in the layout are the primary guard.
        // redirect('/auth/login');
    }

    const [initialStaffMembers, systemStaffTeams] = await Promise.all([
        getStaffMembers(),
        getSystemStaffTeams(),
    ]);

    return (
        <AppLayoutClientShell>
            <StaffDashboardClient
                initialStaffMembers={initialStaffMembers}
                systemStaffTeams={['All Teams', ...systemStaffTeams]}
            />
        </AppLayoutClientShell>
    );
}

