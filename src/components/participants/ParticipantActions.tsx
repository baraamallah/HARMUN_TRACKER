
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
  AlertOctagon, // Changed from AlertCircle for 'Present On Account'
  ChevronDown, Coffee, UserRound, // Changed from PersonStanding for 'Restroom Break'
  Wrench, LogOutIcon, // Changed from DoorOpen for 'Stepped Out'
  HelpCircle // For default/unknown status if needed, or can be omitted
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { markAttendance, deleteParticipant } from '@/lib/actions';
import { useState, useTransition } from 'react';

interface ParticipantActionsProps {
  participant: Participant;
  onEdit: (participant: Participant) => void;
}

export function ParticipantActions({ participant, onEdit }: ParticipantActionsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleMarkAttendance = async (status: AttendanceStatus) => {
    startTransition(async () => {
      try {
        await markAttendance(participant.id, status);
        toast({
          title: 'Attendance Updated',
          description: `${participant.name}'s status set to ${status}.`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update attendance.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      try {
        await deleteParticipant(participant.id);
        toast({
          title: 'Participant Deleted',
          description: `${participant.name} has been removed.`,
        });
        setIsDeleteDialogOpen(false);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete participant.',
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
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60"> {/* Increased width slightly for potentially longer labels */}
          <DropdownMenuLabel>Actions for {participant.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ChevronDown className="mr-2 h-4 w-4" />
              <span>Mark Attendance</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {attendanceOptions.map(opt => (
                  <DropdownMenuItem
                    key={opt.status}
                    onClick={() => handleMarkAttendance(opt.status)}
                    disabled={isPending || participant.status === opt.status}
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
          <DropdownMenuItem onClick={() => onEdit(participant)} disabled={isPending}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive hover:!text-destructive focus:!text-destructive focus:!bg-destructive/10" disabled={isPending}>
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
