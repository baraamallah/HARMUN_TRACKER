
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, AlertTriangle } from 'lucide-react';
import { importParticipants } from '@/lib/actions';
import type { Participant } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImportCsvDialogProps {
  onImportSuccess?: () => void; // Callback to refresh data on parent page
}

export function ImportCsvDialog({ onImportSuccess }: ImportCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [importSummary, setImportSummary] = useState<{
    detectedNewSchools: string[];
    detectedNewCommittees: string[];
  } | null>(null);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files ? event.target.files[0] : null);
    setImportSummary(null); // Reset summary when file changes
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
            return;
        }
        
        const lines = text.split(/\r\n|\n/).slice(1); // Skip header, handle both CRLF and LF
        const parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[] = [];
        let skippedLineCount = 0;
        
        lines.forEach((line, index) => {
          if (line.trim() === '') return; // Skip empty lines
          
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());

          if (cleanedValues.length >= 3 && cleanedValues[0] && cleanedValues[1] && cleanedValues[2]) {
            parsedParticipants.push({
              name: cleanedValues[0],
              school: cleanedValues[1],
              committee: cleanedValues[2],
            });
          } else if (line.trim()) { 
            console.warn(`Skipping malformed CSV line ${index + 2}: "${line}" (Expected Name,School,Committee)`);
            skippedLineCount++;
          }
        });

        if (parsedParticipants.length === 0 && skippedLineCount === lines.filter(l => l.trim()).length && lines.filter(l => l.trim()).length > 0) {
          toast({ title: 'No valid data found', description: `The CSV file might be empty or incorrectly formatted. ${skippedLineCount > 0 ? `${skippedLineCount} line(s) could not be parsed.` : ''} Expected: Name,School,Committee`, variant: 'default' });
          return;
        }

        try {
          const result = await importParticipants(parsedParticipants);
          let description = `${result.count} participants processed.`;
          if (result.errors > 0) description += ` ${result.errors} participants failed to import (check server console for details).`;
          if (skippedLineCount > 0) description += ` ${skippedLineCount} CSV lines were skipped due to formatting issues (check console).`;
          
          const importHadIssues = result.errors > 0 || (parsedParticipants.length === 0 && skippedLineCount > 0 && result.count === 0);

          toast({ 
            title: importHadIssues ? 'Import Partially Successful or Issues Found' : 'Import Processed',
            description: description,
            variant: importHadIssues ? 'default' : 'default' 
          });
          
          if (result.detectedNewSchools.length > 0 || result.detectedNewCommittees.length > 0) {
            setImportSummary({
              detectedNewSchools: result.detectedNewSchools,
              detectedNewCommittees: result.detectedNewCommittees,
            });
          } else {
             setIsOpen(false); // Only close if no new schools/committees detected to show summary
             setFile(null);
          }

          onImportSuccess?.();
        } catch (error: any) {
          console.error("Import error:", error);
          toast({ title: 'Import Failed', description: error.message || 'An error occurred. Check server console.', variant: 'destructive' });
        }
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', description: 'Could not read the selected file. It might be corrupted or inaccessible.', variant: 'destructive' });
        console.error("FileReader error:", reader.error);
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
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md"> {/* Adjusted width for better summary display */}
        <DialogHeader>
          <DialogTitle>Import Participants from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with participant data. Columns must be: Name, School, Committee.
            <br />
            <strong className="text-amber-600 dark:text-amber-400">Important:</strong> Schools and committees in the CSV must already exist in the system. New schools or committees will <strong className="underline">not</strong> be automatically created by this import. Please add them via the Superior Admin panel first.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">CSV File (.csv)</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={isPending} />
          </div>
          {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
        </div>

        {importSummary && (importSummary.detectedNewSchools.length > 0 || importSummary.detectedNewCommittees.length > 0) && (
          <Alert variant="default" className="bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700">
            <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            <AlertTitle className="text-amber-700 dark:text-amber-300 font-semibold">System List Notice</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400">
              The following schools/committees were found in your CSV but do not exist in the system. They were <strong className="underline">not</strong> added. Please add them manually via the Superior Admin panel if needed:
              {importSummary.detectedNewSchools.length > 0 && (
                <div className="mt-2">
                  <strong>New Schools Detected:</strong>
                  <ul className="list-disc list-inside text-xs">
                    {importSummary.detectedNewSchools.map(s => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              )}
              {importSummary.detectedNewCommittees.length > 0 && (
                <div className="mt-2">
                  <strong>New Committees Detected:</strong>
                  <ul className="list-disc list-inside text-xs">
                    {importSummary.detectedNewCommittees.map(c => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isPending}>
            {importSummary ? 'Close' : 'Cancel'}
          </Button>
          {!importSummary && (
            <Button onClick={handleImport} disabled={isPending || !file}>
              {isPending ? 'Importing...' : 'Import Participants'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
