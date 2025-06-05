
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getParticipantById, markAttendance as serverMarkAttendance } from '@/lib/actions';
import type { Participant, AttendanceStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AttendanceStatusBadge } from '@/components/participants/AttendanceStatusBadge';
import { ParticipantForm } from '@/components/participants/ParticipantForm'; // Import the form
import { getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { ArrowLeft, Edit, Loader2, UserCircle, Info, StickyNote, CalendarDays, CheckCircle, XCircle, Coffee, UserRound, Wrench, LogOutIcon, AlertOctagon, ChevronDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { db } from '@/lib/firebase'; // For client-side updates
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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


export default function ParticipantProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === 'string' ? params.id : '';

  const [participant, setParticipant] = React.useState<Participant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [isParticipantFormOpen, setIsParticipantFormOpen] = React.useState(false);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);


  const fetchParticipantData = React.useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      toast({ title: "Error", description: "Participant ID is missing.", variant: "destructive" });
      router.push('/'); 
      return;
    }
    setIsLoading(true);
    try {
      const [participantData, systemSchools, systemCommittees] = await Promise.all([
        getParticipantById(id),
        getSystemSchools(),
        getSystemCommittees(),
      ]);

      if (participantData) {
        setParticipant(participantData);
      } else {
        toast({ title: "Not Found", description: "Participant data could not be found.", variant: "destructive" });
        router.push('/'); 
      }
      setSchools(systemSchools.filter(s => s !== 'All Schools'));
      setCommittees(systemCommittees.filter(c => c !== 'All Committees'));

    } catch (error) {
      console.error("Failed to fetch participant data:", error);
      toast({ title: "Error", description: "Failed to load participant data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast, router]);

  React.useEffect(() => {
    fetchParticipantData();
  }, [fetchParticipantData]);
  
  const handleFormSubmitSuccess = () => {
    fetchParticipantData(); 
    setIsParticipantFormOpen(false); 
  };

  const handleMarkAttendance = async (status: AttendanceStatus) => {
    if (!participant) return;
    setIsSubmitting(true);
    try {
      // Prefer server action for revalidation if possible, fallback to client update if needed
      const updatedParticipant = await serverMarkAttendance(participant.id, status);
      if (updatedParticipant) {
         setParticipant(updatedParticipant); // Update with fresh data from server
      } else {
        // Fallback: update client state optimistically if server action returns null or fails subtly
        setParticipant(prev => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null);
      }
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
       // Optionally re-fetch to ensure data consistency on error
       fetchParticipantData();
    } finally {
      setIsSubmitting(false);
    }
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


  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <UserCircle className="h-32 w-32 mx-auto text-muted-foreground mb-4" data-ai-hint="error user" />
        <h1 className="text-2xl font-bold">Participant Not Found</h1>
        <p className="text-muted-foreground mb-6">The participant you are looking for does not exist or could not be loaded.</p>
        <Button asChild variant="outline">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
        </Button>
      </div>
    );
  }
  
  const displayBirthday = participant.birthday && isValid(parseISO(participant.birthday)) 
    ? format(parseISO(participant.birthday), 'MMMM d, yyyy') 
    : 'Not set';

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-5xl">
       <Button asChild variant="outline" className="mb-6">
        <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <section aria-labelledby="participant-info-heading" className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="items-center text-center p-6">
              <Avatar className="h-32 w-32 border-4 border-primary mb-4 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                <AvatarImage src={participant.imageUrl} alt={`${participant.name}'s avatar`} data-ai-hint="person avatar large" />
                <AvatarFallback className="text-4xl">{participant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <CardTitle id="participant-info-heading" className="text-3xl font-bold">{participant.name}</CardTitle>
              <div className="mt-2">
                <AttendanceStatusBadge status={participant.status} />
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-3 px-6 pb-6">
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">School:</span>
                <span className="text-right">{participant.school}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Committee:</span>
                <span className="text-right">{participant.committee}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Birthday:</span>
                <span className="text-right">{displayBirthday}</span>
              </div>
               <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Profile Created:</span>
                <span className="text-right text-xs">
                  {participant.createdAt && isValid(parseISO(participant.createdAt as string)) ? format(parseISO(participant.createdAt as string), 'PPpp') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Last Updated:</span>
                <span className="text-right text-xs">
                  {participant.updatedAt && isValid(parseISO(participant.updatedAt as string)) ? format(parseISO(participant.updatedAt as string), 'PPpp') : 'N/A'}
                </span>
              </div>
            </CardContent>
            <CardFooter className="p-4 flex flex-col gap-2">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={isSubmitting} aria-haspopup="true" aria-expanded="false" aria-label="Change attendance status">
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Change Attendance Status
                    {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-60">
                  <DropdownMenuLabel>Mark Attendance</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {attendanceOptions.map(opt => (
                    <DropdownMenuItem
                      key={opt.status}
                      onClick={() => handleMarkAttendance(opt.status)}
                      disabled={isSubmitting || participant.status === opt.status}
                      className={participant.status === opt.status ? "bg-accent/50 text-accent-foreground" : ""}
                      aria-label={`Mark as ${opt.label}`}
                    >
                      <opt.icon className="mr-2 h-4 w-4" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setIsParticipantFormOpen(true)} className="w-full" aria-label="Edit participant details">
                <Edit className="mr-2 h-4 w-4" /> Edit Participant Details
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section aria-labelledby="participant-details-heading" className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle id="participant-notes-heading" className="flex items-center text-xl"><StickyNote className="mr-3 h-6 w-6 text-primary" />Participant Notes</CardTitle>
              <CardDescription>Private notes and observations about the participant.</CardDescription>
            </CardHeader>
            <CardContent>
              {participant.notes ? (
                <p className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-md min-h-[80px]">{participant.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-md min-h-[80px]">No notes recorded for this participant.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle id="participant-additional-details-heading" className="flex items-center text-xl"><Info className="mr-3 h-6 w-6 text-primary" />Additional Details</CardTitle>
              <CardDescription>Other relevant information.</CardDescription>
            </CardHeader>
            <CardContent>
               {participant.additionalDetails ? (
                <p className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-md min-h-[80px]">{participant.additionalDetails}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-md min-h-[80px]">No additional details provided.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <ParticipantForm
        isOpen={isParticipantFormOpen}
        onOpenChange={setIsParticipantFormOpen}
        participantToEdit={participant}
        schools={schools}
        committees={committees}
        onFormSubmitSuccess={handleFormSubmitSuccess}
      />
    </div>
  );
}
