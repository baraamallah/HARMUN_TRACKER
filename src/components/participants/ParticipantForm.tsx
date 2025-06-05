
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
import { collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

const participantFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  school: z.string().min(1, 'School is required.'),
  committee: z.string().min(1, 'Committee is required.'),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters.').optional().default(''),
  additionalDetails: z.string().max(1000, 'Details must be at most 1000 characters.').optional().default(''),
  birthday: z.date().optional().nullable(), // Use z.date() for react-day-picker
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
      birthday: null,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (participantToEdit) {
        let parsedBirthday = null;
        if (participantToEdit.birthday) {
            const dateCandidate = parseISO(participantToEdit.birthday);
            if(isValid(dateCandidate)) {
                parsedBirthday = dateCandidate;
            }
        }
        form.reset({
          name: participantToEdit.name,
          school: participantToEdit.school,
          committee: participantToEdit.committee,
          notes: participantToEdit.notes || '',
          additionalDetails: participantToEdit.additionalDetails || '',
          birthday: parsedBirthday,
        });
      } else {
        form.reset({
          name: '',
          school: schools.length > 0 ? schools[0] : '',
          committee: committees.length > 0 ? committees[0] : '',
          notes: '',
          additionalDetails: '',
          birthday: null,
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
          birthday: data.birthday ? format(data.birthday, 'yyyy-MM-dd') : null,
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
    // This specific reset call inside handleDialogClose might not be strictly necessary
    // if onOpenChange(false) triggers the useEffect which already has reset logic.
    // However, explicit reset on cancel is harmless.
    form.reset({ 
        name: '', 
        school: schools.length > 0 ? schools[0] : '', 
        committee: committees.length > 0 ? committees[0] : '',
        notes: '',
        additionalDetails: '',
        birthday: null,
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-notes">Notes</FormLabel>
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
                  <FormLabel htmlFor="form-additionalDetails">Additional Details</FormLabel>
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
            <FormField
              control={form.control}
              name="birthday"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel htmlFor="form-birthday">Birthday (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          id="form-birthday"
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isPending}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(date) => field.onChange(date ?? null)}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
