
'use client';

import type { StaffMember, StaffAttendanceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Edit3, Trash2, MoreHorizontal, CheckCircle, XCircle, Coffee, ChevronDown, UserCheck, UserX, Briefcase, Plane, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteStaffMember } from '@/lib/actions'; // Server action for delete
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase'; // Import db
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'; // Import firestore functions


interface StaffMemberActionsProps {
  staffMember: StaffMember;
  onEdit: (staffMember: StaffMember) => void;
}

export function StaffMemberActions({ staffMember, onEdit }: StaffMemberActionsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleMarkStatusClientSide = async (status: StaffAttendanceStatus) => {
    startTransition(async () => {
      try {
        const staffMemberRef = doc(db, 'staff_members', staffMember.id);
        await updateDoc(staffMemberRef, { status, updatedAt: serverTimestamp() });
        toast({
          title: 'Status Updated',
          description: `${staffMember.name}'s status set to ${status}.`,
        });
        router.refresh(); 
      } catch (error: any) {
        console.error("Client-side Error marking staff status: ", error);
        toast({
          title: 'Error Updating Status',
          description: error.message || 'An unknown error occurred client-side.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = async () => {
    startDeleteTransition(async () => {
      try {
        await deleteStaffMember(staffMember.id); // deleteStaffMember is still a server action
        toast({
          title: 'Staff Member Deleted',
          description: `${staffMember.name} has been removed.`,
        });
        setIsDeleteDialogOpen(false);
        router.refresh(); 
      } catch (error: any) {
        let description = "An unexpected error occurred during deletion.";
        if (error && error.message && (error.message.includes("Server Components render") || error.message.includes("omitted in production builds"))) {
          description = `A server-side error occurred. Please check Vercel Function Logs. Digest: ${error.digest || 'N/A'}`;
        } else if (error && error.message) {
          description = error.message;
        }
        toast({
          title: 'Error Deleting Staff Member',
          description: description,
          variant: 'destructive',
        });
      }
    });
  };
  
  const staffStatusOptions: { status: StaffAttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'On Duty', label: 'On Duty', icon: UserCheck },
    { status: 'Off Duty', label: 'Off Duty', icon: UserX },
    { status: 'On Break', label: 'On Break', icon: Coffee },
    { status: 'Away', label: 'Away', icon: Plane },
  ];

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPending || isDeleting}>
            {isPending || isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            <span className="sr-only">Open menu for {staffMember.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions for {staffMember.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isPending || isDeleting}>
              <ChevronDown className="mr-2 h-4 w-4" />
              <span>Change Status</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {staffStatusOptions.map(opt => (
                  <DropdownMenuItem
                    key={opt.status}
                    onClick={() => handleMarkStatusClientSide(opt.status)}
                    disabled={isPending || isDeleting || staffMember.status === opt.status}
                    className={staffMember.status === opt.status ? "bg-accent/50 text-accent-foreground" : ""}
                  >
                    <opt.icon className="mr-2 h-4 w-4" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(staffMember)} disabled={isPending || isDeleting}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive hover:!text-destructive focus:!text-destructive focus:!bg-destructive/10" disabled={isPending || isDeleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Staff Member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {staffMember.name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
