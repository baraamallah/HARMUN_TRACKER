'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const addStaffFormSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters.'),
    email: z.string().email('Invalid email address.'),
    role: z.string().min(2, 'Role must be at least 2 characters.'),
});

type AddStaffFormData = z.infer<typeof addStaffFormSchema>;

export function AddStaffDialog() {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<AddStaffFormData>({
        resolver: zodResolver(addStaffFormSchema),
    });

    const onSubmit = async (data: AddStaffFormData) => {
        try {
            const staffCollection = collection(db, 'staff_members');
            await addDoc(staffCollection, {
                ...data,
                status: 'Active',
                avatar: 'https://github.com/shadcn.png', // Default avatar
            });
            toast({ title: 'Success', description: 'New staff member added.' });
            reset();
            setOpen(false);
        } catch (error) {
            console.error("Error adding staff member: ", error);
            toast({ title: 'Error', description: 'Failed to add staff member.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    Add Staff
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>
                        Enter the details of the new staff member.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input id="name" {...register('name')} className="col-span-3" />
                        {errors.name && <p className="col-span-4 text-red-500 text-xs">{errors.name.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input id="email" {...register('email')} className="col-span-3" />
                        {errors.email && <p className="col-span-4 text-red-500 text-xs">{errors.email.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                            Role
                        </Label>
                        <Input id="role" {...register('role')} className="col-span-3" />
                        {errors.role && <p className="col-span-4 text-red-500 text-xs">{errors.role.message}</p>}
                    </div>
                    <Button type="submit">Add Staff Member</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
