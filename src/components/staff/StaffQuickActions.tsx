'use client';

import * as React from 'react';
import { AddStaffDialog } from './AddStaffDialog';
import { ExportStaffButton } from './ExportStaffButton';

export function StaffQuickActions() {
    return (
        <div className="flex justify-end space-x-2">
            <AddStaffDialog />
            <ExportStaffButton />
        </div>
    );
}
