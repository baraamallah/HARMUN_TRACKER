
'use client';

import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { StaffMember } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportStaffCsvButtonProps {
  staffMembers: StaffMember[];
  fileName?: string;
}

export function ExportStaffCsvButton({ staffMembers, fileName = 'staff_export.csv' }: ExportStaffCsvButtonProps) {
  const { toast } = useToast();

  const exportToCsv = () => {
    if (staffMembers.length === 0) {
      toast({ title: 'No Data', description: 'There are no staff members to export.', variant: 'default' });
      return;
    }

    const loadingToast = toast({
      title: 'Exporting Staff CSV',
      description: 'Generating CSV file... Please wait.',
      variant: 'default',
    });

    try {
      const headers = [
        'name', 
        'role', 
        'department', 
        'team', 
        'email',
        'phone',
        'contactinfo',
        'notes'
      ];
      
      const csvRows = staffMembers.map(s => [
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.role || '').replace(/"/g, '""')}"`,
        `"${(s.department || '').replace(/"/g, '""')}"`,
        `"${(s.team || '').replace(/"/g, '""')}"`,
        `"${(s.email || '').replace(/"/g, '""')}"`,
        `"${(s.phone || '').replace(/"/g, '""')}"`,
        `"${(s.contactInfo || '').replace(/"/g, '""')}"`,
        `"${(s.notes || '').replace(/"/g, '""')}"`
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
      Export Staff CSV
    </Button>
  );
}

