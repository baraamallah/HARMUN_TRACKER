
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addParticipant, updateParticipant } from '@/lib/actions';
import { useEffect, useTransition } from 'react';

const participantFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  school: z.string().min(1, 'School is required.'),
  committee: z.string().min(1, 'Committee is required.'),
});

type ParticipantFormData = z.infer<typeof participantFormSchema>;

interface ParticipantFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  participantToEdit?: Participant | null;
  schools: string[]; // These are now system-managed schools
  committees: string[]; // These are now system-managed committees
  onFormSubmitSuccess?: () => void; // Callback to refresh data on parent page
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
    },
  });

  useEffect(() => {
    if (isOpen) { // Only reset/populate form when dialog opens
      if (participantToEdit) {
        form.reset({
          name: participantToEdit.name,
          school: participantToEdit.school,
          committee: participantToEdit.committee,
        });
      } else {
        form.reset({ 
            name: '', 
            school: schools.length > 0 ? schools[0] : '', // Pre-select if available
            committee: committees.length > 0 ? committees[0] : '' // Pre-select if available
        });
      }
    }
  }, [participantToEdit, form, isOpen, schools, committees]);

  const onSubmit = (data: ParticipantFormData) => {
    startTransition(async () => {
      try {
        if (participantToEdit) {
          await updateParticipant(participantToEdit.id, data);
          toast({ title: 'Participant Updated', description: `${data.name} has been updated.` });
        } else {
          await addParticipant(data);
          toast({ title: 'Participant Added', description: `${data.name} has been added.` });
        }
        onOpenChange(false);
        form.reset();
        onFormSubmitSuccess?.(); // Call the success callback
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || `Failed to ${participantToEdit ? 'update' : 'add'} participant.`,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) form.reset({ name: '', school: '', committee: '' }); 
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{participantToEdit ? 'Edit Participant' : 'Add New Participant'}</DialogTitle>
          <DialogDescription>
            {participantToEdit ? 'Update the details of the participant.' : 'Enter the details for the new participant.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} disabled={isPending} />
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
                  <FormLabel>School</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    defaultValue={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a school" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Removed: schools.length === 0 && <SelectItem value="" disabled>No schools available</SelectItem> */}
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
                  <FormLabel>Committee</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    defaultValue={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a committee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Removed: committees.length === 0 && <SelectItem value="" disabled>No committees available</SelectItem> */}
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
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || !form.formState.isDirty && !!participantToEdit}>
                {isPending ? (participantToEdit ? 'Saving...' : 'Adding...') : (participantToEdit ? 'Save Changes' : 'Add Participant')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
