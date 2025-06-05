
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { Participant } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useTransition } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const participantFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  school: z.string().min(1, 'School is required.'),
  committee: z.string().min(1, 'Committee is required.'),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters.').optional().default(''),
  additionalDetails: z.string().max(1000, 'Details must be at most 1000 characters.').optional().default(''),
  classGrade: z.string().max(50, 'Class/Grade must be at most 50 characters.').optional().default(''), // Changed from birthday
});

type ParticipantFormData = z.infer<typeof participantFormSchema>;

interface ParticipantFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  participantToEdit?: Participant | null;
  schools: string[];
  committees: string[];
  onFormSubmitSuccess?: () => void;
}

export function ParticipantForm({
  isOpen,
  onOpenChange,
  participantToEdit,
  schools,
  committees,
  onFormSubmitSuccess,
}: ParticipantFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ParticipantFormData>({
    resolver: zodResolver(participantFormSchema),
    defaultValues: {
      name: '',
      school: '',
      committee: '',
      notes: '',
      additionalDetails: '',
      classGrade: '', // Changed from birthday
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (participantToEdit) {
        form.reset({
          name: participantToEdit.name,
          school: participantToEdit.school,
          committee: participantToEdit.committee,
          notes: participantToEdit.notes || '',
          additionalDetails: participantToEdit.additionalDetails || '',
          classGrade: participantToEdit.classGrade || '', // Changed from birthday
        });
      } else {
        form.reset({
          name: '',
          school: schools.length > 0 ? schools[0] : '',
          committee: committees.length > 0 ? committees[0] : '',
          notes: '',
          additionalDetails: '',
          classGrade: '', // Changed from birthday
        });
      }
    }
  }, [participantToEdit, form, isOpen, schools, committees]);

  const onSubmit = (data: ParticipantFormData) => {
    startTransition(async () => {
      try {
        const submissionData: any = {
          name: data.name.trim(),
          school: data.school.trim(),
          committee: data.committee.trim(),
          notes: data.notes?.trim() || '',
          additionalDetails: data.additionalDetails?.trim() || '',
          classGrade: data.classGrade?.trim() || '', // Changed from birthday
          updatedAt: serverTimestamp(),
        };

        if (participantToEdit) {
          const participantRef = doc(db, 'participants', participantToEdit.id);
          await updateDoc(participantRef, submissionData);
          toast({ title: 'Participant Updated', description: `${data.name} has been updated.` });
        } else {
          const nameInitial = (data.name.trim() || 'P').substring(0, 2).toUpperCase();
          const newParticipantData = {
            ...submissionData,
            status: 'Absent' as const, 
            imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
            createdAt: serverTimestamp(),
          };
          await addDoc(collection(db, 'participants'), newParticipantData);
          toast({ title: 'Participant Added', description: `${data.name} has been added.` });
        }
        onOpenChange(false);
        onFormSubmitSuccess?.();
      } catch (error: any) {
        console.error("Error in ParticipantForm onSubmit:", error);
        toast({
          title: 'Error',
          description: error.message || `Failed to ${participantToEdit ? 'update' : 'add'} participant. Check console for details.`,
          variant: 'destructive',
        });
      }
    });
  };
  
  const handleDialogClose = () => {
    form.reset({ 
        name: '', 
        school: schools.length > 0 ? schools[0] : '', 
        committee: committees.length > 0 ? committees[0] : '',
        notes: '',
        additionalDetails: '',
        classGrade: '', // Changed from birthday
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleDialogClose();
      } else {
        onOpenChange(open);
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{participantToEdit ? 'Edit Participant' : 'Add New Participant'}</DialogTitle>
          <DialogDescription>
            {participantToEdit ? 'Update the details of the participant.' : 'Enter the details for the new participant.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-name">Full Name</FormLabel>
                  <FormControl>
                    <Input id="form-name" placeholder="e.g., Jane Doe" {...field} disabled={isPending} aria-required="true" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="school"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-school">School</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger id="form-school" aria-required="true">
                        <SelectValue placeholder="Select a school" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school} value={school}>
                          {school}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="committee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-committee">Committee</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger id="form-committee" aria-required="true">
                        <SelectValue placeholder="Select a committee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {committees.map((committee) => (
                        <SelectItem key={committee} value={committee}>
                          {committee}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="classGrade" // New field
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-classGrade">Class/Grade (Optional)</FormLabel>
                  <FormControl>
                    <Input id="form-classGrade" placeholder="e.g., 10th Grade, Year 12" {...field} value={field.value ?? ''} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-notes">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      id="form-notes"
                      placeholder="Any relevant notes about the participant..."
                      {...field}
                      value={field.value ?? ''}
                      disabled={isPending}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="additionalDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-additionalDetails">Additional Details (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      id="form-additionalDetails"
                      placeholder="Other important information..."
                      {...field}
                      value={field.value ?? ''}
                      disabled={isPending}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending} onClick={handleDialogClose}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || (!form.formState.isDirty && !!participantToEdit)}>
                {isPending ? (participantToEdit ? 'Saving...' : 'Adding...') : (participantToEdit ? 'Save Changes' : 'Add Participant')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
