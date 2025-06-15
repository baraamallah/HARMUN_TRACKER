
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
import { UploadCloud, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { validateParticipantImportData, getDefaultAttendanceStatusSetting, getSystemSchools, getSystemCommittees, type ParticipantImportValidationResult } from '@/lib/actions';
import type { Participant, AttendanceStatus } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { db } from '@/lib/firebase';
import { collection as fsCollection, doc as fsDoc, writeBatch, serverTimestamp } from 'firebase/firestore'; // Renamed to avoid conflict
import { v4 as uuidv4 } from 'uuid';

interface ImportCsvDialogProps {
  onImportSuccess?: () => void; // Callback to refresh data on parent page
}

// Define the expected structure for CSV parsing
const participantCsvSchema: {
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
            setFile(null);
            return;
        }
        
        const allLines = text.split(/\r\n|\n/);
        const headerLine = allLines[0];
        const dataLines = allLines.slice(1); 
        
        const parsedCsvParticipants: typeof participantCsvSchema = [];
        let skippedLineCount = 0;
        
        dataLines.forEach((line, index) => {
          if (line.trim() === '') return;
          
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());

          if (cleanedValues.length >= 3 && cleanedValues[0] && cleanedValues[1] && cleanedValues[2]) {
            parsedCsvParticipants.push({
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
            console.warn(`Skipping malformed CSV line ${index + 2} for participant: "${line}" (Expected at least Name,School,Committee). Header was: "${headerLine}"`);
            skippedLineCount++;
          }
        });
        
        console.log('Parsed participant CSV data (client-side):', parsedCsvParticipants);

        if (parsedCsvParticipants.length === 0) {
          let description = "The CSV file might be empty or all lines were incorrectly formatted.";
          if (skippedLineCount > 0) {
            description += ` ${skippedLineCount} line(s) were skipped. Header: "${headerLine}". Required: Name, School, Committee.`;
          }
          toast({ 
            title: 'No Valid Data Found', 
            description: description,
            variant: 'default',
            duration: 10000,
          });
          return;
        }

        try {
          // Step 1: Validate data and get lists of new schools/committees from server action
          const validationResult: ParticipantImportValidationResult = await validateParticipantImportData(parsedCsvParticipants);

          if (validationResult.message) { // If validation itself had an error (e.g., fetching system lists)
            toast({ title: 'Import Pre-check Failed', description: validationResult.message, variant: 'destructive', duration: 7000 });
            return;
          }

          setImportSummary({
            detectedNewSchools: validationResult.detectedNewSchools,
            detectedNewCommittees: validationResult.detectedNewCommittees,
          });
          
          // Step 2: Prepare batch write on the client
          const defaultStatus = await getDefaultAttendanceStatusSetting();
          const batch = writeBatch(db);
          let participantsToImportCount = 0;

          parsedCsvParticipants.forEach(data => {
            const nameInitial = (data.name.trim() || 'P').substring(0,2).toUpperCase();
            const newParticipantData: Omit<Participant, 'id'> = {
              name: data.name.trim(),
              school: data.school.trim(),
              committee: data.committee.trim(),
              country: data.country?.trim() || '',
              classGrade: data.classGrade?.trim() || '',
              email: data.email?.trim() || '',
              phone: data.phone?.trim() || '',
              notes: data.notes?.trim() || '',
              additionalDetails: data.additionalDetails?.trim() || '',
              status: defaultStatus,
              imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
              attended: false,
              checkInTime: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            const participantRef = fsDoc(fsCollection(db, 'participants'), uuidv4()); // Generate client-side UUID
            batch.set(participantRef, newParticipantData);
            participantsToImportCount++;
          });

          // Step 3: Commit batch write
          if (participantsToImportCount > 0) {
            await batch.commit();
            toast({ 
              title: 'Import Successful',
              description: `${participantsToImportCount} participants imported. ${skippedLineCount > 0 ? `${skippedLineCount} CSV lines skipped.` : ''}`,
              variant: 'default',
              duration: (validationResult.detectedNewSchools.length > 0 || validationResult.detectedNewCommittees.length > 0) ? 10000 : 5000,
            });
            onImportSuccess?.();
             // Close dialog only if there are no new schools/committees to show in summary
            if (!(validationResult.detectedNewSchools.length > 0 || validationResult.detectedNewCommittees.length > 0)) {
              setIsOpen(false); 
              setFile(null);
            }
          } else if (skippedLineCount > 0) {
             toast({ 
              title: 'Import Note',
              description: `No new participants were imported. ${skippedLineCount} CSV lines were skipped.`,
              variant: 'default',
              duration: 7000,
            });
          } else {
            toast({ 
              title: 'Import Note',
              description: `No participants to import.`,
              variant: 'default',
            });
          }

        } catch (error: any) {
          console.error("Client-side Import error:", error);
          let errorMessage = "An unexpected error occurred during client-side import.";
          if (error.code === 'permission-denied') {
            errorMessage = "Permission Denied: Your account does not have permission to add participants. Please contact the owner.";
          } else if (error.message) {
            errorMessage = error.message;
          }
          toast({ 
            title: 'Import Failed', 
            description: errorMessage,
            variant: 'destructive',
            duration: 10000 
          });
        }
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', description: 'Could not read the selected file. It might be corrupted or inaccessible.', variant: 'destructive' });
        console.error("FileReader error:", reader.error);
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
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Participants from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file. Required columns: Name, School, Committee.
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-sm text-muted-foreground space-y-2 py-3 border-y my-4">
            <div>Upload a CSV file with participant data. The first row should be headers (they will be skipped).</div>
            <div><strong className="text-foreground">Required Columns:</strong> Name, School, Committee.</div>
            <div><strong className="text-foreground">Column Order (Recommended):</strong></div>
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
            <div className="mt-2">
              <strong className="text-amber-600 dark:text-amber-400">Important:</strong> Schools and committees listed in the CSV must already exist in the system. New schools or committees will <strong className="underline">not</strong> be automatically created by this import. Please add them via the Superior Admin panel first. The import will notify you of any new schools/committees found.
            </div>
             <Alert variant="default" className="mt-3 bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                <Info className="h-5 w-5" />
                <AlertTitle className="font-semibold">Tip for CSVs from Spreadsheets</AlertTitle>
                <AlertDescription>
                  When exporting from Google Sheets or Excel, choose "Comma-separated values (.csv)". Ensure text fields containing commas (e.g., in Notes) are enclosed in double quotes by your spreadsheet software.
                </AlertDescription>
            </Alert>
        </div>


        <div className="grid gap-4 pt-2 pb-4">
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
          {!importSummary && ( // Only show import button if no summary is active
            <Button onClick={handleImport} disabled={isPending || !file}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : 'Import Participants'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
