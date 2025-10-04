
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { AdminManagedUser } from '@/types';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useTransition, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getGoogleDriveImageSrc } from '@/lib/utils';
import { Link as LinkIcon } from 'lucide-react';

const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface ProfileFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  adminUser: AdminManagedUser;
  onFormSubmitSuccess?: () => void;
}

export function ProfileForm({ isOpen, onOpenChange, adminUser, onFormSubmitSuccess }: ProfileFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      imageUrl: '',
    },
  });

  useEffect(() => {
    if (isOpen && adminUser) {
      form.reset({
        displayName: adminUser.displayName || '',
        imageUrl: adminUser.imageUrl || '',
      });
      setImagePreview(adminUser.imageUrl ? getGoogleDriveImageSrc(adminUser.imageUrl) : null);
    } else if (!isOpen) {
        form.reset({ displayName: '', imageUrl: '' });
        setImagePreview(null);
    }
  }, [adminUser, form, isOpen]);

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


  const onSubmit = (data: ProfileFormData) => {
    startTransition(async () => {
      try {
        const userDocRef = doc(db, 'users', adminUser.id);
        await setDoc(userDocRef, {
          displayName: data.displayName.trim(),
          imageUrl: data.imageUrl?.trim() || '',
          updatedAt: serverTimestamp(),
        }, { merge: true });

        toast({ title: 'Profile Updated', description: 'Your profile has been updated successfully.' });
        onFormSubmitSuccess?.();
        onOpenChange(false);

      } catch (error: any) {
        console.error("Error updating profile:", error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to update your profile.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDialogClose = () => {
    onOpenChange(false);
  }

  const nameForFallback = form.watch('displayName') || adminUser.displayName || 'A';
  const fallbackAvatarText = nameForFallback.substring(0, 2).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Your Profile</DialogTitle>
          <DialogDescription>
            Update your display name and avatar. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-2 rounded-md border p-4">
              <FormLabel>Avatar</FormLabel>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border">
                  <AvatarImage src={imagePreview || undefined} alt="Avatar Preview" />
                  <AvatarFallback className="text-2xl">{fallbackAvatarText}</AvatarFallback>
                </Avatar>
                <div className="flex-grow space-y-3">
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel htmlFor="form-imageUrl" className="text-xs text-muted-foreground flex items-center">
                          <LinkIcon className="mr-1.5 h-3.5 w-3.5"/> Image URL (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="form-imageUrl"
                            placeholder="https://example.com/image.png"
                            {...field}
                            value={field.value ?? ''}
                            disabled={isPending}
                            onChange={(e) => {
                                field.onChange(e);
                                setImagePreview(e.target.value ? getGoogleDriveImageSrc(e.target.value) : null);
                            }}
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
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending} onClick={handleDialogClose}> Cancel </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
