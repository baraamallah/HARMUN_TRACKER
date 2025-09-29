import * as React from 'react';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { SuperiorAdminDashboardClient } from '@/components/superior-admin/SuperiorAdminDashboardClient';

export default function SuperiorAdminDashboardPage() {
    return (
        <AppLayoutClientShell>
            <SuperiorAdminDashboardClient />
        </AppLayoutClientShell>
    );
}