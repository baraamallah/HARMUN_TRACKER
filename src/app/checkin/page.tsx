
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/shared/Logo';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Participant } from '@/types';

export default function CheckinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const participantId = searchParams.get('id');

  const [isLoading, setIsLoading] = React.useState(true);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [participantName, setParticipantName] = React.useState<string | null>(null);
  const [checkInDetails, setCheckInDetails] = React.useState<string | null>(null);
  const [errorType, setErrorType] = React.useState<'not_found' | 'already_checked_in' | 'generic_error' | null>(null);

  const processCheckin = React.useCallback(async () => {
    if (!participantId) {
      setStatusMessage('Participant ID missing in URL.');
      setErrorType('generic_error');
      setIsLoading(false);
      toast({ title: 'Error', description: 'Participant ID missing.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setErrorType(null);
    setStatusMessage(null);
    setParticipantName(null);
    setCheckInDetails(null);

    try {
      const participantRef = doc(db, 'participants', participantId);
      const participantSnap = await getDoc(participantRef);

      if (!participantSnap.exists()) {
        setStatusMessage(`Participant with ID "${participantId}" not found.`);
        setErrorType('not_found');
        toast({ title: 'Check-in Failed', description: 'Participant not found.', variant: 'destructive' });
      } else {
        const participantData = participantSnap.data() as Participant; // Assuming Participant type structure
        setParticipantName(participantData.name);

        if (participantData.attended) {
          setStatusMessage(`${participantData.name} is already checked in.`);
          if (participantData.checkInTime && typeof participantData.checkInTime !== 'string') { // FieldValue
             // This case is unlikely if already checked in, as it should be a Timestamp then string
            setCheckInDetails(`Already checked in. Time unavailable (server processing).`);
          } else if (participantData.checkInTime) { // string (ISO)
            try {
              setCheckInDetails(`Checked in at: ${format(new Date(participantData.checkInTime), 'PPpp')}`);
            } catch (e) {
              setCheckInDetails(`Checked in previously. Time format error.`);
            }
          } else {
            setCheckInDetails('Already checked in (time not recorded).');
          }
          setErrorType('already_checked_in');
          toast({ title: 'Already Checked In', description: `${participantData.name} has already been checked in.` });
        } else {
          await updateDoc(participantRef, {
            attended: true,
            checkInTime: serverTimestamp(),
            updatedAt: serverTimestamp(), // Also update the general updatedAt timestamp
          });
          setStatusMessage(`Welcome, ${participantData.name}! You have been successfully checked in.`);
          setCheckInDetails(`Checked in at: ${format(new Date(), 'PPpp')} (pending server confirmation for exact time).`); // Show local time immediately
          setErrorType(null); // Success
          toast({ title: 'Check-in Successful', description: `Welcome, ${participantData.name}!` });
        }
      }
    } catch (error: any) {
      console.error('Check-in error:', error);
      setStatusMessage('An error occurred during check-in. Please try again or contact support.');
      setErrorType('generic_error');
      toast({
        title: 'Check-in Error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [participantId, toast]);

  React.useEffect(() => {
    if (participantId) {
      processCheckin();
    } else {
      // Handle case where ID is not present on initial load more gracefully
      if (!searchParams.has('id_processed_once')) { // Prevent loop if ID remains null
        setStatusMessage('No participant ID provided in the URL.');
        setErrorType('generic_error');
        setIsLoading(false);
        router.replace('/checkin?id_processed_once=true', undefined); // Avoid infinite loop if ID stays null
      }
    }
  }, [participantId, processCheckin, searchParams, router]);


  const getIcon = () => {
    if (isLoading) return <Loader2 className="h-16 w-16 animate-spin text-primary" />;
    if (errorType === 'not_found' || errorType === 'generic_error') return <XCircle className="h-16 w-16 text-destructive" />;
    if (errorType === 'already_checked_in') return <AlertTriangle className="h-16 w-16 text-yellow-500" />;
    return <CheckCircle className="h-16 w-16 text-green-500" />; // Success
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-2xl font-bold">HARMUN Check-in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4 text-center">
          <div className="mb-4">{getIcon()}</div>
          {isLoading ? (
            <p className="text-lg text-muted-foreground">Processing check-in for ID: {participantId || 'N/A'}...</p>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {statusMessage || 'Waiting for participant ID...'}
              </p>
              {checkInDetails && (
                <p className="text-sm text-muted-foreground">{checkInDetails}</p>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {!isLoading && participantId && (
            <Button onClick={processCheckin} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry Check-in for ID: {participantId}
            </Button>
          )}
          <Button asChild className="w-full" variant="default">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Go to Main Dashboard
            </Link>
          </Button>
           <p className="text-xs text-muted-foreground">
            If you are not automatically redirected or see an error, please ensure the QR code is valid.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
