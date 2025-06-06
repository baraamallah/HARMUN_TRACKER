
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { StaffMember } from '@/types';
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
} from '@/components/ui/select'; // Added Select
import { useToast } from '@/hooks/use-toast';
import { useEffect, useTransition } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const staffMemberFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  role: z.string().min(2, 'Role is required.').max(50, 'Role must be at most 50 characters.'),
  department: z.string().max(50, 'Department must be at most 50 characters.').optional().default(''),
  team: z.string().optional().default(''), // New field for team
  contactInfo: z.string().max(100, 'Contact info must be at most 100 characters.').optional().default(''),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters.').optional().default(''),
});

type StaffMemberFormData = z.infer<typeof staffMemberFormSchema>;

interface StaffMemberFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  staffMemberToEdit?: StaffMember | null;
  onFormSubmitSuccess?: () => void;
  staffTeams?: string[]; // Prop to pass available staff teams
}

export function StaffMemberForm({
  isOpen,
  onOpenChange,
  staffMemberToEdit,
  onFormSubmitSuccess,
  staffTeams = [], // Default to empty array
}: StaffMemberFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<StaffMemberFormData>({
    resolver: zodResolver(staffMemberFormSchema),
    defaultValues: {
      name: '',
      role: '',
      department: '',
      team: '', // Default for team
      contactInfo: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (staffMemberToEdit) {
        form.reset({
          name: staffMemberToEdit.name,
          role: staffMemberToEdit.role,
          department: staffMemberToEdit.department || '',
          team: staffMemberToEdit.team || '', // Set team if editing
          contactInfo: staffMemberToEdit.contactInfo || '',
          notes: staffMemberToEdit.notes || '',
        });
      } else {
        form.reset({
          name: '',
          role: '',
          department: '',
          team: staffTeams.length > 0 ? '' : '', // Default team selection (can be empty for no default)
          contactInfo: '',
          notes: '',
        });
      }
    }
  }, [staffMemberToEdit, form, isOpen, staffTeams]);

  const onSubmit = (data: StaffMemberFormData) => {
    startTransition(async () => {
      try {
        const submissionData: any = {
          name: data.name.trim(),
          role: data.role.trim(),
          department: data.department?.trim() || '',
          team: data.team?.trim() || '', // Save team
          contactInfo: data.contactInfo?.trim() || '',
          notes: data.notes?.trim() || '',
          updatedAt: serverTimestamp(),
        };

        if (staffMemberToEdit) {
          const staffMemberRef = doc(db, 'staff_members', staffMemberToEdit.id);
          await updateDoc(staffMemberRef, submissionData);
          toast({ title: 'Staff Member Updated', description: `${data.name} has been updated.` });
        } else {
          const nameInitial = (data.name.trim() || 'S').substring(0, 2).toUpperCase();
          const newStaffMemberData = {
            ...submissionData,
            status: 'Off Duty' as const,
            imageUrl: `https://placehold.co/40x40.png?text=${nameInitial}`,
            createdAt: serverTimestamp(),
          };
          await addDoc(collection(db, 'staff_members'), newStaffMemberData);
          toast({ title: 'Staff Member Added', description: `${data.name} has been added.` });
        }
        onOpenChange(false);
        onFormSubmitSuccess?.();
      } catch (error: any) {
        console.error("Error in StaffMemberForm onSubmit:", error);
        toast({
          title: 'Error',
          description: error.message || `Failed to ${staffMemberToEdit ? 'update' : 'add'} staff member.`,
          variant: 'destructive',
        });
      }
    });
  };

  const handleDialogClose = () => {
    form.reset({ name: '', role: '', department: '', team: '', contactInfo: '', notes: '' });
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
          <DialogTitle>{staffMemberToEdit ? 'Edit Staff Member' : 'Add New Staff Member'}</DialogTitle>
          <DialogDescription>
            {staffMemberToEdit ? 'Update the details of the staff member.' : 'Enter the details for the new staff member.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-name">Full Name</FormLabel>
                  <FormControl>
                    <Input id="staff-form-name" placeholder="e.g., John Smith" {...field} disabled={isPending} aria-required="true" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-role">Role</FormLabel>
                  <FormControl>
                    <Input id="staff-form-role" placeholder="e.g., Security Chief, Logistics Lead" {...field} disabled={isPending} aria-required="true" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-department">Department (Optional)</FormLabel>
                  <FormControl>
                    <Input id="staff-form-department" placeholder="e.g., Operations, Media" {...field} value={field.value ?? ''} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="team"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-team">Team (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={isPending || staffTeams.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger id="staff-form-team">
                        <SelectValue placeholder={staffTeams.length > 0 ? "Select a team" : "No teams defined"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No Team / Unassigned</SelectItem>
                      {staffTeams.map((teamName) => (
                        <SelectItem key={teamName} value={teamName}>
                          {teamName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {staffTeams.length === 0 && <p className="text-xs text-muted-foreground mt-1">Add teams in Superior Admin panel.</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="contactInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-contactInfo">Contact Info (Optional)</FormLabel>
                  <FormControl>
                    <Input id="staff-form-contactInfo" placeholder="e.g., 555-1234 or name@example.com" {...field} value={field.value ?? ''} disabled={isPending} />
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
                  <FormLabel htmlFor="staff-form-notes">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      id="staff-form-notes"
                      placeholder="Any relevant notes about the staff member..."
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
              <Button type="submit" disabled={isPending || (!form.formState.isDirty && !!staffMemberToEdit)}>
                {isPending ? (staffMemberToEdit ? 'Saving...' : 'Adding...') : (staffMemberToEdit ? 'Save Changes' : 'Add Staff Member')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
