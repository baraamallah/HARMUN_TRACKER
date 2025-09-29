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

const sendNotificationFormSchema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters.'),
    message: z.string().min(10, 'Message must be at least 10 characters.'),
});

type SendNotificationFormData = z.infer<typeof sendNotificationFormSchema>;

export function SendNotificationDialog() {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<SendNotificationFormData>({
        resolver: zodResolver(sendNotificationFormSchema),
    });

    const onSubmit = async (data: SendNotificationFormData) => {
        try {
            const notificationsCollection = collection(db, 'notifications');
            await addDoc(notificationsCollection, {
                ...data,
                timestamp: new Date(),
            });
            toast({ title: 'Success', description: 'Notification sent.' });
            reset();
            setOpen(false);
        } catch (error) {
            console.error("Error sending notification: ", error);
            toast({ title: 'Error', description: 'Failed to send notification.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    Send Notification
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Notification</DialogTitle>
                    <DialogDescription>
                        Enter the details of the notification.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">
                            Title
                        </Label>
                        <Input id="title" {...register('title')} className="col-span-3" />
                        {errors.title && <p className="col-span-4 text-red-500 text-xs">{errors.title.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="message" className="text-right">
                            Message
                        </Label>
                        <Input id="message" {...register('message')} className="col-span-3" />
                        {errors.message && <p className="col-span-4 text-red-500 text-xs">{errors.message.message}</p>}
                    </div>
                    <Button type="submit">Send Notification</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
