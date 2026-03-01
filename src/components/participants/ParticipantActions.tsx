
'use client';

import type { Participant, AttendanceStatus } from '@/types';
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
  Edit3, Trash2, MoreHorizontal, CheckCircle, XCircle, 
  AlertOctagon,
  ChevronDown, Coffee, UserRound,
  Wrench, LogOutIcon, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Removed: import { deleteParticipant } from '@/lib/actions'; 
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

interface ParticipantActionsProps {
  participant: Participant;
  onEdit: (participant: Participant) => void;
}

export function ParticipantActions({ participant, onEdit }: ParticipantActionsProps) {
  const { toast } = useToast();
  const { staffMember, userAppRole, permissions } = useAuth();
  const router = useRouter();
  const [isUpdatingStatus, startStatusUpdateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleMarkAttendanceClientSide = async (status: AttendanceStatus) => {
    startStatusUpdateTransition(async () => {
      try {
        const { error } = await supabase
          .from('participants')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', participant.id);

        if (error) throw error;

        toast({
          title: 'Attendance Updated',
          description: `${participant.name}'s status set to ${status}.`,
        });
        router.refresh(); 
      } catch (error: any) {
        console.error("Client-side Error marking attendance: ", error);
        toast({
          title: 'Error Updating Attendance',
          description: error.message || 'An unknown error occurred client-side.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDeleteClientSide = async () => {
    startDeleteTransition(async () => {
      try {
        const { error } = await supabase
          .from('participants')
          .delete()
          .eq('id', participant.id);

        if (error) throw error;

        toast({
          title: 'Participant Deleted',
          description: `${participant.name} has been removed.`,
        });
        setIsDeleteDialogOpen(false);
        router.refresh(); 
      } catch (error: any) {
        console.error("Client-side Error deleting participant: ", error);
        toast({
          title: 'Error Deleting Participant',
          description: error.message || 'An unknown error occurred while deleting participant.',
          variant: 'destructive',
        });
      }
    });
  };
  
  const attendanceOptions: { status: AttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'Present', label: 'Present', icon: CheckCircle },
    { status: 'Absent', label: 'Absent', icon: XCircle },
    { status: 'Present On Account', label: 'Present (On Account)', icon: AlertOctagon },
    { status: 'In Break', label: 'In Break', icon: Coffee },
    { status: 'Restroom Break', label: 'Restroom Break', icon: UserRound },
    { status: 'Technical Issue', label: 'Technical Issue', icon: Wrench },
    { status: 'Stepped Out', label: 'Stepped Out', icon: LogOutIcon },
  ];

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isUpdatingStatus || isDeleting}>
            {(isUpdatingStatus || isDeleting) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            <span className="sr-only">Open menu for {participant.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Actions for {participant.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isUpdatingStatus || isDeleting || !(userAppRole === 'owner' || userAppRole === 'admin' || staffMember?.permissions?.canEditParticipantStatus)}>
              <ChevronDown className="mr-2 h-4 w-4" />
              <span>Mark Attendance</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {attendanceOptions.map(opt => (
                  <DropdownMenuItem
                    key={opt.status}
                    onClick={() => handleMarkAttendanceClientSide(opt.status)}
                    disabled={isUpdatingStatus || isDeleting || participant.status === opt.status}
                    className={participant.status === opt.status ? "bg-accent/50 text-accent-foreground" : ""}
                  >
                    <opt.icon className="mr-2 h-4 w-4" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(participant)} disabled={isUpdatingStatus || isDeleting || !(userAppRole === 'owner' || (userAppRole === 'admin' && permissions?.canEditParticipants) || staffMember?.permissions?.canEditParticipants)}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setIsDeleteDialogOpen(true)} 
            className="text-destructive hover:!text-destructive focus:!text-destructive focus:!bg-destructive/10" 
            disabled={isUpdatingStatus || isDeleting || !(userAppRole === 'owner' || (userAppRole === 'admin' && permissions?.canDeleteParticipants))}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Participant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {participant.name}? 
              This action cannot be undone and will remove their data from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteClientSide} 
              disabled={isDeleting} 
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
