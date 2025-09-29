
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { AdminManagedUser } from '@/types';
import { Button } from '@/components/ui/button';
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
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getGoogleDriveImageSrc } from '@/lib/utils';
import { Link as LinkIcon } from 'lucide-react';

const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must be at most 50 characters.'),
  avatarUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface ProfileFormProps {
  adminUser: AdminManagedUser;
}

export function ProfileForm({ adminUser }: ProfileFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: adminUser.displayName || '',
      avatarUrl: adminUser.avatarUrl || '',
    },
  });

  useEffect(() => {
    if (adminUser) {
      form.reset({
        displayName: adminUser.displayName || '',
        avatarUrl: adminUser.avatarUrl || '',
      });
      setImagePreview(adminUser.avatarUrl ? getGoogleDriveImageSrc(adminUser.avatarUrl) : null);
    }
  }, [adminUser, form]);

  const currentImageUrl = form.watch('avatarUrl');
  useEffect(() => {
    if (currentImageUrl && currentImageUrl !== imagePreview) {
      if (currentImageUrl.startsWith('http')) {
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
        await updateDoc(userDocRef, {
          displayName: data.displayName.trim(),
          avatarUrl: data.avatarUrl?.trim() || '',
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'Profile Updated', description: 'Your profile has been updated successfully.' });
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

  const nameForFallback = form.watch('displayName') || 'A';
  const fallbackAvatarText = nameForFallback.substring(0, 2).toUpperCase();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel htmlFor="form-avatarUrl" className="text-xs text-muted-foreground flex items-center">
                      <LinkIcon className="mr-1.5 h-3.5 w-3.5"/> Image URL (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="form-avatarUrl"
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

        <Button type="submit" disabled={isPending || !form.formState.isDirty}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </Form>
  );
}
