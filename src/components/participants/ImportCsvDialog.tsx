
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
  DialogTrigger, // Ensured DialogTrigger is imported
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, AlertTriangle, Info } from 'lucide-react';
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
        const parsedParticipants: {
          name: string;
          school: string;
          committee: string;
          country?: string;
          classGrade?: string;
          email?: string;
          phone?: string;
          notes?: string;
          additionalDetails?: string;
        }[] = [];
        let skippedLineCount = 0;
        
        // Expected CSV Column Order:
        // 0: Name (Required)
        // 1: School (Required)
        // 2: Committee (Required)
        // 3: Country (Optional)
        // 4: Class/Grade (Optional)
        // 5: Email (Optional)
        // 6: Phone (Optional)
        // 7: Notes (Optional)
        // 8: Additional Details (Optional)

        lines.forEach((line, index) => {
          if (line.trim() === '') return; // Skip empty lines
          
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());

          if (cleanedValues.length >= 3 && cleanedValues[0] && cleanedValues[1] && cleanedValues[2]) {
            parsedParticipants.push({
              name: cleanedValues[0],
              school: cleanedValues[1],
              committee: cleanedValues[2],
              country: cleanedValues[3] || '',
              classGrade: cleanedValues[4] || '',
              email: cleanedValues[5] || '',
              phone: cleanedValues[6] || '',
              notes: cleanedValues[7] || '',
              additionalDetails: cleanedValues[8] || '',
            });
          } else if (line.trim()) { 
            console.warn(`Skipping malformed CSV line ${index + 2}: "${line}" (Expected at least Name,School,Committee)`);
            skippedLineCount++;
          }
        });

        if (parsedParticipants.length === 0 && skippedLineCount === lines.filter(l => l.trim()).length && lines.filter(l => l.trim()).length > 0) {
          toast({ title: 'No valid data found', description: `The CSV file might be empty or incorrectly formatted. ${skippedLineCount > 0 ? `${skippedLineCount} line(s) could not be parsed.` : ''} At least Name, School, and Committee are required.`, variant: 'default' });
          return;
        }

        try {
          // Type assertion to match the expected server action input
          const result = await importParticipants(parsedParticipants as Array<Omit<Participant, 'id' | 'status' | 'imageUrl' | 'attended' | 'checkInTime' | 'createdAt' | 'updatedAt'>>);
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
      <DialogContent className="sm:max-w-lg"> {/* Adjusted width for better summary display */}
        <DialogHeader>
          <DialogTitle>Import Participants from CSV</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Upload a CSV file with participant data. The first row should be headers (they will be skipped).</p>
            <p><strong className="text-foreground">Required Columns:</strong> Name, School, Committee.</p>
            <p><strong className="text-foreground">Column Order (Recommended):</strong></p>
            <ol className="list-decimal list-inside text-xs space-y-0.5 pl-4">
              <li>Name (e.g., "Jane Doe")</li>
              <li>School (e.g., "International School of Example")</li>
              <li>Committee (e.g., "Security Council")</li>
              <li>Country (e.g., "United States")</li>
              <li>Class/Grade (e.g., "10th Grade")</li>
              <li>Email (e.g., "jane.doe@example.com")</li>
              <li>Phone (e.g., "+1-555-1234")</li>
              <li>Notes (any relevant notes)</li>
              <li>Additional Details (other info)</li>
            </ol>
            <p className="mt-2">
              <strong className="text-amber-600 dark:text-amber-400">Important:</strong> Schools and committees listed in the CSV must already exist in the system. New schools or committees will <strong className="underline">not</strong> be automatically created by this import. Please add them via the Superior Admin panel first.
            </p>
             <Alert variant="default" className="mt-3 bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                <Info className="h-5 w-5" />
                <AlertTitle className="font-semibold">Tip for CSVs from Spreadsheets</AlertTitle>
                <AlertDescription>
                  When exporting from Google Sheets or Excel, choose "Comma-separated values (.csv)". Ensure text fields containing commas (e.g., in Notes) are enclosed in double quotes by your spreadsheet software.
                </AlertDescription>
            </Alert>
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
