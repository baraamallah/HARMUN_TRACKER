
'use client';

import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Participant } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportCsvButtonProps {
  participants: Participant[];
  fileName?: string;
}

export function ExportCsvButton({ participants, fileName = 'participants_export.csv' }: ExportCsvButtonProps) {
  const { toast } = useToast();

  const exportToCsv = () => {
    if (participants.length === 0) {
      toast({ title: 'No Data', description: 'There are no participants to export.', variant: 'default' });
      return;
    }

    const headers = [
      'ID', 
      'Name', 
      'School', 
      'Committee', 
      'Country', 
      'Class/Grade', // Consistent with import field 'classgrade'
      'Email',
      'Phone',
      'Status',
      'Notes',
      'Additional Details', // Consistent with import field 'additionaldetails'
      'Attended',
      'CheckInTime'
    ];
    
    const csvRows = participants.map(p => [
      p.id || '', // Ensure ID is exported
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.school || '').replace(/"/g, '""')}"`,
      `"${(p.committee || '').replace(/"/g, '""')}"`,
      `"${(p.country || '').replace(/"/g, '""')}"`,
      `"${(p.classGrade || '').replace(/"/g, '""')}"`,
      `"${(p.email || '').replace(/"/g, '""')}"`,
      `"${(p.phone || '').replace(/"/g, '""')}"`,
      p.status || 'Absent',
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      `"${(p.additionalDetails || '').replace(/"/g, '""')}"`,
      p.attended ? 'Yes' : 'No',
      p.checkInTime && typeof p.checkInTime === 'string' ? `"${new Date(p.checkInTime).toLocaleString()}"` : (p.checkInTime ? "Invalid Date" : '')
    ].join(','));

    const csvContent = [
      headers.join(','),
      ...csvRows,
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // Added BOM for Excel
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Export Successful', description: `Data exported to ${fileName}` });
    } else {
      toast({ title: 'Export Failed', description: 'Your browser does not support direct CSV download.', variant: 'destructive' });
    }
  };

  return (
    <Button variant="outline" onClick={exportToCsv}>
      <DownloadCloud className="mr-2 h-4 w-4" />
      Export Participants CSV
    </Button>
  );
}

