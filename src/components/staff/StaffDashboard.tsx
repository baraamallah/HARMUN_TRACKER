'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffList } from '@/components/staff/StaffList';
import { StaffQuickActions } from '@/components/staff/StaffQuickActions';

export function StaffDashboard() {
    return (
        <div className="space-y-6">
            <StaffQuickActions />
            <Card>
                <CardHeader>
                    <CardTitle>Staff List</CardTitle>
                </CardHeader>
                <CardContent>
                    <StaffList />
                </CardContent>
            </Card>
        </div>
    );
}