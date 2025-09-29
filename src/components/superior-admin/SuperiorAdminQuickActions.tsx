'use client';

import * as React from 'react';
import { AddStaffDialog } from '@/components/staff/AddStaffDialog';
import { SendNotificationDialog } from './SendNotificationDialog';
import { SystemSettingsDialog } from './SystemSettingsDialog';
import { ExportDataButton } from './ExportDataButton';

export function SuperiorAdminQuickActions() {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <AddStaffDialog />
            <SendNotificationDialog />
            <SystemSettingsDialog />
            <ExportDataButton />
        </div>
    );
}
