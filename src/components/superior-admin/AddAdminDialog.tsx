'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import type { AdminManagedUser } from '@/types';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const USERS_COLLECTION = 'users';

const addAdminSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  displayName: z.string().optional(),
  authUid: z.string().min(1, { message: 'Firebase Auth UID is required.' }),
  canAccessSuperiorAdmin: z.boolean().default(false),
  permissions: z.object({
    canEditParticipants: z.boolean().default(false),
    canDeleteParticipants: z.boolean().default(false),
    canCreateStaff: z.boolean().default(false),
    canEditStaff: z.boolean().default(false),
    canDeleteStaff: z.boolean().default(false),
    canAccessAnalytics: z.boolean().default(false),
    canManageQRCodes: z.boolean().default(false),
  }).default({}),
});

type AddAdminFormData = z.infer<typeof addAdminSchema>;

interface AddAdminDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  adminToEdit?: AdminManagedUser | null;
  onAdminAdded?: () => void;
}

export function AddAdminDialog({ isOpen, onOpenChange, adminToEdit, onAdminAdded }: AddAdminDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<AddAdminFormData>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: {
      email: '',
      displayName: '',
      authUid: '',
      canAccessSuperiorAdmin: false,
      permissions: {
        canEditParticipants: false,
        canDeleteParticipants: false,
        canCreateStaff: false,
        canEditStaff: false,
        canDeleteStaff: false,
        canAccessAnalytics: false,
        canManageQRCodes: false,
      },
    },
  });
  
  useEffect(() => {
    if (isOpen) {
      if (adminToEdit) {
        form.reset({
          email: adminToEdit.email,
          displayName: adminToEdit.displayName || '',
          authUid: adminToEdit.id,
          canAccessSuperiorAdmin: adminToEdit.canAccessSuperiorAdmin || false,
          permissions: {
            canEditParticipants: adminToEdit.permissions?.canEditParticipants || false,
            canDeleteParticipants: adminToEdit.permissions?.canDeleteParticipants || false,
            canCreateStaff: adminToEdit.permissions?.canCreateStaff || false,
            canEditStaff: adminToEdit.permissions?.canEditStaff || false,
            canDeleteStaff: adminToEdit.permissions?.canDeleteStaff || false,
            canAccessAnalytics: adminToEdit.permissions?.canAccessAnalytics || false,
            canManageQRCodes: adminToEdit.permissions?.canManageQRCodes || false,
          },
        });
      } else {
        form.reset({
          email: '',
          displayName: '',
          authUid: '',
          canAccessSuperiorAdmin: false,
          permissions: {
            canEditParticipants: false,
            canDeleteParticipants: false,
            canCreateStaff: false,
            canEditStaff: false,
            canDeleteStaff: false,
            canAccessAnalytics: false,
            canManageQRCodes: false,
          },
        });
      }
    }
  }, [adminToEdit, isOpen, form]);

  const onSubmit = (data: AddAdminFormData) => {
    startTransition(async () => {
      const { email, displayName, authUid, canAccessSuperiorAdmin, permissions } = data;
      if (!email || !authUid) {
        toast({ title: 'Error', description: 'Email and Auth UID are required.', variant: 'destructive' });
        return;
      }
      const trimmedAuthUid = authUid.trim();
      if (!trimmedAuthUid) {
        toast({ title: 'Error', description: 'Auth UID cannot be empty.', variant: 'destructive' });
        return;
      }

      const userDocRef = doc(db, USERS_COLLECTION, trimmedAuthUid);

      try {
        const userDocSnap = await getDoc(userDocRef);
        const currentEmail = email.toLowerCase().trim();
        const currentDisplayName = displayName?.trim() || null;

        const updates: Partial<AdminManagedUser> = {
          email: currentEmail,
          displayName: currentDisplayName,
          canAccessSuperiorAdmin: canAccessSuperiorAdmin,
          permissions: permissions,
          role: 'admin',
          updatedAt: serverTimestamp()
        };

        if (userDocSnap.exists()) {
          // If email is being changed, check for conflicts
          if (currentEmail !== userDocSnap.data().email) {
            const emailConflictQuery = query(collection(db, USERS_COLLECTION), where('email', '==', currentEmail), where('role', '==', 'admin'));
            const emailConflictSnapshot = await getDocs(emailConflictQuery);
            if (!emailConflictSnapshot.empty && emailConflictSnapshot.docs[0].id !== trimmedAuthUid) {
              toast({ title: 'Error', description: `Email ${currentEmail} is already associated with another admin.`, variant: 'destructive' });
              return;
            }
          }
          await updateDoc(userDocRef, updates);
          toast({ title: 'Admin Updated', description: `Details for user ${trimmedAuthUid} have been updated.` });

        } else { // Document does not exist, create it
          // Check for email conflict before creating
          const emailConflictQuery = query(collection(db, USERS_COLLECTION), where('email', '==', currentEmail), where('role', '==', 'admin'));
          const emailConflictSnapshot = await getDocs(emailConflictQuery);
          if (!emailConflictSnapshot.empty) {
            toast({ title: 'Error', description: `Email ${currentEmail} is already associated with another admin.`, variant: 'destructive' });
            return;
          }

          const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
          const newAdminData = {
            ...updates,
            avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`,
            createdAt: serverTimestamp(),
          };
          await setDoc(userDocRef, newAdminData);
          toast({ title: 'Admin Role Granted', description: `User ${trimmedAuthUid} granted admin role and user record created.` });
        }

        form.reset();
        onOpenChange(false);
        onAdminAdded?.();

      } catch (error: any) {
        console.error(`Client-side Error granting/updating admin role to UID ${trimmedAuthUid}:`, error);
        toast({
          title: 'Operation Failed',
          description: error.message || 'Could not grant admin role. Check permissions and console.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) form.reset();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{adminToEdit ? 'Edit Admin' : 'Grant Admin Role'}</DialogTitle>
          <DialogDescription>
            {adminToEdit ? 'Update the details and permissions for this administrator.' : 'Enter the email and Firebase Auth UID of an existing Firebase Authentication user to grant them admin privileges.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User's Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="User Name" {...field} value={field.value || ''} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authUid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firebase Auth UID</FormLabel>
                  <FormControl>
                    <Input placeholder="User's Firebase Authentication UID" {...field} disabled={isPending || !!adminToEdit} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
              <h4 className="text-md font-medium">Permissions</h4>
              <FormField
                control={form.control}
                name="permissions.canEditParticipants"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Edit Participants</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions.canDeleteParticipants"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Delete Participants</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions.canCreateStaff"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Create Staff</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions.canEditStaff"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Edit Staff</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions.canDeleteStaff"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Delete Staff</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions.canAccessAnalytics"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Access Analytics</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions.canManageQRCodes"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Manage QR Codes</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            
            <FormField
              control={form.control}
              name="canAccessSuperiorAdmin"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-yellow-500/10 p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-yellow-800 dark:text-yellow-300">Grant Superior Admin Access</FormLabel>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Allows this user to access the Superior Admin panel and manage system settings.
                    </p>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                {isPending ? 'Saving...' : (adminToEdit ? 'Save Changes' : 'Grant Role')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}