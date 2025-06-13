
'use client';

import { useState, useTransition, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, AlertTriangle, Info } from 'lucide-react';
import { importStaffMembers } from '@/lib/actions';
import type { StaffMember } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImportStaffCsvDialogProps {
  onImportSuccess?: () => void;
}

export function ImportStaffCsvDialog({ onImportSuccess }: ImportStaffCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [importSummary, setImportSummary] = useState<{
    detectedNewTeams: string[];
  } | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files ? event.target.files[0] : null);
    setImportSummary(null);
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a CSV file to import.', variant: 'destructive' });
      return;
    }
    setImportSummary(null);

    startTransition(async () => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) {
            toast({ title: 'Error reading file', description: 'Could not read file content.', variant: 'destructive' });
            setFile(null);
            return;
        }
        
        const allLines = text.split(/\r\n|\n/);
        const headerLine = allLines[0];
        const dataLines = allLines.slice(1);

        const parsedStaff: {
          name: string;
          role: string;
          department?: string;
          team?: string;
          email?: string;
          phone?: string;
          contactInfo?: string;
          notes?: string;
        }[] = [];
        let skippedLineCount = 0;

        dataLines.forEach((line, index) => {
          if (line.trim() === '') return;
          
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());

          if (cleanedValues.length >= 2 && cleanedValues[0] && cleanedValues[1]) {
            parsedStaff.push({
              name: cleanedValues[0],
              role: cleanedValues[1],
              department: cleanedValues[2] || '',
              team: cleanedValues[3] || '',
              email: cleanedValues[4] || '',
              phone: cleanedValues[5] || '',
              contactInfo: cleanedValues[6] || '',
              notes: cleanedValues[7] || '',
            });
          } else if (line.trim()) {
            console.warn(`Skipping malformed CSV line ${index + 2} for staff: "${line}" (Expected at least Name, Role)`);
            skippedLineCount++;
          }
        });

        console.log('Parsed staff CSV data being sent to server:', parsedStaff);

        if (parsedStaff.length === 0 && dataLines.filter(l => l.trim()).length > 0) {
          toast({ 
            title: 'No Valid Staff Data Found', 
            description: `The CSV file might be empty or all lines were incorrectly formatted. ${skippedLineCount} line(s) were skipped. Required columns: Name, Role. Please check your CSV file and try again. Header row: "${headerLine}"`, 
            variant: 'default',
            duration: 10000 
          });
          return;
        }
        if (parsedStaff.length === 0 && dataLines.filter(l => l.trim()).length === 0) {
          toast({ title: 'Empty CSV', description: 'The CSV file for staff appears to be empty or contains only a header row.', variant: 'default' });
          return;
        }


        try {
          const result = await importStaffMembers(parsedStaff as Array<Omit<StaffMember, 'id' | 'status' | 'imageUrl' | 'createdAt' | 'updatedAt'>>);
          let description = `${result.count} staff members processed.`;
          if (result.errors > 0) description += ` ${result.errors} staff members failed to import (check server console for details).`;
          if (skippedLineCount > 0) description += ` ${skippedLineCount} CSV lines were skipped due to formatting issues (check browser console).`;
          
          const importHadIssues = result.errors > 0 || (parsedStaff.length === 0 && skippedLineCount > 0 && result.count === 0);

          toast({ 
            title: importHadIssues ? 'Staff Import Partially Successful or Issues Found' : 'Staff Import Processed',
            description: description,
            variant: importHadIssues ? 'default' : 'default',
            duration: result.detectedNewTeams.length > 0 ? 15000 : 5000,
          });
          
          if (result.detectedNewTeams.length > 0) {
            setImportSummary({ detectedNewTeams: result.detectedNewTeams });
          } else {
             setIsOpen(false);
             setFile(null);
          }
          onImportSuccess?.();
        } catch (error: any) {
          console.error("Staff import error (client-side catch):", error);
          toast({ 
            title: 'Staff Import Failed', 
            description: `Server Action Error: ${error.message || 'An unexpected error occurred. Check server console for more details.'}`, 
            variant: 'destructive',
            duration: 10000
          });
        }
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', description: 'Could not read the selected file.', variant: 'destructive' });
        console.error("FileReader error (staff import):", reader.error);
        setFile(null);
      }
      reader.readAsText(file);
    });
  };
  
  const handleCloseDialog = () => {
    setIsOpen(false);
    setFile(null);
    setImportSummary(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if(!open) {
        handleCloseDialog();
      } else {
        setIsOpen(open);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadCloud className="mr-2 h-4 w-4" />
          Import Staff CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Staff Members from CSV</DialogTitle>
           <DialogDescription>
            Upload a CSV. Required columns: Name, Role. Ensure system lists (Staff Teams) are up-to-date.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground space-y-2 py-3 border-y my-4">
            <div>Upload a CSV file with staff data. The first row should be headers (they will be skipped).</div>
            <div><strong className="text-foreground">Required Columns:</strong> Name, Role.</div>
            <div><strong className="text-foreground">Column Order (Recommended):</strong></div>
            <ol className="list-decimal list-inside text-xs space-y-0.5 pl-4">
              <li>Name (e.g., "John Smith")</li>
              <li>Role (e.g., "Security Lead")</li>
              <li>Department (e.g., "Operations")</li>
              <li>Team (e.g., "Alpha Team")</li>
              <li>Email (e.g., "john.smith@example.com")</li>
              <li>Phone (e.g., "+1-555-0000")</li>
              <li>ContactInfo (e.g., "Radio Channel 5")</li>
              <li>Notes (any relevant notes)</li>
            </ol>
            <div className="mt-2">
              <strong className="text-amber-600 dark:text-amber-400">Important:</strong> Staff Teams listed in the CSV must already exist in the system. New teams will <strong className="underline">not</strong> be automatically created. Please add them via the Superior Admin panel first.
            </div>
             <Alert variant="default" className="mt-3 bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                <Info className="h-5 w-5" />
                <AlertTitle className="font-semibold">Tip for CSVs</AlertTitle>
                <AlertDescription>
                  Ensure text fields with commas are enclosed in double quotes (e.g., "Note with, a comma").
                </AlertDescription>
            </Alert>
        </div>

        <div className="grid gap-4 pt-2 pb-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="staff-csv-file">CSV File (.csv)</Label>
            <Input id="staff-csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={isPending} />
          </div>
          {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
        </div>

        {importSummary && importSummary.detectedNewTeams.length > 0 && (
          <Alert variant="default" className="bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700">
            <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            <AlertTitle className="text-amber-700 dark:text-amber-300 font-semibold">System List Notice (Staff Teams)</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400">
              The following Staff Teams were found in your CSV but do not exist in the system. They were <strong className="underline">not</strong> added. Please add them manually via the Superior Admin panel if needed:
              <div className="mt-2">
                <strong>New Staff Teams Detected:</strong>
                <ul className="list-disc list-inside text-xs">
                  {importSummary.detectedNewTeams.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isPending}>
            {importSummary ? 'Close' : 'Cancel'}
          </Button>
          {!importSummary && (
            <Button onClick={handleImport} disabled={isPending || !file}>
              {isPending ? 'Importing...' : 'Import Staff'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
