
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
  Edit3, Trash2, MoreHorizontal, CheckCircle, XCircle, Coffee, ChevronDown, UserCheck, UserX, Briefcase, Plane
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { markStaffMemberStatus, deleteStaffMember } from '@/lib/actions';
import { useState, useTransition } from 'react';

interface StaffMemberActionsProps {
  staffMember: StaffMember;
  onEdit: (staffMember: StaffMember) => void;
}

export function StaffMemberActions({ staffMember, onEdit }: StaffMemberActionsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleMarkStatus = async (status: StaffAttendanceStatus) => {
    startTransition(async () => {
      try {
        await markStaffMemberStatus(staffMember.id, status);
        toast({
          title: 'Status Updated',
          description: `${staffMember.name}'s status set to ${status}.`,
        });
      } catch (error: any) {
        toast({
          title: 'Error Updating Status',
          description: error.message || 'An unknown error occurred while updating staff status.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      try {
        await deleteStaffMember(staffMember.id);
        toast({
          title: 'Staff Member Deleted',
          description: `${staffMember.name} has been removed.`,
        });
        setIsDeleteDialogOpen(false);
      } catch (error: any) {
        toast({
          title: 'Error Deleting Staff Member',
          description: error.message || 'An unknown error occurred while deleting staff member.',
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
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu for {staffMember.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions for {staffMember.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ChevronDown className="mr-2 h-4 w-4" />
              <span>Change Status</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {staffStatusOptions.map(opt => (
                  <DropdownMenuItem
                    key={opt.status}
                    onClick={() => handleMarkStatus(opt.status)}
                    disabled={isPending || staffMember.status === opt.status}
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
          <DropdownMenuItem onClick={() => onEdit(staffMember)} disabled={isPending}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive hover:!text-destructive focus:!text-destructive focus:!bg-destructive/10" disabled={isPending}>
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
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
              {isPending ? 'Deleting...' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
