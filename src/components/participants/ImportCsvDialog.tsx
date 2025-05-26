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

export function ImportCsvDialog() {
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
        // Basic CSV parsing: assumes Name,School,Committee columns in order
        // A more robust solution would use a library like PapaParse
        const lines = text.split('\n').slice(1); // Skip header
        const parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[] = [];
        lines.forEach(line => {
          const values = line.split(',');
          if (values.length >= 3 && values[0]?.trim() && values[1]?.trim() && values[2]?.trim()) {
            parsedParticipants.push({
              name: values[0].trim(),
              school: values[1].trim(),
              committee: values[2].trim(),
            });
          }
        });

        if (parsedParticipants.length === 0) {
          toast({ title: 'No valid data found', description: 'The CSV file might be empty or incorrectly formatted.', variant: 'destructive' });
          return;
        }

        try {
          const result = await importParticipants(parsedParticipants);
          toast({ title: 'Import Successful', description: `${result.count} participants imported.` });
          setIsOpen(false);
          setFile(null);
        } catch (error) {
          toast({ title: 'Import Failed', description: 'An error occurred while importing participants.', variant: 'destructive' });
        }
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', description: 'Could not read file content.', variant: 'destructive' });
      }
      reader.readAsText(file);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            Upload a CSV file with participant data. Ensure columns are: Name, School, Committee.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} />
          </div>
          {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
             <Button type="button" variant="outline" disabled={isPending}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={isPending || !file}>
            {isPending ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
