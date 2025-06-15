
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
import { validateParticipantImportData, getDefaultAttendanceStatusSetting, type ParticipantImportValidationResult } from '@/lib/actions';
import type { Participant } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { db } from '@/lib/firebase';
import { collection as fsCollection, doc as fsDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

interface ImportCsvDialogProps {
  onImportSuccess?: () => void;
}

// Define the expected structure for CSV parsing (headers will be keys)
interface ParsedParticipantCsvRow {
  id?: string;
  name?: string;
  school?: string;
  committee?: string;
  country?: string;
  classgrade?: string; // common alternative for class/grade
  class?: string; // common alternative
  grade?: string; // common alternative
  email?: string;
  phone?: string;
  notes?: string;
  additionaldetails?: string; // common alternative for additional details
  [key: string]: string | undefined; // Allow other columns
}


export function ImportCsvDialog({ onImportSuccess }: ImportCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [importSummary, setImportSummary] = useState<{
    detectedNewSchools: string[];
    detectedNewCommittees: string[];
    importedCount: number;
    skippedMissingFields: number;
    skippedExistingId: number;
    skippedMalformedLines: number;
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
        if (allLines.length < 2) {
          toast({ title: 'Invalid CSV', description: 'CSV file must contain a header row and at least one data row.', variant: 'destructive' });
          return;
        }

        const headerLine = allLines[0];
        const dataLines = allLines.slice(1);
        
        const headerKeys = headerLine.split(',').map(key => key.trim().toLowerCase().replace(/\s+/g, '')); // normalize headers

        const requiredHeaders = ['name', 'school', 'committee'];
        const missingRequiredHeaders = requiredHeaders.filter(rh => !headerKeys.includes(rh));
        if (missingRequiredHeaders.length > 0) {
          toast({
            title: 'Missing Required CSV Headers',
            description: `The CSV file is missing the following required headers: ${missingRequiredHeaders.join(', ')}. Please ensure your CSV has headers: Name, School, Committee. "ID" is optional.`,
            variant: 'destructive',
            duration: 10000,
          });
          return;
        }
        
        const parsedCsvRows: ParsedParticipantCsvRow[] = [];
        let localSkippedMalformedLines = 0;
        
        dataLines.forEach((line, index) => {
          if (line.trim() === '') return;
          
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());

          if (cleanedValues.length === headerKeys.length) {
            const record: ParsedParticipantCsvRow = {};
            headerKeys.forEach((header, i) => {
              record[header] = cleanedValues[i];
            });
            parsedCsvRows.push(record);
          } else if (line.trim()) {
            console.warn(`Skipping malformed CSV line ${index + 2}: "${line}" (Expected ${headerKeys.length} columns based on header, found ${cleanedValues.length}). Header was: "${headerLine}"`);
            localSkippedMalformedLines++;
          }
        });
        
        console.log('Parsed participant CSV rows (client-side):', parsedCsvRows);

        if (parsedCsvRows.length === 0 && localSkippedMalformedLines > 0) {
          toast({ 
            title: 'No Valid Data Rows Found', 
            description: `All ${localSkippedMalformedLines} data line(s) were malformed or did not match header column count. Please check CSV format. Header: ${headerLine}`,
            variant: 'default',
            duration: 10000,
          });
          return;
        }
        if (parsedCsvRows.length === 0) {
           toast({ 
            title: 'No Data Rows Found', 
            description: `The CSV file does not contain any data rows after the header.`,
            variant: 'default',
          });
          return;
        }


        try {
          const participantsToValidate = parsedCsvRows.map(row => ({
            name: row.name || '',
            school: row.school || '',
            committee: row.committee || '',
          }));

          const validationResult: ParticipantImportValidationResult = await validateParticipantImportData(participantsToValidate);

          if (validationResult.message) {
            toast({ title: 'Import Pre-check Failed', description: validationResult.message, variant: 'destructive', duration: 7000 });
            return;
          }
          
          const defaultStatus = await getDefaultAttendanceStatusSetting();
          const batch = writeBatch(db);
          let participantsToImportCount = 0;
          let localSkippedMissingFields = 0;
          let localSkippedExistingId = 0;

          for (const row of parsedCsvRows) {
            const name = row.name?.trim();
            const school = row.school?.trim();
            const committee = row.committee?.trim();

            if (!name || !school || !committee) {
              localSkippedMissingFields++;
              console.warn('Skipping row due to missing required fields (Name, School, Committee):', row);
              continue;
            }

            let participantIdToUse = row.id?.trim();
            if (participantIdToUse) {
              const existingDocRef = fsDoc(db, 'participants', participantIdToUse);
              const existingDocSnap = await getDoc(existingDocRef);
              if (existingDocSnap.exists()) {
                localSkippedExistingId++;
                console.warn(`Skipping row: Participant with provided ID "${participantIdToUse}" already exists. Name in CSV: ${name}`);
                continue;
              }
            } else {
              participantIdToUse = uuidv4();
            }
            
            const nameInitial = (name || 'P').substring(0,2).toUpperCase();
            const classGradeValue = row.classgrade || row.class || row.grade || '';
            const additionalDetailsValue = row.additionaldetails || '';

            const newParticipantData: Omit<Participant, 'id'> = {
              name: name,
              school: school,
              committee: committee,
              country: row.country?.trim() || '',
              classGrade: classGradeValue.trim(),
              email: row.email?.trim() || '',
              phone: row.phone?.trim() || '',
              notes: row.notes?.trim() || '',
              additionalDetails: additionalDetailsValue.trim(),
              status: defaultStatus,
              imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
              attended: false,
              checkInTime: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            const participantRef = fsDoc(fsCollection(db, 'participants'), participantIdToUse);
            batch.set(participantRef, newParticipantData);
            participantsToImportCount++;
          }

          if (participantsToImportCount > 0) {
            await batch.commit();
          }
          
          setImportSummary({
            detectedNewSchools: validationResult.detectedNewSchools,
            detectedNewCommittees: validationResult.detectedNewCommittees,
            importedCount: participantsToImportCount,
            skippedMissingFields: localSkippedMissingFields,
            skippedExistingId: localSkippedExistingId,
            skippedMalformedLines: localSkippedMalformedLines
          });

          let summaryMessage = `${participantsToImportCount} participant(s) imported.`;
          if (localSkippedMissingFields > 0) summaryMessage += ` ${localSkippedMissingFields} skipped (missing required fields).`;
          if (localSkippedExistingId > 0) summaryMessage += ` ${localSkippedExistingId} skipped (ID already exists).`;
          if (localSkippedMalformedLines > 0) summaryMessage += ` ${localSkippedMalformedLines} malformed CSV lines skipped.`;

          toast({ 
            title: 'Import Process Completed',
            description: summaryMessage,
            variant: (localSkippedMissingFields > 0 || localSkippedExistingId > 0 || localSkippedMalformedLines > 0 || validationResult.detectedNewSchools.length > 0 || validationResult.detectedNewCommittees.length > 0) ? 'default' : 'default', // 'default' for success, consider 'warning' variant if it exists
            duration: 10000,
          });

          if (participantsToImportCount > 0) {
            onImportSuccess?.();
          }
          // Keep dialog open if there's a summary to show, otherwise close
          if (!(validationResult.detectedNewSchools.length > 0 || validationResult.detectedNewCommittees.length > 0 || localSkippedMissingFields > 0 || localSkippedExistingId > 0 || localSkippedMalformedLines > 0 )) {
            setIsOpen(false); 
            setFile(null);
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
           setImportSummary({ // Show error in summary structure if possible
            detectedNewSchools: [],
            detectedNewCommittees: [],
            importedCount: 0,
            skippedMissingFields: 0,
            skippedExistingId: 0,
            skippedMalformedLines: parsedCsvRows.length + localSkippedMalformedLines, // Assume all failed if error here
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
            Upload a CSV file. The first row MUST be headers.
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-sm text-muted-foreground space-y-2 py-3 border-y my-4">
            <div><strong className="text-foreground">CSV Requirements:</strong></div>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>The first row of your CSV file MUST be a header row.</li>
              <li><strong className="text-foreground">Required Headers:</strong> `Name`, `School`, `Committee` (case-insensitive).</li>
              <li><strong className="text-foreground">Optional ID Header:</strong> You can include an `ID` header (case-insensitive). If provided and unique, this ID will be used. Otherwise, a new ID is auto-generated.</li>
              <li><strong className="text-foreground">Other Optional Headers (case-insensitive, spaces removed for matching):</strong> `Country`, `ClassGrade` (or `Class` or `Grade`), `Email`, `Phone`, `Notes`, `AdditionalDetails`.</li>
              <li>Example minimal header: `Name,School,Committee`</li>
              <li>Example with ID and more: `ID,Name,School,Committee,Country,Email`</li>
            </ul>
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

        {importSummary && (
          <Alert variant={importSummary.importedCount > 0 && importSummary.skippedMissingFields === 0 && importSummary.skippedExistingId === 0 && importSummary.skippedMalformedLines === 0 && importSummary.detectedNewSchools.length === 0 && importSummary.detectedNewCommittees.length === 0 ? "default" : "default"} 
                 className={importSummary.importedCount > 0 && importSummary.skippedMissingFields === 0 && importSummary.skippedExistingId === 0 && importSummary.skippedMalformedLines === 0 && importSummary.detectedNewSchools.length === 0 && importSummary.detectedNewCommittees.length === 0 ? "bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-700" : "bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700"}>
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle className="font-semibold">Import Summary</AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              <p>Successfully imported: {importSummary.importedCount} participant(s).</p>
              {importSummary.skippedMissingFields > 0 && <p>Skipped (missing Name/School/Committee): {importSummary.skippedMissingFields}.</p>}
              {importSummary.skippedExistingId > 0 && <p>Skipped (ID already exists): {importSummary.skippedExistingId}.</p>}
              {importSummary.skippedMalformedLines > 0 && <p>Skipped (malformed CSV lines): {importSummary.skippedMalformedLines}.</p>}
              {importSummary.detectedNewSchools.length > 0 && (
                <div>
                  <strong>New Schools Detected (not added):</strong>
                  <ul className="list-disc list-inside pl-4">
                    {importSummary.detectedNewSchools.map(s => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              )}
              {importSummary.detectedNewCommittees.length > 0 && (
                <div>
                  <strong>New Committees Detected (not added):</strong>
                  <ul className="list-disc list-inside pl-4">
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
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing CSV...</> : 'Import Participants'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

