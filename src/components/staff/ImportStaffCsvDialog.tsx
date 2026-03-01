'use client';

import { useState, useTransition, ChangeEvent, DragEvent, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, AlertTriangle, Info, Loader2, FileText, CheckCircle, XCircle, ArrowRight, Briefcase, Download } from 'lucide-react';
import { addSystemItems, validateStaffImportData, getDefaultStaffStatusSetting, type StaffImportValidationResult } from '@/lib/actions';
import type { StaffMember, StaffAttendanceStatus } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// --- Types ---
type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface ParsedStaffCsvRow {
  id?: string;
  name?: string;
  role?: string;
  department?: string;
  team?: string;
  email?: string;
  phone?: string;
  contactinfo?: string;
  notes?: string;
  [key: string]: string | undefined;
}

interface ImportSummary {
  importedCount: number;
  skippedMissingFields: number;
  skippedExistingId: number;
  skippedMalformedLines: number;
  addedTeams: string[];
}

// --- Main Component ---
export function ImportStaffCsvDialog({ onImportSuccess }: { onImportSuccess?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedStaffCsvRow[]>([]);
  const [validationResult, setValidationResult] = useState<StaffImportValidationResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isProcessing, startTransition] = useTransition();
  const [isDragOver, setIsDragOver] = useState(false);
  const [addNews, setAddNews] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setValidationResult(null);
    setSummary(null);
    setAddNews(true);
    setImportProgress(0);
    setUploadProgress(0);
  };

  useEffect(() => {
    if (file) {
      startTransition(() => {
        parseAndValidateFile(file);
      });
    }
  }, [file]);

  const handleFileSelect = (selectedFile: File | null) => {
    if (isProcessing || !selectedFile) return;
    if (selectedFile.type !== 'text/csv') {
      toast({ title: 'Invalid File Type', description: 'Please upload a .csv file.', variant: 'destructive' });
      return;
    }
    setFile(selectedFile);
  };

  const parseAndValidateFile = (fileToParse: File) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setUploadProgress(progress);
      }
    };

    reader.onload = async (e) => {
      setUploadProgress(100); // Ensure it completes
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) {
        toast({ title: 'Error reading file', description: 'Could not read file content.', variant: 'destructive' });
        resetState();
        return;
      }

      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);

      const allLines = text.split(/\r\n|\n/);
      if (allLines.length < 2) {
        toast({ title: 'Invalid CSV', description: 'CSV must have a header and at least one data row.', variant: 'destructive' });
        resetState();
        return;
      }

      const headerKeys = allLines[0].split(',').map(key => key.trim().toLowerCase().replace(/\s+/g, ''));
      const requiredHeaders = ['name', 'role'];
      if (requiredHeaders.some(rh => !headerKeys.includes(rh))) {
        toast({ title: 'Missing Required Headers', description: `CSV must include: ${requiredHeaders.join(', ')}.`, variant: 'destructive', duration: 8000 });
        resetState();
        return;
      }

      const dataRows = allLines.slice(1).filter(line => line.trim() !== '');
      const parsedRows: ParsedStaffCsvRow[] = dataRows.map(line => {
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());
        const record: ParsedStaffCsvRow = {};
        headerKeys.forEach((header, i) => { record[header] = cleanedValues[i]; });
        return record;
      });

      setParsedData(parsedRows);

      try {
        const validationData = parsedRows.map(row => ({ name: row.name || '', role: row.role || '', team: row.team || '' }));
        const validation = await validateStaffImportData(validationData);
        setValidationResult(validation);
        setStep('preview');
      } catch (error: any) {
        toast({ title: 'Validation Failed', description: error.message, variant: 'destructive' });
        resetState();
      }
    };
    reader.onerror = () => {
      toast({ title: 'File Read Error', description: 'Could not read the file.', variant: 'destructive' });
      resetState();
    };
    reader.readAsArrayBuffer(fileToParse);
  };

  const handleImport = () => {
    startTransition(async () => {
      setStep('importing');
      let addedTeams: string[] = [];

      if (addNews && validationResult) {
        const itemsToAdd = {
          newSchools: [],
          newCommittees: [],
          newTeams: validationResult.detectedNewTeams,
        };
        if (itemsToAdd.newTeams.length > 0) {
          const result = await addSystemItems(itemsToAdd);
          if (result.success) {
            addedTeams = itemsToAdd.newTeams;
            toast({ title: 'System Updated', description: 'New staff teams added successfully.' });
          } else {
            toast({ title: 'System Update Failed', description: result.message, variant: 'destructive' });
            setStep('preview');
            return;
          }
        }
      }

      try {
        const defaultStatus = await getDefaultStaffStatusSetting();
        let importCount = 0;
        let skippedMissing = 0;
        let skippedExisting = 0;
        const staffToInsert: any[] = [];

        for (const [index, row] of parsedData.entries()) {
          const name = row.name?.trim();
          const role = row.role?.trim();

          if (!name || !role) {
            skippedMissing++;
            continue;
          }

          let id = row.id?.trim();
          if (id) {
            const { data: existing } = await supabase
              .from('staff_members')
              .select('id')
              .eq('id', id)
              .maybeSingle();

            if (existing) {
              skippedExisting++;
              continue;
            }
          } else {
            id = uuidv4();
          }

          staffToInsert.push({
            id,
            name, role,
            department: row.department?.trim() || '',
            team: row.team?.trim() || '',
            email: row.email?.trim() || '',
            phone: row.phone?.trim() || '',
            contact_info: (row.contactinfo || '').trim(),
            notes: row.notes?.trim() || '',
            status: defaultStatus,
            image_url: `https://placehold.co/40x40.png?text=${(name || 'S').substring(0,2).toUpperCase()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          importCount++;
          setImportProgress(((index + 1) / parsedData.length) * 100);
        }

        if (staffToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('staff_members')
            .insert(staffToInsert);

          if (insertError) throw insertError;
        }

        setSummary({ 
          importedCount: importCount, 
          skippedMissingFields: skippedMissing, 
          skippedExistingId: skippedExisting, 
          skippedMalformedLines: parsedData.filter(r => !r.name || !r.role).length - skippedMissing, // Approximation
          addedTeams,
        });
        setStep('complete');
        onImportSuccess?.();
      } catch (error: any) {
        toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
        resetState();
      }
    });
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <Label htmlFor="csv-upload-staff"
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent/50 transition-colors ${isDragOver ? 'border-primary' : 'border-border'}`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
          <p className="mb-2 text-sm font-semibold text-primary">Click to upload or drag and drop</p>
          <p className="text-xs text-muted-foreground">CSV (up to 5MB)</p>
        </div>
        <Input id="csv-upload-staff" type="file" accept=".csv" className="sr-only" onChange={e => handleFileSelect(e.target.files ? e.target.files[0] : null)} disabled={isProcessing} />
        {file && isProcessing && (
          <div className="absolute bottom-4 left-4 right-4 px-2">
            <Progress value={uploadProgress} className="w-full h-2" />
            <p className="text-xs text-muted-foreground mt-1 text-center">Uploading... {Math.round(uploadProgress)}%</p>
          </div>
        )}
      </Label>
      
      <div className="p-4 border rounded-lg bg-secondary/30">
        <div className="flex items-start">
          <Info className="h-5 w-5 mr-3 mt-1 text-muted-foreground flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-base">CSV Format Guide</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Ensure your CSV file has the headers: <code className="text-xs font-mono p-1 rounded-sm bg-background">name</code> and <code className="text-xs font-mono p-1 rounded-sm bg-background">role</code>.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Optional headers include: <code className="text-xs font-mono p-1 rounded-sm bg-background">department</code>, <code className="text-xs font-mono p-1 rounded-sm bg-background">team</code>, <code className="text-xs font-mono p-1 rounded-sm bg-background">email</code>, etc.
            </p>
            <Button asChild variant="link" className="p-0 h-auto mt-3 text-sm">
              <a href="/staff_template.csv" download>
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div>
      <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg mb-4">
        <FileText className="w-10 h-10 text-primary" />
        <div>
          <h4 className="font-semibold">{file?.name}</h4>
          <p className="text-sm text-muted-foreground">{parsedData.length} records found. Ready for import.</p>
        </div>
      </div>

      {validationResult && validationResult.detectedNewTeams.length > 0 && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>New Staff Teams Detected!</AlertTitle>
          <AlertDescription>
            <p>Your CSV contains teams that are not in the system yet.</p>
            <p className="mt-2"><strong>New Teams:</strong> {validationResult.detectedNewTeams.join(', ')}</p>
            <div className="flex items-center space-x-2 mt-4">
              <Checkbox id="add-new-items-staff" checked={addNews} onCheckedChange={c => setAddNews(Boolean(c.valueOf()))} />
              <Label htmlFor="add-new-items-staff" className="text-sm font-medium leading-none">Create these new teams during import</Label>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <h5 className="font-semibold mb-2">Data Preview (First 5 Rows)</h5>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedData.slice(0, 5).map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.team}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="flex flex-col items-center justify-center p-12">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
      <h3 className="text-lg font-semibold">Importing Staff...</h3>
      <p className="text-sm text-muted-foreground mt-1">Please wait while we add the records.</p>
      <Progress value={importProgress} className="w-full mt-4" />
      <p className="text-xs text-muted-foreground mt-2">{Math.round(importProgress)}%</p>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
      <h3 className="text-xl font-semibold">Import Complete</h3>
      {summary && (
        <div className="text-sm text-muted-foreground mt-4 space-y-2">
          <p className="text-base">Successfully imported <strong className="text-foreground">{summary.importedCount}</strong> of <strong className="text-foreground">{parsedData.length}</strong> staff members.</p>
          <Separator className="my-2" />
          <div className="flex justify-center gap-4 text-xs">
            {summary.addedTeams.length > 0 && <p><Briefcase className="inline mr-1 h-4 w-4"/>{summary.addedTeams.length} new teams added.</p>}
          </div>
          {(summary.skippedMissingFields > 0 || summary.skippedExistingId > 0) && (
             <p className="text-amber-600">Skipped <strong className="text-amber-700">{summary.skippedMissingFields + summary.skippedExistingId}</strong> records (missing fields or existing ID).</p>
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'upload': return renderUploadStep();
      case 'preview': return renderPreviewStep();
      case 'importing': return renderImportingStep();
      case 'complete': return renderCompleteStep();
      default: return renderUploadStep();
    }
  };

  const renderFooter = () => {
    switch (step) {
      case 'upload':
        return <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>;
      case 'preview':
        return (
          <>
            <Button type="button" variant="outline" onClick={resetState} disabled={isProcessing}>Back</Button>
            <Button onClick={handleImport} disabled={isProcessing}> 
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><CheckCircle className="mr-2 h-4 w-4"/>Confirm & Import</>}
            </Button>
          </>
        );
      case 'complete':
        return <Button type="button" onClick={() => setIsOpen(false)}>Done</Button>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { resetState(); } setIsOpen(open); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" />Import Staff CSV</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' && 'Import Staff Members'}
            {step === 'preview' && 'Preview & Confirm Import'}
            {step === 'importing' && 'Import in Progress'}
            {step === 'complete' && 'Import Successful'}
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
        <DialogFooter className="mt-4">
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}