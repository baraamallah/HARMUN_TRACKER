
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
import { grantAdminRole } from '@/lib/actions';
import { UserPlus } from 'lucide-react';

const addAdminSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  displayName: z.string().optional(),
  authUid: z.string().min(1, { message: 'Firebase Auth UID is required.' }),
});

type AddAdminFormData = z.infer<typeof addAdminSchema>;

interface AddAdminDialogProps {
  onAdminAdded?: () => void; // Callback to refresh admin list
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
      try {
        const result = await grantAdminRole(data);
        if (result.success) {
          toast({
            title: 'Admin Role Granted',
            description: result.message,
          });
          form.reset();
          setIsOpen(false);
          onAdminAdded?.();
        } else {
          toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({
          title: 'Operation Failed',
          description: error.message || 'Could not grant admin role.',
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
            This does NOT create a new Firebase Authentication user.
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
