
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { Participant, AttendanceStatus } from '@/types';
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
import { collection, addDoc, doc, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultAttendanceStatusSetting } from '@/lib/actions';
import { generateAvatar, type GenerateAvatarInput } from '@/ai/flows/generate-avatar-flow';
import { Sparkles, Loader2 } from 'lucide-react';

const participantFormSchema = z.object({
  id: z.string()
    .max(100, "ID must be 100 characters or less.")
    .regex(/^[a-zA-Z0-9_-]*$/, "ID can only contain letters, numbers, underscores, and hyphens, or be empty for auto-generation.")
    .optional()
    .default(''),
  name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  school: z.string().min(1, 'School is required.'),
  committee: z.string().min(1, 'Committee is required.'),
  country: z.string().max(100, 'Country must be at most 100 characters.').optional().default(''),
  classGrade: z.string().max(50, 'Class/Grade must be at most 50 characters.').optional().default(''),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().max(25, 'Phone number seems too long.').optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')), // Allow URL or empty string, data URI will be a string
  notes: z.string().max(1000, 'Notes must be at most 1000 characters.').optional().default(''),
  additionalDetails: z.string().max(1000, 'Details must be at most 1000 characters.').optional().default(''),
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
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<AttendanceStatus>('Absent');

  useEffect(() => {
    if (isOpen && !participantToEdit) {
      getDefaultAttendanceStatusSetting().then(fetchedStatus => {
        setDefaultStatus(fetchedStatus);
      }).catch(err => {
        console.error("Error fetching default status for ParticipantForm:", err);
      });
    }
  }, [isOpen, participantToEdit]);


  const form = useForm<ParticipantFormData>({
    resolver: zodResolver(participantFormSchema),
    defaultValues: {
      id: '',
      name: '',
      school: '',
      committee: '',
      country: '',
      classGrade: '',
      email: '',
      phone: '',
      imageUrl: '',
      notes: '',
      additionalDetails: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (participantToEdit) {
        form.reset({
          id: participantToEdit.id,
          name: participantToEdit.name,
          school: participantToEdit.school,
          committee: participantToEdit.committee,
          country: participantToEdit.country || '',
          classGrade: participantToEdit.classGrade || '',
          email: participantToEdit.email || '',
          phone: participantToEdit.phone || '',
          imageUrl: participantToEdit.imageUrl || '', // Keep as is, submission logic handles placeholders
          notes: participantToEdit.notes || '',
          additionalDetails: participantToEdit.additionalDetails || '',
        });
      } else {
        form.reset({
          id: '',
          name: '',
          school: '',
          committee: '',
          country: '',
          classGrade: '',
          email: '',
          phone: '',
          imageUrl: '',
          notes: '',
          additionalDetails: '',
        });
      }
    }
  }, [participantToEdit, form, isOpen]);

  const handleGenerateAvatar = async () => {
    const currentName = form.getValues('name');
    const currentSchool = form.getValues('school');
    const currentCommittee = form.getValues('committee');

    if (!currentName || !currentSchool || !currentCommittee) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in Name, School, and Committee before generating an avatar.',
        variant: 'default',
      });
      return;
    }

    setIsGeneratingAvatar(true);
    try {
      const avatarPrompt: GenerateAvatarInput = {
        prompt: `A student diplomat profile picture, representing ${currentSchool} in the ${currentCommittee} committee. Focus on a clear, friendly, professional portrait.`,
        name: currentName,
      };
      const result = await generateAvatar(avatarPrompt);
      if (result.imageDataUri) {
        form.setValue('imageUrl', result.imageDataUri, { shouldDirty: true, shouldValidate: true });
        toast({ title: 'Avatar Generated!', description: 'AI has created a new avatar.' });
      } else {
        throw new Error('No image data URI returned from AI.');
      }
    } catch (error: any) {
      console.error("Error generating AI avatar:", error);
      toast({
        title: 'Avatar Generation Failed',
        description: error.message || 'Could not generate avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const onSubmit = (data: ParticipantFormData) => {
    startTransition(async () => {
      try {
        const submissionData: any = {
          name: data.name.trim(),
          school: data.school.trim(),
          committee: data.committee.trim(),
          country: data.country?.trim() || '',
          classGrade: data.classGrade?.trim() || '',
          email: data.email?.trim() || '',
          phone: data.phone?.trim() || '',
          notes: data.notes?.trim() || '',
          additionalDetails: data.additionalDetails?.trim() || '',
          updatedAt: serverTimestamp(),
        };

        const formImageUrl = data.imageUrl?.trim();
        // If imageUrl is empty or a placeholder, generate a new placeholder.
        // Otherwise, use the provided (potentially AI-generated or user-input) URL.
        if (!formImageUrl || formImageUrl.startsWith('https://placehold.co')) {
          const nameInitial = (data.name.trim() || 'P').substring(0, 2).toUpperCase();
          submissionData.imageUrl = `https://placehold.co/40x40.png?text=${nameInitial}`;
        } else {
          submissionData.imageUrl = formImageUrl;
        }

        if (participantToEdit) {
          const participantRef = doc(db, 'participants', participantToEdit.id);
          submissionData.status = participantToEdit.status; // Preserve existing status on edit
          submissionData.attended = participantToEdit.attended || false;
          submissionData.checkInTime = participantToEdit.checkInTime || null;
          await updateDoc(participantRef, submissionData);
          toast({ title: 'Participant Updated', description: `${data.name} has been updated.` });
        } else {
          let participantIdToUse = data.id?.trim();

          if (participantIdToUse) {
            const newParticipantRef = doc(db, 'participants', participantIdToUse);
            const docSnap = await getDoc(newParticipantRef);
            if (docSnap.exists()) {
              toast({
                title: 'Error: ID already exists',
                description: `A participant with ID "${participantIdToUse}" already exists. Please use a unique ID or leave it blank for auto-generation.`,
                variant: 'destructive',
              });
              return;
            }
          } else {
            participantIdToUse = uuidv4();
          }

          submissionData.status = defaultStatus;
          submissionData.attended = false;
          submissionData.checkInTime = null;
          submissionData.createdAt = serverTimestamp();

          const newParticipantRefWithId = doc(db, 'participants', participantIdToUse);
          await setDoc(newParticipantRefWithId, submissionData);
          toast({ title: 'Participant Added', description: `${data.name} (ID: ${participantIdToUse}) has been added.` });
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
        id: '',
        name: '',
        school: '',
        committee: '',
        country: '',
        classGrade: '',
        email: '',
        phone: '',
        imageUrl: '',
        notes: '',
        additionalDetails: '',
    });
    onOpenChange(false);
  }

  const currentName = form.watch('name');
  const currentSchool = form.watch('school');
  const currentCommittee = form.watch('committee');
  const canGenerateAvatar = !!currentName && !!currentSchool && !!currentCommittee;

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
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-id">
                    Participant ID {participantToEdit ? '(Read-only)' : '(Optional - Leave blank to auto-generate)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="form-id"
                      placeholder={participantToEdit ? '' : "e.g., CUS_123_XYZ (alphanumeric, -, _)"}
                      {...field}
                      disabled={isPending || !!participantToEdit || isGeneratingAvatar}
                      aria-readonly={!!participantToEdit}
                    />
                  </FormControl>
                  {!participantToEdit && <p className="text-xs text-muted-foreground pt-1">If you provide an ID, it must be unique.</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-name">Full Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input id="form-name" placeholder="e.g., Jane Doe" {...field} disabled={isPending || isGeneratingAvatar} aria-required="true" />
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
                  <FormLabel htmlFor="form-school">School <span className="text-destructive">*</span></FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={isPending || isGeneratingAvatar}
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
                      {schools.length === 0 && <SelectItem value="_NO_SCHOOLS_" disabled>No schools available. Add via Superior Admin.</SelectItem>}
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
                  <FormLabel htmlFor="form-committee">Committee <span className="text-destructive">*</span></FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={isPending || isGeneratingAvatar}
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
                       {committees.length === 0 && <SelectItem value="_NO_COMMITTEES_" disabled>No committees available. Add via Superior Admin.</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-country">Country (Optional)</FormLabel>
                  <FormControl>
                    <Input id="form-country" placeholder="e.g., United States" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="classGrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-classGrade">Class/Grade (Optional)</FormLabel>
                  <FormControl>
                    <Input id="form-classGrade" placeholder="e.g., 10th Grade, Year 12" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="form-email">Email (Optional)</FormLabel>
                  <FormControl>
                    <Input id="form-email" type="email" placeholder="participant@example.com" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
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
                  <FormLabel htmlFor="form-phone">Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input id="form-phone" type="tel" placeholder="e.g., +1 555-123-4567" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
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
                  <FormLabel htmlFor="form-imageUrl">Image URL (Optional) or Generate AI Avatar</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl className="flex-grow">
                      <Input id="form-imageUrl" placeholder="https://example.com/image.png or AI generated" {...field} value={field.value ?? ''} disabled={isPending || isGeneratingAvatar} />
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
                  {!canGenerateAvatar && <p className="text-xs text-muted-foreground pt-1">Fill Name, School, and Committee to enable AI Avatar.</p>}
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
                      disabled={isPending || isGeneratingAvatar}
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
              <Button type="submit" disabled={isPending || isGeneratingAvatar || (!form.formState.isDirty && !!participantToEdit)}>
                {isPending ? (participantToEdit ? 'Saving...' : 'Adding...') : (participantToEdit ? 'Save Changes' : 'Add Participant')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
