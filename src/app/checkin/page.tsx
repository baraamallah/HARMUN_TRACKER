
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Home, UserCircleIcon, RefreshCw, ListRestart, Edit3, Coffee, AlertOctagon, Wrench, LogOutIcon, UserSearch } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/Logo';
import Link from 'next/link';
// Removed: import { quickSetParticipantStatusAction } from '@/lib/actions';
import type { Participant, AttendanceStatus, ActionResult } from '@/types';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp as FirestoreTimestampType, FieldValue } from 'firebase/firestore'; // Added FieldValue
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

const ownerContactInfo = "If the problem persists, please contact the owner: baraa.elmallah@gmail.com or +961 76 791 088.";


function CheckinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [effectiveParticipantId, setEffectiveParticipantId] = React.useState<string | null>(null);
  const [participant, setParticipant] = React.useState<Participant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionInProgress, setActionInProgress] = React.useState<AttendanceStatus | 'initial_load' | null>(null);
  const [pageError, setPageError] = React.useState<string | null>(null);

  const [manualIdInput, setManualIdInput] = React.useState('');
  const [isManualLookupLoading, setIsManualLookupLoading] = React.useState(false);

  React.useEffect(() => {
    const idFromParams = searchParams.get('id');
    setEffectiveParticipantId(idFromParams); 
  }, [searchParams]);


  const fetchParticipantData = React.useCallback(async (id: string) => {
    if (!id) {
      setIsLoading(false);
      setActionInProgress(null);
      setParticipant(null);
      return;
    }
    setIsLoading(true); 
    setActionInProgress('initial_load');
    setPageError(null);
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
            checkInTime: data.checkInTime instanceof FirestoreTimestampType ? data.checkInTime.toDate().toISOString() : (data.checkInTime || null),
            createdAt: data.createdAt instanceof FirestoreTimestampType ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof FirestoreTimestampType ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as Participant;
        setParticipant(fetchedParticipant);
      } else {
        setPageError(`Participant with ID "${id}" not found.`);
        setParticipant(null);
        toast({ title: "Not Found", description: `Participant ID "${id}" not found.`, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error fetching participant (client-side for QR/Manual page):", error);
      setPageError("Failed to load participant data. Please try again.");
      toast({ title: "Error Loading Data", description: "Could not retrieve participant details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
      setIsManualLookupLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (effectiveParticipantId) {
      fetchParticipantData(effectiveParticipantId);
    } else {
      setIsLoading(false);
      setActionInProgress(null);
      setParticipant(null);
    }
  }, [effectiveParticipantId, fetchParticipantData]);


  const handleStatusUpdate = async (newStatus: AttendanceStatus, isCheckInIntent?: boolean) => {
    if (!participant) return { success: false, message: 'Participant data not loaded.', errorType: 'internal_error' };
    setActionInProgress(newStatus);
    setPageError(null);

    let result: ActionResult;

    try {
      const participantRef = doc(db, 'participants', participant.id);
      const updates: { status: AttendanceStatus; updatedAt: FieldValue; attended?: boolean; checkInTime?: FieldValue | null } = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (isCheckInIntent && newStatus === 'Present') {
        updates.attended = true;
        if (!participant.attended || !participant.checkInTime) {
          updates.checkInTime = serverTimestamp();
        }
      }
      
      await updateDoc(participantRef, updates);

      // Fetch updated data to reflect server-generated timestamps
      const updatedSnap = await getDoc(participantRef);
      if (updatedSnap.exists()) {
        const data = updatedSnap.data();
        const updatedParticipant: Participant = {
          id: updatedSnap.id,
          name: data.name || '',
          school: data.school || '',
          committee: data.committee || '',
          country: data.country || '',
          status: data.status || 'Absent',
          imageUrl: data.imageUrl,
          attended: data.attended || false,
          checkInTime: data.checkInTime instanceof FirestoreTimestampType ? data.checkInTime.toDate().toISOString() : data.checkInTime,
          createdAt: data.createdAt instanceof FirestoreTimestampType ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof FirestoreTimestampType ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
        setParticipant(updatedParticipant);
        result = {
          success: true,
          message: `Status for ${updatedParticipant.name} updated to ${newStatus}.`,
          participant: updatedParticipant,
        };
        toast({
          title: 'Status Updated Successfully',
          description: result.message,
          className: 'bg-green-100 dark:bg-green-900 border-green-500'
        });
      } else {
        throw new Error("Failed to re-fetch participant after update.");
      }
    } catch (error: any) {
      console.error(`[Client-Side Error] Updating participant ${participant.id} to ${newStatus}:`, error);
      let message = 'An error occurred while updating participant status. Please try again.';
      let errorType = 'generic_error';
      if (error.code === 'permission-denied') {
        message = `PERMISSION_DENIED: Could not update participant status. Ensure you are logged in and have permission.`;
        errorType = 'permission_denied';
      } else if (error.code) {
        message = `Update failed. Error: ${error.code}.`;
        errorType = error.code;
      }
      result = {
        success: false,
        message: message,
        errorType: errorType,
      };
      setPageError(result.message);
      toast({
        title: 'Update Failed',
        description: result.message,
        variant: 'destructive',
      });
      // Attempt to refetch original data on failure to ensure consistency
      if (effectiveParticipantId) fetchParticipantData(effectiveParticipantId);
    } finally {
      setActionInProgress(null);
    }
    return result;
  };

  const handleManualLookup = () => {
    if (!manualIdInput.trim()) {
      toast({ title: "ID Required", description: "Please enter a participant ID.", variant: "destructive" });
      return;
    }
    setIsManualLookupLoading(true);
    router.push(`/checkin?id=${manualIdInput.trim()}`);
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className={cn("w-full max-w-md shadow-xl border-t-8", cardBorderColor || 'border-primary')}>
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-xl text-muted-foreground">Loading Participant Data...</p>
            {effectiveParticipantId && actionInProgress === 'initial_load' && <p className="text-sm text-muted-foreground">ID: {effectiveParticipantId}</p>}
          </CardContent>
          <CardFooter className="flex-col gap-3 pb-8">
             <Button asChild className="w-full" variant="outline" disabled><Link href="/"><Home className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!isLoading && !effectiveParticipantId && !pageError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
          <CardHeader className="text-center pt-8">
            <div className="mb-6 flex justify-center">
              <Logo size="lg" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Manual Participant Lookup</CardTitle>
            <CardDescription className="text-md text-muted-foreground">
              Enter a participant ID to manage their status.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="manual-participant-id">Participant ID</Label>
              <Input
                id="manual-participant-id"
                placeholder="Enter participant ID here"
                value={manualIdInput}
                onChange={(e) => setManualIdInput(e.target.value)}
                disabled={isManualLookupLoading}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isManualLookupLoading) handleManualLookup(); }}
              />
            </div>
            <Button onClick={handleManualLookup} className="w-full py-3 text-base" disabled={isManualLookupLoading || !manualIdInput.trim()}>
              {isManualLookupLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserSearch className="mr-2 h-5 w-5" />}
              Find Participant
            </Button>
          </CardContent>
          <CardFooter className="flex-col items-center gap-3 pb-8 text-sm">
            <p className="text-muted-foreground">
              Alternatively, scan a participant's QR code.
            </p>
            <Button asChild className="w-full mt-2" variant="outline">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" /> Go to Dashboard
              </Link>
            </Button>
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
            {effectiveParticipantId && <p className="text-sm text-muted-foreground">Attempted ID: {effectiveParticipantId}</p>}
            <p className="text-xs text-muted-foreground mt-2">{ownerContactInfo}</p>
            <div className="flex flex-col gap-2 w-full mt-4">
              <Button variant="outline" onClick={() => effectiveParticipantId && fetchParticipantData(effectiveParticipantId)} disabled={isLoading || !!actionInProgress && actionInProgress !== 'initial_load'}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry Lookup for ID: {effectiveParticipantId}
              </Button>
              <Button variant="secondary" onClick={() => router.push('/checkin')}>
                <UserSearch className="mr-2 h-4 w-4" /> Try Manual Lookup
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3 pb-8 pt-4 border-t">
            <Button asChild className="w-full" variant="outline"><Link href="/"><Home className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!participant && effectiveParticipantId) { 
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-yellow-500">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <AlertTriangle className="h-16 w-16 text-yellow-500" />
            <p className="text-xl text-muted-foreground">Participant data unavailable for ID: {effectiveParticipantId}.</p>
             <p className="text-xs text-muted-foreground mt-2">{ownerContactInfo}</p>
            <Button variant="outline" onClick={() => router.push('/checkin')} className="mt-4"> <UserSearch className="mr-2 h-4 w-4" /> Try Manual Lookup </Button>
          </CardContent>
           <CardFooter className="flex-col gap-3 pb-8 pt-4 border-t">
            <Button asChild className="w-full" variant="outline"><Link href="/"><Home className="mr-2 h-4 w-4"/>Go to Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!participant) {
    if (!effectiveParticipantId) { 
         router.replace('/checkin'); 
         return null;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-yellow-500">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <AlertTriangle className="h-16 w-16 text-yellow-500" />
             <p className="text-xl text-muted-foreground">Unexpected state. Participant data missing for ID: {effectiveParticipantId}.</p>
             <p className="text-xs text-muted-foreground mt-2">{ownerContactInfo}</p>
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
                <p className="text-red-600 dark:text-red-400 text-sm mb-2 bg-red-100 dark:bg-red-900/30 p-2 rounded-md">
                  {pageError}
                  <span className="block mt-1 text-xs">{ownerContactInfo}</span>
                </p>
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
                variant="outline"
                className="w-full text-md py-5"
                size="lg"
            >
                {actionInProgress === 'Absent' && (!participant || participant.status !== 'Present') ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <LogOutIcon className="mr-2 h-5 w-5" />}
                Check Out (Mark Absent)
            </Button>
            <Button
                onClick={() => handleStatusUpdate('Absent')}
                disabled={!!actionInProgress || participant.status === 'Absent'}
                variant="destructive"
                className="w-full text-md py-5"
                size="lg"
            >
                {actionInProgress === 'Absent' && (!participant || participant.status === 'Present') ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <XCircle className="mr-2 h-5 w-5" />}
                Mark as Absent (Force)
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
            <Button onClick={() => effectiveParticipantId && fetchParticipantData(effectiveParticipantId)} variant="ghost" className="w-full text-muted-foreground hover:text-primary" disabled={!!actionInProgress}>
                <RefreshCw className="mr-2 h-4 w-4"/> Refresh Participant Data
            </Button>
             <Button variant="secondary" onClick={() => router.push('/checkin')} className="w-full">
                <UserSearch className="mr-2 h-4 w-4" /> Lookup Another Participant
            </Button>
            <div className="flex w-full gap-2">
                <Button asChild className="flex-1" variant="outline">
                    <Link href="/"> <Home className="mr-2 h-4 w-4"/> Dashboard </Link>
                </Button>
                {effectiveParticipantId && (
                    <Button asChild className="flex-1" variant="outline">
                        <Link href={`/participants/${effectiveParticipantId}`}> <Edit3 className="mr-2 h-4 w-4"/> Full Profile </Link>
                    </Button>
                )}
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

        