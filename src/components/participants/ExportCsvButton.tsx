
'use client';

import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Participant } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportCsvButtonProps {
  participants: Participant[];
  fileName?: string;
}

export function ExportCsvButton({ participants, fileName = 'attendance_export.csv' }: ExportCsvButtonProps) {
  const { toast } = useToast();

  const exportToCsv = () => {
    if (participants.length === 0) {
      toast({ title: 'No Data', description: 'There are no participants to export.', variant: 'default' });
      return;
    }

    const headers = ['ID', 'Name', 'School', 'Committee', 'Status'];
    const csvContent = [
      headers.join(','),
      ...participants.map(p => [
        p.id || '', 
        `"${p.name.replace(/"/g, '""')}"`, // Escape double quotes
        `"${p.school.replace(/"/g, '""')}"`,
        `"${p.committee.replace(/"/g, '""')}"`,
        p.status
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      Export CSV
    </Button>
  );
}
