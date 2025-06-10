
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/shared/Logo';
import Link from 'next/link';
import { processCheckinAction, type CheckinResult } from '@/lib/actions';

export default function CheckinPage() {
  const searchParams = useSearchParams();
  const router = useRouter(); 
  const { toast } = useToast();
  const participantId = searchParams.get('id');

  const [isLoading, setIsLoading] = React.useState(true);
  const [result, setResult] = React.useState<CheckinResult | null>(null);

  const performCheckin = React.useCallback(async (id: string | null) => {
    setIsLoading(true);
    setResult(null); // Clear previous result
    const checkinOutcome = await processCheckinAction(id);
    setResult(checkinOutcome);
    setIsLoading(false);

    if (checkinOutcome.success) {
      toast({ title: 'Check-in Successful', description: checkinOutcome.participantName ? `Welcome, ${checkinOutcome.participantName}!` : 'Checked in!' });
    } else {
      let toastTitle = 'Check-in Info';
      if (checkinOutcome.errorType === 'not_found' || checkinOutcome.errorType === 'generic_error' || checkinOutcome.errorType === 'missing_id') {
        toastTitle = 'Check-in Failed';
      }
      toast({
        title: toastTitle,
        description: checkinOutcome.message,
        variant: (checkinOutcome.errorType === 'not_found' || checkinOutcome.errorType === 'generic_error' || checkinOutcome.errorType === 'missing_id') ? 'destructive' : 'default',
      });
    }
  }, [toast]);

  React.useEffect(() => {
    const currentId = searchParams.get('id'); // Get current ID from params for this effect run
    if (currentId && !searchParams.has('processed_checkin')) {
      performCheckin(currentId);
      // To prevent re-processing on refresh, we can add a flag to the URL.
      // This is a simple client-side guard; the server action handles actual re-check-in logic.
      router.replace(`/checkin?id=${currentId}&processed_checkin=true`, { scroll: false });
    } else if (!currentId && !searchParams.has('processed_checkin_no_id')) {
      performCheckin(null); // Handle case where ID is initially missing
      router.replace(`/checkin?processed_checkin_no_id=true`, { scroll: false });
    } else if (searchParams.has('processed_checkin') || searchParams.has('processed_checkin_no_id')) {
      // If already marked as processed by the client, don't auto-run.
      // Fetch the result again if needed or rely on existing state.
      // For now, if 'result' is null, it means we navigated back or something cleared it.
      // Re-running in this case without a user action (like retry) might be confusing.
      // So, if 'processed_checkin' is true, we simply stop loading and show current 'result' or prompt retry.
      if (!result && currentId) { // No result yet, but was processed. Show message for retry.
           setResult({
              success: false,
              message: `Check-in for ID ${currentId} was attempted. Scan again or click retry.`,
              errorType: 'generic_error'
            });
      } else if (!result && !currentId) {
          setResult({
              success: false,
              message: 'No participant ID. Scan a QR code.',
              errorType: 'missing_id'
          });
      }
      setIsLoading(false);
    }
  }, [performCheckin, searchParams, router, result]); // Added 'result' to deps to avoid re-running if result is already set


  const getIcon = () => {
    if (isLoading) return <Loader2 className="h-16 w-16 animate-spin text-primary" />;
    if (!result) return <AlertTriangle className="h-16 w-16 text-yellow-500" />;
    if (result.success) return <CheckCircle className="h-16 w-16 text-green-500" />;
    if (result.errorType === 'not_found' || result.errorType === 'generic_error' || result.errorType === 'missing_id') return <XCircle className="h-16 w-16 text-destructive" />;
    if (result.errorType === 'already_checked_in') return <AlertTriangle className="h-16 w-16 text-yellow-500" />;
    return <AlertTriangle className="h-16 w-16 text-yellow-500" />; 
  };
  
  const handleRetry = () => {
    const currentId = searchParams.get('id');
    if (currentId) {
      // Remove the 'processed_checkin' flag to allow performCheckin to run again via useEffect
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('processed_checkin');
      newParams.delete('processed_checkin_no_id');
      router.push(`/checkin?${newParams.toString()}`, { scroll: false });
      // The useEffect will pick up the change and re-run performCheckin
    } else {
      performCheckin(null); // Retry for missing ID case
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
        <CardHeader className="text-center pt-8">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">HARMUN Check-in</CardTitle>
          <CardDescription className="text-md text-muted-foreground">
            Participant Attendance System
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4 text-center py-8">
          <div className="mb-4">{getIcon()}</div>
          {isLoading ? (
            <p className="text-lg text-muted-foreground">Processing check-in for ID: {participantId || 'N/A'}...</p>
          ) : result ? (
            <>
              <p className="text-xl font-semibold">
                {result.message}
              </p>
              {result.checkInDetails && (
                <p className="text-md text-muted-foreground">{result.checkInDetails}</p>
              )}
            </>
          ) : (
             <p className="text-lg text-muted-foreground">Waiting for participant ID...</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pb-8">
          {!isLoading && ( // Show retry always if not loading, logic inside handleRetry checks for ID
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry Check-in {participantId ? `for ID: ${participantId}` : ''}
            </Button>
          )}
          <Button asChild className="w-full" variant="default">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Go to Main Dashboard
            </Link>
          </Button>
           <p className="text-xs text-muted-foreground pt-2">
            If you see an error, please ensure the QR code is valid or contact event staff.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

