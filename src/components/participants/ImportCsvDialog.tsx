
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
import { UploadCloud } from 'lucide-react';
import { importParticipants } from '@/lib/actions';
import type { Participant } from '@/types';

interface ImportCsvDialogProps {
  onImportSuccess?: () => void; // Callback to refresh data on parent page
}

export function ImportCsvDialog({ onImportSuccess }: ImportCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a CSV file to import.', variant: 'destructive' });
      return;
    }

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
        
        lines.forEach(line => {
          if (line.trim() === '') return; // Skip empty lines
          
          // Basic CSV parsing: assumes Name,School,Committee columns in order
          // This regex handles commas within quoted fields:
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim()); // Remove quotes and trim

          if (cleanedValues.length >= 3 && cleanedValues[0] && cleanedValues[1] && cleanedValues[2]) {
            parsedParticipants.push({
              name: cleanedValues[0],
              school: cleanedValues[1],
              committee: cleanedValues[2],
            });
          }
        });

        if (parsedParticipants.length === 0) {
          toast({ title: 'No valid data found', description: 'The CSV file might be empty or incorrectly formatted. Expected: Name,School,Committee', variant: 'default' });
          return;
        }

        try {
          const result = await importParticipants(parsedParticipants);
          let description = `${result.count} participants processed.`;
          if (result.newSchools > 0) description += ` ${result.newSchools} new schools added.`;
          if (result.newCommittees > 0) description += ` ${result.newCommittees} new committees added.`;
          if (result.errors > 0) description += ` ${result.errors} participants failed to import. Check console.`;

          toast({ 
            title: result.errors > 0 ? 'Import Partially Successful' : 'Import Successful', 
            description: description,
            variant: result.errors > 0 ? 'default' : 'default' // Success can also be default
          });

          setIsOpen(false);
          setFile(null);
          onImportSuccess?.();
        } catch (error: any) {
          console.error("Import error:", error);
          toast({ title: 'Import Failed', description: error.message || 'An error occurred. Check console.', variant: 'destructive' });
        }
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', description: 'Could not read file content.', variant: 'destructive' });
      }
      reader.readAsText(file);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if(!open) setFile(null); // Reset file on close
      setIsOpen(open)
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadCloud className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Participants from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with participant data. Columns must be: Name, School, Committee.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">CSV File (.csv)</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={isPending} />
          </div>
          {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
             <Button type="button" variant="outline" disabled={isPending}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={isPending || !file}>
            {isPending ? 'Importing...' : 'Import Participants'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

