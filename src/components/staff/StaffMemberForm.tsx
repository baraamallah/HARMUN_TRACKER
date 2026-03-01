
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { StaffMember, StaffAttendanceStatus } from '@/types';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useTransition, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDefaultStaffStatusSetting } from '@/lib/actions';
import { getGoogleDriveImageSrc } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Link as LinkIcon } from 'lucide-react';

const staffMemberFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  role: z.string().min(2, 'Role is required.').max(50, 'Role must be at most 50 characters.'),
  department: z.string().max(50, 'Department must be at most 50 characters.').optional().default(''),
  team: z.string().optional().default(''),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().max(25, 'Phone number seems too long.').optional().or(z.literal('')),
  contactInfo: z.string().max(100, 'Other contact info must be at most 100 characters.').optional().default(''),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
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
  const [defaultStatus, setDefaultStatus] = useState<StaffAttendanceStatus>('Off Duty');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !staffMemberToEdit) {
      getDefaultStaffStatusSetting().then(fetchedStatus => {
        setDefaultStatus(fetchedStatus);
      }).catch(err => {
        console.error("Error fetching default staff status for StaffMemberForm:", err);
      });
    }
  }, [isOpen, staffMemberToEdit]);


  const form = useForm<StaffMemberFormData>({
    resolver: zodResolver(staffMemberFormSchema),
    defaultValues: {
      name: '', role: '', department: '', team: '', email: '',
      phone: '', contactInfo: '', imageUrl: '', notes: '',
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
          imageUrl: staffMemberToEdit.imageUrl || '',
          notes: staffMemberToEdit.notes || '',
        });
        setImagePreview(staffMemberToEdit.imageUrl ? getGoogleDriveImageSrc(staffMemberToEdit.imageUrl) : null);
      } else {
        form.reset({
          name: '', role: '', department: '', team: '', email: '',
          phone: '', contactInfo: '', imageUrl: '', notes: '',
        });
        setImagePreview(null);
      }
    }
  }, [staffMemberToEdit, form, isOpen]);

  const currentImageUrl = form.watch('imageUrl');
  useEffect(() => {
     if (currentImageUrl && currentImageUrl !== imagePreview) {
      if (currentImageUrl.startsWith('http://') || currentImageUrl.startsWith('https://')) {
         setImagePreview(getGoogleDriveImageSrc(currentImageUrl));
      } else if (currentImageUrl === '') {
        setImagePreview(null);
      }
    }
  }, [currentImageUrl, imagePreview]);

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
          contact_info: data.contactInfo?.trim() || '',
          notes: data.notes?.trim() || '',
          updated_at: new Date().toISOString(),
        };
        
        const formImageUrl = data.imageUrl?.trim();
        if (!formImageUrl) {
          const nameInitial = (data.name.trim() || 'S').substring(0, 2).toUpperCase();
          submissionData.image_url = `https://placehold.co/40x40.png?text=${nameInitial}`;
        } else {
          submissionData.image_url = formImageUrl;
        }

        if (staffMemberToEdit) {
          const { error } = await supabase
            .from('staff_members')
            .update(submissionData)
            .eq('id', staffMemberToEdit.id);

          if (error) throw error;
          toast({ title: 'Staff Member Updated', description: `${data.name} has been updated.` });
        } else {
          const newStaffMemberData = {
            ...submissionData,
            status: defaultStatus,
            created_at: new Date().toISOString(),
          };
          const { error } = await supabase.from('staff_members').insert(newStaffMemberData);
          if (error) throw error;
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
    setImagePreview(null);
    onOpenChange(false);
  }
  
  const nameForFallback = form.watch('name') || 'S';
  const fallbackAvatarText = nameForFallback.substring(0, 2).toUpperCase();

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
                  <FormLabel htmlFor="staff-form-role">Role <span className="text-destructive">*</span></FormLabel>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isPending} >
                    <FormControl>
                      <SelectTrigger id="staff-form-team">
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_TEAM_VALUE}>Unassigned / No Team</SelectItem>
                      {staffTeams.map((teamName) => (
                        <SelectItem key={teamName} value={teamName}> {teamName} </SelectItem>
                      ))}
                      {staffTeams.length === 0 && (
                        <SelectItem value={NO_TEAMS_PLACEHOLDER_VALUE} disabled> No teams available. Add via Superior Admin. </SelectItem>
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
                    <Input id="staff-form-email" type="email" placeholder="staff@example.com" {...field} value={field.value ?? ''} disabled={isPending} />
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
                    <Input id="staff-form-phone" type="tel" placeholder="+1 555-000-0000" {...field} value={field.value ?? ''} disabled={isPending} />
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
                    <Input id="staff-form-contactInfo" placeholder="e.g., Radio channel, specific instructions" {...field} value={field.value ?? ''} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2 rounded-md border p-4">
              <FormLabel>Avatar</FormLabel>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border">
                  <AvatarImage src={imagePreview || undefined} alt="Avatar Preview" data-ai-hint="profile preview"/>
                  <AvatarFallback className="text-2xl">{fallbackAvatarText}</AvatarFallback>
                </Avatar>
                <div className="flex-grow space-y-3">
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel htmlFor="staff-form-imageUrl" className="text-xs text-muted-foreground flex items-center">
                           <LinkIcon className="mr-1.5 h-3.5 w-3.5"/> Image URL (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            id="staff-form-imageUrl" 
                            placeholder="https://example.com/image.png" 
                            {...field} 
                            value={field.value ?? ''} 
                            disabled={isPending} 
                            onChange={(e) => {
                                field.onChange(e);
                                setImagePreview(e.target.value ? getGoogleDriveImageSrc(e.target.value) : null);
                            }}
                            data-ai-hint="image url"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="staff-form-notes">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea id="staff-form-notes" placeholder="Any relevant notes about the staff member..." {...field} value={field.value ?? ''} disabled={isPending} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending} onClick={handleDialogClose}> Cancel </Button>
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
