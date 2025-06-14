
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
} from '@/components/ui/select'; 
import { useToast } from '@/hooks/use-toast';
import { useEffect, useTransition, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { generateAvatar, type GenerateAvatarInput } from '@/ai/flows/generate-avatar-flow';
import { Sparkles, Loader2 } from 'lucide-react';

const staffMemberFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  role: z.string().min(2, 'Role is required.').max(50, 'Role must be at most 50 characters.'),
  department: z.string().max(50, 'Department must be at most 50 characters.').optional().default(''),
  team: z.string().optional().default(''), 
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().max(25, 'Phone number seems too long.').optional().or(z.literal('')),
  contactInfo: z.string().max(100, 'Other contact info must be at most 100 characters.').optional().default(''), // Kept for legacy/other
  imageUrl: z.string().optional().or(z.literal('')), 
  notes: z.string().max(1000, 'Notes must be at most 1000 characters.').optional().default(''),
});

type StaffMemberFormData = z.infer<typeof staffMemberFormSchema>;

const UNASSIGNED_TEAM_VALUE = "_UNASSIGNED_";
const NO_TEAMS_PLACEHOLDER_VALUE = "_NO_TEAMS_PLACEHOLDER_";

interface StaffMemberFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  staffMemberToEdit?: StaffMember | null;
  onFormSubmitSuccess?: () => void;
  staffTeams?: string[]; 
}

export function StaffMemberForm({
  isOpen,
  onOpenChange,
  staffMemberToEdit,
  onFormSubmitSuccess,
  staffTeams = [], 
}: StaffMemberFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  const form = useForm<StaffMemberFormData>({
    resolver: zodResolver(staffMemberFormSchema),
    defaultValues: {
      name: '',
      role: '',
      department: '',
      team: '', 
      email: '',
      phone: '',
      contactInfo: '',
      imageUrl: '',
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
          team: staffMemberToEdit.team || '', 
          email: staffMemberToEdit.email || '',
          phone: staffMemberToEdit.phone || '',
          contactInfo: staffMemberToEdit.contactInfo || '',
          imageUrl: staffMemberToEdit.imageUrl || '', // Keep as is, submission logic handles placeholders
          notes: staffMemberToEdit.notes || '',
        });
      } else {
        form.reset({ 
          name: '',
          role: '',
          department: '',
          team: '', 
          email: '',
          phone: '',
          contactInfo: '',
          imageUrl: '',
          notes: '',
        });
      }
    }
  }, [staffMemberToEdit, form, isOpen]);

  const handleGenerateAvatar = async () => {
    const currentName = form.getValues('name');
    const currentRole = form.getValues('role');

    if (!currentName || !currentRole) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in Name and Role before generating an avatar.',
        variant: 'default',
      });
      return;
    }
    setIsGeneratingAvatar(true);
    try {
      const avatarPrompt: GenerateAvatarInput = {
        prompt: `Professional avatar for a staff member named ${currentName}, with the role of ${currentRole}. Conference staff.`,
        name: currentName,
      };
      const result = await generateAvatar(avatarPrompt);
      if (result.imageDataUri) {
        form.setValue('imageUrl', result.imageDataUri, { shouldDirty: true, shouldValidate: true });
        toast({ title: 'Avatar Generated!', description: 'AI has created a new avatar for the staff member.' });
      } else {
        throw new Error('No image data URI returned from AI.');
      }
    } catch (error: any) {
      console.error("Error generating AI avatar for staff:", error);
      toast({
        title: 'Avatar Generation Failed',
        description: error.message || 'Could not generate avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAvatar(false);
    }
  };


  const onSubmit = (data: StaffMemberFormData) => {
    startTransition(async () => {
      try {
        const submissionData: any = {
          name: data.name.trim(),
          role: data.role.trim(),
          department: data.department?.trim() || '',
          team: data.team === UNASSIGNED_TEAM_VALUE ? '' : data.team?.trim() || '', 
          email: data.email?.trim() || '',
          phone: data.phone?.trim() || '',
          contactInfo: data.contactInfo?.trim() || '',
          notes: data.notes?.trim() || '',
          updatedAt: serverTimestamp(),
        };
        
        const formImageUrl = data.imageUrl?.trim();
        // If imageUrl is empty or a placeholder, generate a new placeholder.
        // Otherwise, use the provided (potentially AI-generated or user-input) URL.
        if (!formImageUrl || formImageUrl.startsWith('https://placehold.co')) {
          const nameInitial = (data.name.trim() || 'S').substring(0, 2).toUpperCase();
          submissionData.imageUrl = `https://placehold.co/40x40.png?text=${nameInitial}`;
        } else {
          submissionData.imageUrl = formImageUrl;
        }

        if (staffMemberToEdit) {
          const staffMemberRef = doc(db, 'staff_members', staffMemberToEdit.id);
          await updateDoc(staffMemberRef, submissionData);
          toast({ title: 'Staff Member Updated', description: `${data.name} has been updated.` });
        } else {
          const newStaffMemberData = {
            ...submissionData,
            status: 'Off Duty' as const, // Default status for new staff
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
    form.reset({ name: '', role: '', department: '', team: '', email: '', phone: '', contactInfo: '', imageUrl: '', notes: '' });
    onOpenChange(false);
  }
  
  const currentName = form.watch('name');
  const currentRole = form.watch('role');
  const canGenerateAvatar = !!currentName && !!currentRole;

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
                  <FormLabel htmlFor="staff-form-name">Full Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input id="staff-form-name" placeholder="e.g., John Smith" {...field} disabled={isPending || isGeneratingAvatar} aria-required="true" />
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
                  <FormLabel htmlFor="staff-form-role">Role <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input id="staff-form-role" placeholder="e.g., Security Chief, Logistics Lead" {...field} disabled={isPending || isGeneratingAvatar} aria-required="true" />
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
                    <Input id="staff-form-department" placeholder="e.g., Operations, Media" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
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
                    disabled={isPending || isGeneratingAvatar}
                  >
                    <FormControl>
                      <SelectTrigger id="staff-form-team">
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_TEAM_VALUE}>Unassigned / No Team</SelectItem>
                      {staffTeams.map((teamName) => (
                        <SelectItem key={teamName} value={teamName}>
                          {teamName}
                        </SelectItem>
                      ))}
                      {staffTeams.length === 0 && (
                        <SelectItem value={NO_TEAMS_PLACEHOLDER_VALUE} disabled>
                          No teams available. Add via Superior Admin.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-email">Email (Optional)</FormLabel>
                  <FormControl>
                    <Input id="staff-form-email" type="email" placeholder="staff@example.com" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-phone">Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input id="staff-form-phone" type="tel" placeholder="+1 555-000-0000" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-contactInfo">Other Contact Info (Optional)</FormLabel>
                  <FormControl>
                    <Input id="staff-form-contactInfo" placeholder="e.g., Radio channel, specific instructions" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-imageUrl">Image URL (Optional) or Generate AI Avatar</FormLabel>
                   <div className="flex items-center gap-2">
                    <FormControl className="flex-grow">
                      <Input id="staff-form-imageUrl" placeholder="https://example.com/image.png or AI generated" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
                    </FormControl>
                     <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateAvatar}
                      disabled={isPending || isGeneratingAvatar || !canGenerateAvatar}
                      className="shrink-0"
                      size="icon"
                      title="Generate Avatar with AI"
                    >
                      {isGeneratingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!canGenerateAvatar && <p className="text-xs text-muted-foreground pt-1">Fill Name and Role to enable AI Avatar.</p>}
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
                      disabled={isPending || isGeneratingAvatar}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending || isGeneratingAvatar} onClick={handleDialogClose}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || isGeneratingAvatar || (!form.formState.isDirty && !!staffMemberToEdit)}>
                {isPending ? (staffMemberToEdit ? 'Saving...' : 'Adding...') : (staffMemberToEdit ? 'Save Changes' : 'Add Staff Member')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
