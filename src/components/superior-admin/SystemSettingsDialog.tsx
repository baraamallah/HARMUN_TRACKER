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
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const systemSettingsFormSchema = z.object({
    systemVersion: z.string().min(2, 'Version must be at least 2 characters.'),
});

type SystemSettingsFormData = z.infer<typeof systemSettingsFormSchema>;

export function SystemSettingsDialog() {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<SystemSettingsFormData>({
        resolver: zodResolver(systemSettingsFormSchema),
    });

    const onSubmit = async (data: SystemSettingsFormData) => {
        try {
            const systemConfigDoc = doc(db, 'system_config', 'version');
            await setDoc(systemConfigDoc, { value: data.systemVersion });
            toast({ title: 'Success', description: 'System settings updated.' });
            reset();
            setOpen(false);
        } catch (error) {
            console.error("Error updating system settings: ", error);
            toast({ title: 'Error', description: 'Failed to update system settings.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    System Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>System Settings</DialogTitle>
                    <DialogDescription>
                        Update system-wide settings.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="systemVersion" className="text-right">
                            System Version
                        </Label>
                        <Input id="systemVersion" {...register('systemVersion')} className="col-span-3" />
                        {errors.systemVersion && <p className="col-span-4 text-red-500 text-xs">{errors.systemVersion.message}</p>}
                    </div>
                    <Button type="submit">Update Settings</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
