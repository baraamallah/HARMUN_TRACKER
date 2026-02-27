'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import type { StaffMember } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

interface ExportStaffExcelButtonProps {
    staffMembers: StaffMember[];
    fileName?: string;
}

export function ExportStaffExcelButton({
    staffMembers,
    fileName = 'staff_attendance',
}: ExportStaffExcelButtonProps) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);

    const exportToExcel = () => {
        if (staffMembers.length === 0) {
            toast({
                title: 'No Data',
                description: 'There are no staff members to export.',
                variant: 'default'
            });
            return;
        }

        setIsExporting(true);

        try {
            // Sheet 1: Staff List
            const staffData = staffMembers.map(s => ({
                'Name': s.name || '',
                'Role': s.role || '',
                'Team': s.team || '',
                'Department': s.department || '',
                'Email': s.email || '',
                'Phone': s.phone || '',
                'Contact Info': s.contactInfo || '',
                'Status': s.status || '',
                'Notes': s.notes || '',
            }));

            const ws1 = XLSX.utils.json_to_sheet(staffData);

            // Auto-size columns
            const colWidths = [
                { wch: 25 }, // Name
                { wch: 20 }, // Role
                { wch: 20 }, // Team
                { wch: 20 }, // Department
                { wch: 25 }, // Email
                { wch: 15 }, // Phone
                { wch: 25 }, // Contact Info
                { wch: 15 }, // Status
                { wch: 30 }, // Notes
            ];
            ws1['!cols'] = colWidths;

            // Sheet 2: Summary
            const teamStats = new Map<string, { total: number; onDuty: number }>();
            staffMembers.forEach(s => {
                const team = s.team || 'No Team';
                if (!teamStats.has(team)) {
                    teamStats.set(team, { total: 0, onDuty: 0 });
                }
                const stat = teamStats.get(team)!;
                stat.total++;
                if (s.status === 'On Duty') stat.onDuty++;
            });

            const summaryData = [
                { 'Category': 'STAFF STATISTICS', 'Metric': '', 'Value': '' },
                { 'Category': 'Total Staff', 'Metric': '', 'Value': staffMembers.length },
                { 'Category': 'Currently On Duty', 'Metric': '', 'Value': staffMembers.filter(s => s.status === 'On Duty').length },
                { 'Category': '', 'Metric': '', 'Value': '' },
                { 'Category': 'BY TEAM', 'Metric': 'On Duty', 'Value': 'Total' },
                ...Array.from(teamStats.entries()).map(([team, stats]) => ({
                    'Category': team,
                    'Metric': stats.onDuty,
                    'Value': stats.total,
                })),
            ];

            const ws2 = XLSX.utils.json_to_sheet(summaryData);
            ws2['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws1, 'Staff Members');
            XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

            const timestamp = new Date().toISOString().split('T')[0];
            const finalFileName = `${fileName}_${timestamp}.xlsx`;

            XLSX.writeFile(wb, finalFileName);

            toast({
                title: 'Export Successful',
                description: `Exported ${staffMembers.length} staff member(s) to ${finalFileName}`,
            });

            setIsOpen(false);
        } catch (error: any) {
            console.error('Excel export error:', error);
            toast({
                title: 'Export Failed',
                description: error.message || 'Failed to export data to Excel',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export to Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Staff to Excel</DialogTitle>
                    <DialogDescription>
                        Export staff list and summary statistics to an Excel file.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                     <p className="text-sm text-muted-foreground">
                        This will export {staffMembers.length} staff members from the current view.
                     </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button onClick={exportToExcel} disabled={isExporting}>
                        {isExporting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Export
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
