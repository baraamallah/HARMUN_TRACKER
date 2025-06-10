
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
import { cn } from '@/lib/utils';

export default function CheckinPage() {
  const searchParams = useSearchParams();
  const router = useRouter(); 
  const { toast } = useToast();
  const participantId = searchParams.get('id');

  const [isLoading, setIsLoading] = React.useState(true);
  const [result, setResult] = React.useState<CheckinResult | null>(null);

  const performCheckin = React.useCallback(async (id: string | null) => {
    setIsLoading(true);
    setResult(null); 
    const checkinOutcome = await processCheckinAction(id);
    setResult(checkinOutcome);
    setIsLoading(false);

    if (checkinOutcome.success) {
      toast({ 
        title: 'Check-in Successful', 
        description: checkinOutcome.participantName ? `Welcome, ${checkinOutcome.participantName}!` : 'Checked in!',
        className: 'bg-green-100 dark:bg-green-900 border-green-500'
      });
    } else {
      let toastTitle = 'Check-in Info';
      let toastVariant: 'destructive' | 'default' = 'default';
      let toastClassName = '';

      if (checkinOutcome.errorType === 'not_found' || checkinOutcome.errorType === 'generic_error' || checkinOutcome.errorType === 'missing_id') {
        toastTitle = 'Check-in Failed';
        toastVariant = 'destructive';
      } else if (checkinOutcome.errorType === 'already_checked_in') {
        toastTitle = 'Already Checked In';
        toastClassName = 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500';
      }
      
      toast({
        title: toastTitle,
        description: checkinOutcome.message,
        variant: toastVariant,
        className: toastClassName,
      });
    }
  }, [toast]);

  React.useEffect(() => {
    const currentId = searchParams.get('id'); 
    if (currentId && !searchParams.has('processed_checkin')) {
      performCheckin(currentId);
      router.replace(`/checkin?id=${currentId}&processed_checkin=true`, { scroll: false });
    } else if (!currentId && !searchParams.has('processed_checkin_no_id')) {
      performCheckin(null); 
      router.replace(`/checkin?processed_checkin_no_id=true`, { scroll: false });
    } else if (searchParams.has('processed_checkin') || searchParams.has('processed_checkin_no_id')) {
      if (!result && currentId) { 
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
  }, [performCheckin, searchParams, router, result]);


  const getCardStatusStyles = () => {
    if (isLoading || !result) return 'border-primary';
    if (result.success) return 'border-green-500 dark:border-green-400';
    if (result.errorType === 'not_found' || result.errorType === 'generic_error' || result.errorType === 'missing_id') return 'border-destructive';
    if (result.errorType === 'already_checked_in') return 'border-yellow-500 dark:border-yellow-400';
    return 'border-primary';
  };
  
  const getIcon = () => {
    const iconSize = "h-20 w-20 md:h-24 md:w-24"; // Larger icons
    if (isLoading) return <Loader2 className={cn(iconSize, "animate-spin text-primary")} />;
    if (!result) return <AlertTriangle className={cn(iconSize, "text-yellow-500 dark:text-yellow-400")} />;
    if (result.success) return <CheckCircle className={cn(iconSize, "text-green-500 dark:text-green-400")} />;
    if (result.errorType === 'not_found' || result.errorType === 'generic_error' || result.errorType === 'missing_id') return <XCircle className={cn(iconSize, "text-destructive")} />;
    if (result.errorType === 'already_checked_in') return <AlertTriangle className={cn(iconSize, "text-yellow-500 dark:text-yellow-400")} />;
    return <AlertTriangle className={cn(iconSize, "text-muted-foreground")} />; 
  };
  
  const handleRetry = () => {
    const currentId = searchParams.get('id');
    if (currentId) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('processed_checkin');
      newParams.delete('processed_checkin_no_id');
      router.push(`/checkin?${newParams.toString()}`, { scroll: false });
    } else {
      performCheckin(null); 
    }
  };

  const getMessageColor = () => {
    if (isLoading || !result) return 'text-muted-foreground';
    if (result.success) return 'text-green-600 dark:text-green-400';
    if (result.errorType === 'not_found' || result.errorType === 'generic_error' || result.errorType === 'missing_id') return 'text-destructive';
    if (result.errorType === 'already_checked_in') return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      <Card className={cn("w-full max-w-lg shadow-xl border-t-8 transition-colors duration-500", getCardStatusStyles())}>
        <CardHeader className="text-center pt-8">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">HARMUN Check-in</CardTitle>
          <CardDescription className="text-md text-muted-foreground">
            Participant Attendance System
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 text-center py-10 px-6">
          <div className="mb-4">{getIcon()}</div>
          {isLoading ? (
            <p className="text-xl text-muted-foreground">Processing check-in for ID: {participantId || 'N/A'}...</p>
          ) : result ? (
            <>
              <p className={cn("text-2xl md:text-3xl font-semibold", getMessageColor())}>
                {result.participantName && result.success ? `Welcome, ${result.participantName}!` : result.message}
              </p>
              {result.participantName && !result.success && result.errorType !== 'not_found' && result.errorType !== 'missing_id' && (
                <p className={cn("text-xl font-medium", getMessageColor())}>Participant: {result.participantName}</p>
              )}
              {result.checkInDetails && (
                <p className="text-lg text-muted-foreground">{result.checkInDetails}</p>
              )}
            </>
          ) : (
             <p className="text-xl text-muted-foreground">Waiting for participant ID...</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-8 px-6">
          {!isLoading && ( 
            <Button onClick={handleRetry} variant="outline" className="w-full text-base py-3">
              <RefreshCw className="mr-2 h-5 w-5" /> Retry Check-in {participantId ? `for ID: ${participantId}` : ''}
            </Button>
          )}
          <Button asChild className="w-full text-base py-3" variant="default">
            <Link href="/">
              <Home className="mr-2 h-5 w-5" /> Go to Main Dashboard
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
