
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Home, UserCircleIcon, RefreshCw, ListRestart, Edit3, Coffee, AlertOctagon, Wrench, LogOutIcon } from 'lucide-react'; // More specific icons
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/shared/Logo';
import Link from 'next/link';
import { quickSetParticipantStatusAction } from '@/lib/actions'; 
import type { Participant, AttendanceStatus, ActionResult } from '@/types'; 
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp as FirestoreTimestampType } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';

const ALL_ATTENDANCE_STATUSES_OPTIONS: { status: AttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'Present', label: 'Present', icon: CheckCircle },
    { status: 'Absent', label: 'Absent', icon: XCircle },
    { status: 'Present On Account', label: 'Present (On Account)', icon: AlertOctagon },
    { status: 'In Break', label: 'In Break', icon: Coffee },
    { status: 'Restroom Break', label: 'Restroom Break', icon: UserCircleIcon },
    { status: 'Technical Issue', label: 'Technical Issue', icon: Wrench },
    { status: 'Stepped Out', label: 'Stepped Out', icon: LogOutIcon },
];

function CheckinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const participantId = searchParams.get('id');

  const [participant, setParticipant] = React.useState<Participant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionInProgress, setActionInProgress] = React.useState<AttendanceStatus | 'initial_load' | null>(null);
  const [pageError, setPageError] = React.useState<string | null>(null); // Renamed from errorMessage for clarity

  const fetchParticipantData = React.useCallback(async (id: string) => {
    setIsLoading(true);
    setPageError(null);
    setActionInProgress('initial_load');
    try {
      const participantRef = doc(db, 'participants', id);
      const docSnap = await getDoc(participantRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedParticipant = {
            id: docSnap.id,
            name: data.name || '',
            school: data.school || '',
            committee: data.committee || '',
            status: data.status || 'Absent',
            imageUrl: data.imageUrl,
            attended: data.attended || false,
            checkInTime: data.checkInTime instanceof FirestoreTimestampType ? data.checkInTime.toDate().toISOString() : data.checkInTime,
            createdAt: data.createdAt instanceof FirestoreTimestampType ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof FirestoreTimestampType ? data.updatedAt.toDate().toISOString() : data.updatedAt,
            // include other fields if needed by this page, e.g. notes, additionalDetails
        } as Participant;
        setParticipant(fetchedParticipant);
      } else {
        setPageError(`Participant with ID "${id}" not found.`);
        setParticipant(null);
        toast({ title: "Not Found", description: `Participant ID "${id}" not found.`, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error fetching participant (client-side for QR page):", error);
      setPageError("Failed to load participant data. Please check the console and try again.");
      toast({ title: "Error Loading Data", description: "Could not retrieve participant details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
    }
  }, [toast]);

  React.useEffect(() => {
    if (participantId) {
      fetchParticipantData(participantId);
    } else {
      setPageError("No Participant ID provided in the URL.");
      setIsLoading(false);
      toast({ title: "Missing ID", description: "No Participant ID specified in URL.", variant: "destructive" });
    }
  }, [participantId, fetchParticipantData, toast]);

  const handleStatusUpdate = async (newStatus: AttendanceStatus, isCheckInIntent?: boolean) => {
    if (!participant) return;
    setActionInProgress(newStatus); // To disable the specific button being processed
    setPageError(null);

    const result: ActionResult = await quickSetParticipantStatusAction(participant.id, newStatus, { isCheckIn: isCheckInIntent });

    if (result.success && result.participant) {
      setParticipant(result.participant); 
      toast({
        title: 'Status Updated Successfully',
        description: result.message,
        className: 'bg-green-100 dark:bg-green-900 border-green-500'
      });
    } else {
      setPageError(result.message);
      toast({
        title: 'Update Failed',
        description: result.message,
        variant: 'destructive',
      });
      // Re-fetch data on failure to ensure UI consistency with DB state
      if (participantId) fetchParticipantData(participantId);
    }
    setActionInProgress(null);
  };

  const getStatusBadgeStyling = (status: AttendanceStatus): string => {
    switch (status) {
        case 'Present': return 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900/50 dark:text-green-300 dark:border-green-600';
        case 'Absent': return 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/50 dark:text-red-300 dark:border-red-600';
        case 'Present On Account': return 'bg-blue-100 text-blue-700 border-blue-400 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-600';
        case 'In Break': case 'Restroom Break': return 'bg-yellow-100 text-yellow-700 border-yellow-400 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-600';
        default: return 'bg-gray-100 text-gray-700 border-gray-400 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-500';
    }
  };
  
  const cardBorderColor = participant?.status === 'Present' ? 'border-green-500' : participant?.status === 'Absent' ? 'border-red-500' : 'border-primary';

  if (isLoading && actionInProgress === 'initial_load') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className={cn("w-full max-w-md shadow-xl border-t-8", cardBorderColor)}>
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-xl text-muted-foreground">Loading Participant Data...</p>
            {participantId && <p className="text-sm text-muted-foreground">ID: {participantId}</p>}
          </CardContent>
          <CardFooter className="flex-col gap-3 pb-8">
             <Button asChild className="w-full" variant="outline" disabled><Link href="/"><Home className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (pageError && !participant) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-destructive">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <XCircle className="h-16 w-16 text-destructive" />
            <p className="text-xl font-semibold text-destructive">Error</p>
            <p className="text-md text-muted-foreground">{pageError}</p>
            {participantId && <p className="text-sm text-muted-foreground">Attempted ID: {participantId}</p>}
            <Button variant="outline" onClick={() => participantId && fetchParticipantData(participantId)} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
          <CardFooter className="flex-col gap-3 pb-8"><Button asChild className="w-full" variant="outline"><Link href="/"><Home className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button></CardFooter>
        </Card>
      </div>
    );
  }

  if (!participant) { // Fallback if still no participant and not loading/error state
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-yellow-500">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <AlertTriangle className="h-16 w-16 text-yellow-500" />
            <p className="text-xl text-muted-foreground">Participant data unavailable or ID missing.</p>
            <Button variant="outline" onClick={() => router.push('/')}> <Home className="mr-2 h-4 w-4" /> Go to Dashboard </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      <Card className={cn("w-full max-w-lg shadow-xl border-t-8 transition-colors duration-300", cardBorderColor)}>
        <CardHeader className="items-center text-center pt-8">
            <div className="mb-4"><Logo size="lg"/></div>
            <Avatar className="h-28 w-28 mb-4 border-4" style={{ borderColor: 'hsl(var(--primary))' }}>
                <AvatarImage src={participant.imageUrl} alt={participant.name} data-ai-hint="person avatar large" />
                <AvatarFallback className="text-4xl">{participant.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
          <CardTitle className="text-3xl font-bold tracking-tight">{participant.name}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            {participant.school} &bull; {participant.committee}
          </CardDescription>
           <div className="mt-4">
            <Badge variant="outline" className={cn("text-lg px-4 py-2 rounded-md font-semibold", getStatusBadgeStyling(participant.status))}>
                Current Status: {participant.status}
            </Badge>
           </div>
           {participant.attended && participant.checkInTime && (
             <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                Checked In: {isValid(parseISO(participant.checkInTime as string)) ? format(parseISO(participant.checkInTime as string), 'PPpp') : 'Previously'}
             </p>
           )}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-3 text-center py-6 px-6">
            {pageError && (
                <p className="text-red-600 dark:text-red-400 text-sm mb-2 bg-red-100 dark:bg-red-900/30 p-2 rounded-md">{pageError}</p>
            )}
            <Button
                onClick={() => handleStatusUpdate('Present', true)}
                disabled={!!actionInProgress || participant.status === 'Present'}
                className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white text-md py-5"
                size="lg"
            >
                {actionInProgress === 'Present' ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CheckCircle className="mr-2 h-5 w-5" />}
                Check In (Mark Present)
            </Button>
            <Button
                onClick={() => handleStatusUpdate('Absent')}
                disabled={!!actionInProgress || participant.status === 'Absent'}
                variant="destructive"
                className="w-full text-md py-5"
                size="lg"
            >
                {actionInProgress === 'Absent' ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <XCircle className="mr-2 h-5 w-5" />}
                Mark as Absent
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full text-md py-5" size="lg" disabled={!!actionInProgress}>
                        {actionInProgress && actionInProgress !== 'initial_load' && actionInProgress !== 'Present' && actionInProgress !== 'Absent' 
                          ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> 
                          : <ListRestart className="mr-2 h-5 w-5" />}
                        Update Other Status...
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-[calc(100%-2rem)] max-w-sm mx-auto sm:w-72">
                    {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => (
                        <DropdownMenuItem
                            key={opt.status}
                            onClick={() => handleStatusUpdate(opt.status, opt.status === 'Present')}
                            disabled={!!actionInProgress || participant.status === opt.status}
                            className={cn("text-md py-3", participant.status === opt.status && "bg-accent text-accent-foreground focus:bg-accent focus:text-accent-foreground")}
                        >
                            <opt.icon className="mr-3 h-5 w-5" />
                            {opt.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </CardContent>
        <CardFooter className="flex-col gap-3 pb-6 px-6 border-t pt-6 mt-2">
            <Button onClick={() => participantId && fetchParticipantData(participantId)} variant="ghost" className="w-full text-muted-foreground hover:text-primary" disabled={!!actionInProgress}>
                <RefreshCw className="mr-2 h-4 w-4"/> Refresh Participant Data
            </Button>
            <div className="flex w-full gap-2">
                <Button asChild className="flex-1" variant="secondary">
                    <Link href="/"> <Home className="mr-2 h-4 w-4"/> Dashboard </Link>
                </Button>
                <Button asChild className="flex-1" variant="outline">
                    <Link href={`/participants/${participantId}`}> <Edit3 className="mr-2 h-4 w-4"/> Full Profile </Link>
                </Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function CheckinPage() {
  return (
    <React.Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-primary">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-xl text-muted-foreground">Loading QR Action Page...</p>
          </CardContent>
           <CardFooter className="flex-col gap-3 pb-8">
             <Button asChild className="w-full" variant="outline" disabled><Link href="/"><Home className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    }>
      <CheckinPageContent />
    </React.Suspense>
  );
}
