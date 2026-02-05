'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import type { Participant } from '@/types';
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExportExcelButtonProps {
    participants: Participant[];
    fileName?: string;
    currentFilters?: {
        school?: string;
        committee?: string;
        status?: string;
        day?: string;
    };
}

type ExportOption = 'all' | 'day1' | 'day2' | 'filtered';

export function ExportExcelButton({
    participants,
    fileName = 'harmun_attendance',
    currentFilters
}: ExportExcelButtonProps) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [exportOption, setExportOption] = React.useState<ExportOption>('filtered');
    const [isExporting, setIsExporting] = React.useState(false);

    const getFilteredParticipants = (option: ExportOption): Participant[] => {
        switch (option) {
            case 'all':
                return participants;
            case 'day1':
                return participants.filter(p => Boolean(p.dayAttendance?.day1));
            case 'day2':
                return participants.filter(p => Boolean(p.dayAttendance?.day2));
            case 'filtered':
            default:
                return participants;
        }
    };

    const formatCheckInTime = (time: string | null | undefined): string => {
        if (!time) return 'N/A';
        try {
            return new Date(time).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return 'N/A';
        }
    };

    const exportToExcel = () => {
        if (participants.length === 0) {
            toast({
                title: 'No Data',
                description: 'There are no participants to export.',
                variant: 'default'
            });
            return;
        }

        setIsExporting(true);

        try {
            const filteredData = getFilteredParticipants(exportOption);

            if (filteredData.length === 0) {
                toast({
                    title: 'No Data',
                    description: `No participants found for the selected filter.`,
                    variant: 'default',
                });
                setIsExporting(false);
                return;
            }

            // Sheet 1: Participant List
            const participantData = filteredData.map(p => ({
                'Name': p.name || '',
                'School': p.school || '',
                'Committee': p.committee || '',
                'Country': p.country || '',
                'Class/Grade': p.classGrade || '',
                'Email': p.email || '',
                'Phone': p.phone || '',
                'Status': p.status || '',
                'Day 1': p.dayAttendance?.day1 ? 'Yes' : 'No',
                'Day 2': p.dayAttendance?.day2 ? 'Yes' : 'No',
                'Day 1 Check-in': formatCheckInTime(p.checkInTimes?.day1 as string),
                'Day 2 Check-in': formatCheckInTime(p.checkInTimes?.day2 as string),
                'Notes': p.notes || '',
            }));

            const ws1 = XLSX.utils.json_to_sheet(participantData);

            // Auto-size columns
            const colWidths = [
                { wch: 25 }, // Name
                { wch: 20 }, // School
                { wch: 20 }, // Committee
                { wch: 15 }, // Country
                { wch: 12 }, // Class/Grade
                { wch: 25 }, // Email
                { wch: 15 }, // Phone
                { wch: 15 }, // Status
                { wch: 8 },  // Day 1
                { wch: 8 },  // Day 2
                { wch: 18 }, // Day 1 Check-in
                { wch: 18 }, // Day 2 Check-in
                { wch: 30 }, // Notes
            ];
            ws1['!cols'] = colWidths;

            // Sheet 2: Attendance Summary
            const schoolStats = new Map<string, { total: number; day1: number; day2: number }>();
            const committeeStats = new Map<string, { total: number; day1: number; day2: number }>();

            filteredData.forEach(p => {
                // School stats
                if (!schoolStats.has(p.school)) {
                    schoolStats.set(p.school, { total: 0, day1: 0, day2: 0 });
                }
                const schoolStat = schoolStats.get(p.school)!;
                schoolStat.total++;
                if (p.dayAttendance?.day1) schoolStat.day1++;
                if (p.dayAttendance?.day2) schoolStat.day2++;

                // Committee stats
                if (!committeeStats.has(p.committee)) {
                    committeeStats.set(p.committee, { total: 0, day1: 0, day2: 0 });
                }
                const committeeStat = committeeStats.get(p.committee)!;
                committeeStat.total++;
                if (p.dayAttendance?.day1) committeeStat.day1++;
                if (p.dayAttendance?.day2) committeeStat.day2++;
            });

            const summaryData = [
                { 'Category': 'OVERALL STATISTICS', 'Metric': '', 'Value': '' },
                { 'Category': 'Total Participants', 'Metric': '', 'Value': filteredData.length },
                { 'Category': 'Day 1 Attendance', 'Metric': '', 'Value': filteredData.filter(p => p.dayAttendance?.day1).length },
                { 'Category': 'Day 2 Attendance', 'Metric': '', 'Value': filteredData.filter(p => p.dayAttendance?.day2).length },
                { 'Category': 'Both Days', 'Metric': '', 'Value': filteredData.filter(p => p.dayAttendance?.day1 && p.dayAttendance?.day2).length },
                { 'Category': '', 'Metric': '', 'Value': '' },
                { 'Category': 'BY SCHOOL', 'Metric': '', 'Value': '' },
                ...Array.from(schoolStats.entries()).map(([school, stats]) => ({
                    'Category': school,
                    'Metric': `Day 1: ${stats.day1} | Day 2: ${stats.day2}`,
                    'Value': stats.total,
                })),
                { 'Category': '', 'Metric': '', 'Value': '' },
                { 'Category': 'BY COMMITTEE', 'Metric': '', 'Value': '' },
                ...Array.from(committeeStats.entries()).map(([committee, stats]) => ({
                    'Category': committee,
                    'Metric': `Day 1: ${stats.day1} | Day 2: ${stats.day2}`,
                    'Value': stats.total,
                })),
            ];

            const ws2 = XLSX.utils.json_to_sheet(summaryData);
            ws2['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }];

            // Sheet 3: Daily Breakdown
            const day1Only = filteredData.filter(p => p.dayAttendance?.day1 && !p.dayAttendance?.day2);
            const day2Only = filteredData.filter(p => p.dayAttendance?.day2 && !p.dayAttendance?.day1);
            const bothDays = filteredData.filter(p => p.dayAttendance?.day1 && p.dayAttendance?.day2);
            const neitherDay = filteredData.filter(p => !p.dayAttendance?.day1 && !p.dayAttendance?.day2);

            const breakdownData = [
                { 'Attendance Pattern': 'Day 1 Only', 'Count': day1Only.length, 'Percentage': `${((day1Only.length / filteredData.length) * 100).toFixed(1)}%` },
                { 'Attendance Pattern': 'Day 2 Only', 'Count': day2Only.length, 'Percentage': `${((day2Only.length / filteredData.length) * 100).toFixed(1)}%` },
                { 'Attendance Pattern': 'Both Days', 'Count': bothDays.length, 'Percentage': `${((bothDays.length / filteredData.length) * 100).toFixed(1)}%` },
                { 'Attendance Pattern': 'Neither Day', 'Count': neitherDay.length, 'Percentage': `${((neitherDay.length / filteredData.length) * 100).toFixed(1)}%` },
            ];

            const ws3 = XLSX.utils.json_to_sheet(breakdownData);
            ws3['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws1, 'Participants');
            XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
            XLSX.utils.book_append_sheet(wb, ws3, 'Daily Breakdown');

            // Generate file name
            const optionSuffix = exportOption === 'all' ? 'all' :
                exportOption === 'day1' ? 'day1' :
                    exportOption === 'day2' ? 'day2' : 'filtered';
            const timestamp = new Date().toISOString().split('T')[0];
            const finalFileName = `${fileName}_${optionSuffix}_${timestamp}.xlsx`;

            // Download
            XLSX.writeFile(wb, finalFileName);

            toast({
                title: 'Export Successful',
                description: `Exported ${filteredData.length} participant(s) to ${finalFileName}`,
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

    const getOptionLabel = (option: ExportOption): string => {
        switch (option) {
            case 'all':
                return `All Participants (${participants.length})`;
            case 'day1':
                return `Day 1 Only (${participants.filter(p => p.dayAttendance?.day1).length})`;
            case 'day2':
                return `Day 2 Only (${participants.filter(p => p.dayAttendance?.day2).length})`;
            case 'filtered':
                return `Current View (${participants.length})`;
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
                    <DialogTitle>Export to Excel</DialogTitle>
                    <DialogDescription>
                        Choose which participants to include in the export. The Excel file will contain multiple sheets with detailed statistics.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <RadioGroup value={exportOption} onValueChange={(value) => setExportOption(value as ExportOption)}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="filtered" id="filtered" />
                            <Label htmlFor="filtered" className="font-normal cursor-pointer">
                                {getOptionLabel('filtered')}
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all" className="font-normal cursor-pointer">
                                {getOptionLabel('all')}
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="day1" id="day1" />
                            <Label htmlFor="day1" className="font-normal cursor-pointer">
                                {getOptionLabel('day1')}
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="day2" id="day2" />
                            <Label htmlFor="day2" className="font-normal cursor-pointer">
                                {getOptionLabel('day2')}
                            </Label>
                        </div>
                    </RadioGroup>
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
