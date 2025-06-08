
'use client';

import React, { useState, useTransition } from 'react';
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
  DialogTrigger,
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
import { useToast } from '@/hooks/use-toast';
// import { grantAdminRole } from '@/lib/actions'; // Server action removed
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { AdminManagedUser } from '@/types';
import { UserPlus } from 'lucide-react';

const USERS_COLLECTION = 'users';

const addAdminSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  displayName: z.string().optional(),
  authUid: z.string().min(1, { message: 'Firebase Auth UID is required.' }),
});

type AddAdminFormData = z.infer<typeof addAdminSchema>;

interface AddAdminDialogProps {
  onAdminAdded?: () => void; 
}

export function AddAdminDialog({ onAdminAdded }: AddAdminDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<AddAdminFormData>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: {
      email: '',
      displayName: '',
      authUid: '',
    },
  });

  const onSubmit = (data: AddAdminFormData) => {
    startTransition(async () => {
      const { email, displayName, authUid } = data;
      if (!email || !authUid) {
        toast({ title: 'Error', description: 'Email and Auth UID are required.', variant: 'destructive'});
        return;
      }
      const trimmedAuthUid = authUid.trim();
      if (!trimmedAuthUid) {
        toast({ title: 'Error', description: 'Auth UID cannot be empty.', variant: 'destructive'});
        return;
      }

      const userDocRef = doc(db, USERS_COLLECTION, trimmedAuthUid);

      try {
        const userDocSnap = await getDoc(userDocRef);
        const currentEmail = email.toLowerCase().trim();
        const currentDisplayName = displayName?.trim() || null;

        if (userDocSnap.exists()) {
          const existingData = userDocSnap.data() as AdminManagedUser;
          if (existingData.role === 'admin') {
            const updates: Partial<AdminManagedUser> = {};
            let changed = false;
            if (currentEmail !== existingData.email) { updates.email = currentEmail; changed = true; }
            if (currentDisplayName !== existingData.displayName) { updates.displayName = currentDisplayName; changed = true; }
            
            if (changed) {
              if (updates.email) { // Check if email is being changed and if it conflicts
                const emailConflictQuery = query(collection(db, USERS_COLLECTION), where('email', '==', updates.email), where('role', '==', 'admin'));
                const emailConflictSnapshot = await getDocs(emailConflictQuery);
                if (!emailConflictSnapshot.empty && emailConflictSnapshot.docs[0].id !== trimmedAuthUid) {
                  toast({ title: 'Error', description: `Email ${updates.email} is already associated with another admin (UID: ${emailConflictSnapshot.docs[0].id}).`, variant: 'destructive' });
                  return;
                }
              }
              await updateDoc(userDocRef, {...updates, updatedAt: serverTimestamp()});
              toast({ title: 'Admin Updated', description: `User ${trimmedAuthUid} is already an admin. Details updated.`});
            } else {
              toast({ title: 'Info', description: `User ${trimmedAuthUid} is already an admin. No changes made.`});
            }
          } else { // User exists but not admin
            const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
            const updatedFields = { 
              email: currentEmail, 
              displayName: currentDisplayName, 
              role: 'admin' as const, 
              avatarUrl: existingData.avatarUrl || `https://placehold.co/40x40.png?text=${firstLetter}`, 
              updatedAt: serverTimestamp() 
            };
            await updateDoc(userDocRef, updatedFields);
            toast({ title: 'Admin Role Granted', description: `Admin role granted to user ${trimmedAuthUid}.` });
          }
        } else { // User document does not exist, create new admin
          const emailConflictQuery = query(collection(db, USERS_COLLECTION), where('email', '==', currentEmail), where('role', '==', 'admin'));
          const emailConflictSnapshot = await getDocs(emailConflictQuery);
          if (!emailConflictSnapshot.empty) {
            toast({ title: 'Error', description: `Email ${currentEmail} is already associated with another admin (UID: ${emailConflictSnapshot.docs[0].id}). Please use a unique email or resolve the conflict.`, variant: 'destructive'});
            return;
          }

          const firstLetter = (currentDisplayName || currentEmail || 'A').charAt(0).toUpperCase();
          const newAdminData = { 
            email: currentEmail, 
            displayName: currentDisplayName, 
            role: 'admin' as const, 
            avatarUrl: `https://placehold.co/40x40.png?text=${firstLetter}`, 
            createdAt: serverTimestamp(), 
            updatedAt: serverTimestamp() 
          };
          await setDoc(userDocRef, newAdminData);
          toast({ title: 'Admin Role Granted', description: `User ${trimmedAuthUid} granted admin role and user record created.` });
        }
        
        form.reset();
        setIsOpen(false);
        onAdminAdded?.();

      } catch (error: any) {
        console.error(`Client-side Error granting admin role to UID ${trimmedAuthUid}:`, error);
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
        setIsOpen(open);
    }}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-5 w-5" /> Grant Admin Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Grant Admin Role</DialogTitle>
          <DialogDescription>
            Enter the email and Firebase Auth UID of an existing Firebase Authentication user to grant them admin privileges.
            This does NOT create a new Firebase Authentication user account. It manages their role within this application.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User&apos;s Email</FormLabel>
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
                    <Input placeholder="User Name" {...field} disabled={isPending} />
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
                    <Input placeholder="User's Firebase Authentication UID" {...field} disabled={isPending} />
                  </FormControl>
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
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Granting Role...' : 'Grant Admin Role'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    