
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Participant, AttendanceStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceStatusBadge } from '@/components/participants/AttendanceStatusBadge';
import { ParticipantForm } from '@/components/participants/ParticipantForm';
import { getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { ArrowLeft, Edit, Loader2, UserCircle, Info, StickyNote, CheckCircle, XCircle, Coffee, UserRound, Wrench, LogOutIcon, AlertOctagon, ChevronDown, BookUser, Mail, Phone, Landmark, GraduationCap, Globe, RefreshCw } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, getDoc, Timestamp as FirestoreTimestampType } from 'firebase/firestore';

export default function ParticipantProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === 'string' ? params.id : '';

  const [participant, setParticipant] = React.useState<Participant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false); // For status updates
  const [isLoadingSecondary, setIsLoadingSecondary] = React.useState(true); // For lazy loading

  const [isParticipantFormOpen, setIsParticipantFormOpen] = React.useState(false);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);


  const fetchParticipantData = React.useCallback(async (isInitialLoad = true) => {
    if (!id) {
      if(isInitialLoad) setIsLoading(false);
      toast({ title: "Error", description: "Participant ID is missing.", variant: "destructive" });
      router.push('/');
      return;
    }
    if(isInitialLoad) setIsLoading(true);
    
    try {
      const participantRef = doc(db, 'participants', id);
      const docSnap = await getDoc(participantRef);
      let participantData: Participant | null = null;
      if (docSnap.exists()) {
          const data = docSnap.data();
          participantData = {
            id: docSnap.id,
            name: data.name || '',
            school: data.school || '',
            committee: data.committee || '',
            country: data.country,
            status: data.status || 'Absent',
            imageUrl: data.imageUrl,
            // Lazily loaded fields are initially omitted or set to null
            notes: data.notes || '', // Still get initial value if present
            additionalDetails: data.additionalDetails || '', // Still get initial value
            classGrade: data.classGrade,
            email: data.email,
            phone: data.phone,
            attended: data.attended || false,
            checkInTime: data.checkInTime instanceof FirestoreTimestampType ? data.checkInTime.toDate().toISOString() : (data.checkInTime || null),
            createdAt: data.createdAt instanceof FirestoreTimestampType ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof FirestoreTimestampType ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as Participant;
      }

      if (isInitialLoad) {
        const [systemSchools, systemCommittees] = await Promise.all([
          getSystemSchools(),
          getSystemCommittees(),
        ]);
        setSchools(systemSchools.filter(s => s !== 'All Schools'));
        setCommittees(systemCommittees.filter(c => c !== 'All Committees'));
      }

      if (participantData) {
        setParticipant(participantData);
      } else {
        toast({ title: "Not Found", description: "Participant data could not be found.", variant: "destructive" });
        router.push('/');
      }

    } catch (error: any) {
      console.error("Failed to fetch participant data:", error);
      toast({ title: "Error Fetching Data", description: error.message || "Failed to load participant data.", variant: "destructive" });
    } finally {
      if(isInitialLoad) setIsLoading(false);
    }
  }, [id, toast, router]);

  React.useEffect(() => {
    fetchParticipantData(true);
  }, [fetchParticipantData]);
  
  // Lazy load notes and additional details
  React.useEffect(() => {
      if (!id || !participant) return;

      const fetchSecondaryData = async () => {
          setIsLoadingSecondary(true);
          try {
              const participantRef = doc(db, 'participants', id);
              const docSnap = await getDoc(participantRef);
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  setParticipant(p => p ? ({
                      ...p,
                      notes: data.notes || '',
                      additionalDetails: data.additionalDetails || '',
                  }) : null);
              }
          } catch (error) {
              console.error("Failed to lazy load secondary participant data:", error);
              toast({ title: "Could not load details", description: "Failed to load notes and other details.", variant: 'default' });
          } finally {
              setIsLoadingSecondary(false);
          }
      };

      // Use a timeout to simulate loading for UX, or just fetch immediately
      const timer = setTimeout(fetchSecondaryData, 500); // 500ms delay before fetching
      return () => clearTimeout(timer);
  }, [id, participant?.id, toast]);


  const handleFormSubmitSuccess = () => {
    fetchParticipantData(false); // Re-fetch without full loading state
    setIsParticipantFormOpen(false);
  };

  const handleMarkAttendanceClientSide = async (status: AttendanceStatus) => {
    if (!participant) return;
    setIsSubmitting(true);
    try {
      const participantRef = doc(db, 'participants', participant.id);
      await updateDoc(participantRef, { status, updatedAt: serverTimestamp() });

      setParticipant(prev => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null);
      
      toast({
        title: 'Attendance Updated',
        description: `${participant.name}'s status set to ${status}.`,
      });
    } catch (error: any) {
      console.error("Client-side Error marking attendance on profile page: ", error);
      toast({
        title: 'Error Updating Attendance',
        description: error.message || 'An unknown error occurred while updating attendance.',
        variant: 'destructive',
      });
       fetchParticipantData(false); // Refresh data on error
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


  if (isLoading) { // Show full page skeleton only on initial load
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
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
          <Link href="/"><span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</span></Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-5xl">
      <Button asChild variant="outline" className="mb-6 hover:bg-accent transition-colors">
       <Link href="/"><span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</span></Link>
     </Button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <section aria-labelledby="participant-info-heading" className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
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
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Landmark className="mr-2 h-4 w-4 text-primary/70" />School:</span>
                <span className="text-right">{participant.school}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><BookUser className="mr-2 h-4 w-4 text-primary/70" />Committee:</span>
                <span className="text-right">{participant.committee}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Globe className="mr-2 h-4 w-4 text-primary/70" />Country:</span>
                <span className="text-right">{participant.country || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><GraduationCap className="mr-2 h-4 w-4 text-primary/70" />Class/Grade:</span>
                <span className="text-right">{participant.classGrade || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Mail className="mr-2 h-4 w-4 text-primary/70" />Email:</span>
                <span className="text-right break-all">{participant.email || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Phone className="mr-2 h-4 w-4 text-primary/70" />Phone:</span>
                <span className="text-right">{participant.phone || 'Not set'}</span>
              </div>
               <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Profile Created:</span>
                <span className="text-right">
                  {participant.createdAt && typeof participant.createdAt === 'string' && isValid(parseISO(participant.createdAt)) ? format(parseISO(participant.createdAt), 'PP p') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Last Updated:</span>
                <span className="text-right">
                  {participant.updatedAt && typeof participant.updatedAt === 'string' && isValid(parseISO(participant.updatedAt)) ? format(parseISO(participant.updatedAt), 'PP p') : 'N/A'}
                </span>
              </div>
              {participant.attended && participant.checkInTime && typeof participant.checkInTime === 'string' && isValid(parseISO(participant.checkInTime)) && (
                <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
                    <span className="font-medium">Checked In:</span>
                    <span className="text-right">{format(parseISO(participant.checkInTime), 'PPpp')}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-4 flex flex-col gap-2 border-t">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={isSubmitting || isLoading} aria-haspopup="true" aria-expanded="false" aria-label="Change attendance status">
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
                      onClick={() => handleMarkAttendanceClientSide(opt.status)}
                      disabled={isSubmitting || isLoading || participant.status === opt.status}
                      className={participant.status === opt.status ? "bg-accent/50 text-accent-foreground" : ""}
                      aria-label={`Mark as ${opt.label}`}
                    >
                      <opt.icon className="mr-2 h-4 w-4" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setIsParticipantFormOpen(true)} className="w-full" aria-label="Edit participant details" disabled={isLoading || isSubmitting}>
                <Edit className="mr-2 h-4 w-4" /> Edit Participant Details
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fetchParticipantData(false)}
                disabled={isLoading || isSubmitting}
                aria-label="Refresh participant data"
              >
                {isLoading && !isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh Data
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section aria-labelledby="participant-details-heading" className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <CardHeader>
              <CardTitle id="participant-notes-heading" className="flex items-center text-xl"><StickyNote className="mr-3 h-6 w-6 text-primary" />Participant Notes</CardTitle>
              <CardDescription>Private notes and observations about the participant.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSecondary ? <Skeleton className="h-20 w-full" /> : participant.notes ? (
                <p className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-md min-h-[80px]">{participant.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-md min-h-[80px]">No notes recorded for this participant.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <CardHeader>
              <CardTitle id="participant-additional-details-heading" className="flex items-center text-xl"><Info className="mr-3 h-6 w-6 text-primary" />Additional Details</CardTitle>
              <CardDescription>Other relevant information.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSecondary ? <Skeleton className="h-20 w-full" /> : participant.additionalDetails ? (
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
