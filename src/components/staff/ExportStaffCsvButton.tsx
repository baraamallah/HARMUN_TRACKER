
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

    const headers = [
      'ID', 
      'Name', 
      'Role', 
      'Department', 
      'Team', 
      'Email',
      'Phone',
      'ContactInfo', // Consistent with import field 'contactinfo'
      'Status',
      'Notes'
    ];
    
    const csvRows = staffMembers.map(s => [
      s.id || '', // Ensure ID is exported
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.role || '').replace(/"/g, '""')}"`,
      `"${(s.department || '').replace(/"/g, '""')}"`,
      `"${(s.team || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.contactInfo || '').replace(/"/g, '""')}"`,
      s.status || 'Off Duty',
      `"${(s.notes || '').replace(/"/g, '""')}"`
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
      Export Staff CSV
    </Button>
  );
}

