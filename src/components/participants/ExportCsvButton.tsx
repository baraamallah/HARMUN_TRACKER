
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

    const loadingToast = toast({
      title: 'Exporting Participants CSV',
      description: 'Generating CSV file... Please wait.',
      variant: 'default',
    });

    try {
      const headers = [
        'name',
        'school',
        'committee',
        'country',
        'classgrade',
        'email',
        'phone',
        'day1',
        'day2',
        'notes',
        'additionaldetails'
      ];

      const csvRows = participants.map(p => [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.school || '').replace(/"/g, '""')}"`,
        `"${(p.committee || '').replace(/"/g, '""')}"`,
        `"${(p.country || '').replace(/"/g, '""')}"`,
        `"${(p.classGrade || '').replace(/"/g, '""')}"`,
        `"${(p.email || '').replace(/"/g, '""')}"`,
        `"${(p.phone || '').replace(/"/g, '""')}"`,
        `"${p.dayAttendance?.day1 ? 'Yes' : 'No'}"`,
        `"${p.dayAttendance?.day2 ? 'Yes' : 'No'}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`,
        `"${(p.additionalDetails || '').replace(/"/g, '""')}"`
      ].join(','));

      const csvContent = [
        headers.join(','),
        ...csvRows,
      ].join('\n');

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
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
        loadingToast.update({ id: loadingToast.id, title: 'Export Successful', description: `Data exported to ${fileName}` });
      } else {
        throw new Error('Your browser does not support direct CSV download.');
      }
    } catch (error: any) {
      loadingToast.update({ id: loadingToast.id, title: 'Export Failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Button variant="outline" onClick={exportToCsv}>
      <DownloadCloud className="mr-2 h-4 w-4" />
      Export Participants CSV
    </Button>
  );
}

