'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, School, Shield, GitCommit } from 'lucide-react';
import { SuperiorAdminStats } from '@/components/superior-admin/SuperiorAdminStats';
import { SuperiorAdminRecentActivities } from '@/components/superior-admin/SuperiorAdminRecentActivities';
import { SuperiorAdminSystemStatus } from '@/components/superior-admin/SuperiorAdminSystemStatus';
import { SuperiorAdminQuickActions } from '@/components/superior-admin/SuperiorAdminQuickActions';

export function SuperiorAdminDashboard() {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <SuperiorAdminStats />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <SuperiorAdminRecentActivities />
                <SuperiorAdminSystemStatus />
            </div>
            <SuperiorAdminQuickActions />
        </div>
    );
}