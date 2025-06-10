
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Home, UserCircleIcon as UserIcon, RefreshCw, ListRestart, Edit3, UserSearch, Briefcase, Plane, Coffee, UserX, UserCheck } from 'lucide-react';
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
import { quickSetStaffStatusAction } from '@/lib/actions';
import type { StaffMember, StaffAttendanceStatus, ActionResultStaff } from '@/types';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp as FirestoreTimestampType } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import { StaffMemberStatusBadge } from '@/components/staff/StaffMemberStatusBadge';

const ALL_STAFF_ATTENDANCE_STATUSES_OPTIONS: { status: StaffAttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'On Duty', label: 'On Duty', icon: UserCheck },
    { status: 'Off Duty', label: 'Off Duty', icon: UserX },
    { status: 'On Break', label: 'On Break', icon: Coffee },
    { status: 'Away', label: 'Away', icon: Plane },
];

function StaffCheckinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const staffId = searchParams.get('id');

  const [staffMember, setStaffMember] = React.useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = React.useState(!!staffId);
  const [actionInProgress, setActionInProgress] = React.useState<StaffAttendanceStatus | 'initial_load' | null>(staffId ? 'initial_load' : null);
  const [pageError, setPageError] = React.useState<string | null>(null);

  const [manualIdInput, setManualIdInput] = React.useState('');
  const [isManualLookupLoading, setIsManualLookupLoading] = React.useState(false);

  const fetchStaffMemberData = React.useCallback(async (id: string) => {
    if (!id) {
      setIsLoading(false);
      setActionInProgress(null);
      setStaffMember(null);
      return;
    }
    setIsLoading(true);
    setPageError(null);
    setActionInProgress('initial_load');
    try {
      const staffMemberRef = doc(db, 'staff_members', id);
      const docSnap = await getDoc(staffMemberRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedStaffMember = {
            id: docSnap.id,
            name: data.name || '',
            role: data.role || '',
            department: data.department,
            team: data.team,
            email: data.email,
            phone: data.phone,
            contactInfo: data.contactInfo,
            status: data.status || 'Off Duty',
            imageUrl: data.imageUrl,
            notes: data.notes,
            createdAt: data.createdAt instanceof FirestoreTimestampType ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof FirestoreTimestampType ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as StaffMember;
        setStaffMember(fetchedStaffMember);
      } else {
        setPageError(`Staff member with ID "${id}" not found.`);
        setStaffMember(null);
        toast({ title: "Not Found", description: `Staff ID "${id}" not found.`, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error fetching staff member (client-side for QR/Manual page):", error);
      setPageError("Failed to load staff member data. Please check the console and try again.");
      toast({ title: "Error Loading Data", description: "Could not retrieve staff member details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setActionInProgress(null);
      setIsManualLookupLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (staffId) {
      fetchStaffMemberData(staffId);
    } else {
      setIsLoading(false);
      setActionInProgress(null);
      setStaffMember(null);
    }
  }, [staffId, fetchStaffMemberData]);

  const handleStatusUpdate = async (newStatus: StaffAttendanceStatus) => {
    if (!staffMember) return;
    setActionInProgress(newStatus);
    setPageError(null);

    const result: ActionResultStaff = await quickSetStaffStatusAction(staffMember.id, newStatus);

    if (result.success && result.staffMember) {
      setStaffMember(result.staffMember);
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
      if (staffId) fetchStaffMemberData(staffId); // Re-fetch data on failure to ensure UI is consistent
    }
    setActionInProgress(null);
  };

  const handleManualLookup = () => {
    if (!manualIdInput.trim()) {
      toast({ title: "ID Required", description: "Please enter a staff member ID.", variant: "destructive" });
      return;
    }
    setIsManualLookupLoading(true);
    router.push(`/staff-checkin?id=${manualIdInput.trim()}`);
  };

  const cardBorderColor = staffMember?.status === 'On Duty' ? 'border-green-500' : 
                          staffMember?.status === 'Off Duty' ? 'border-gray-500' : 
                          staffMember?.status === 'On Break' ? 'border-yellow-500' : 
                          staffMember?.status === 'Away' ? 'border-blue-500' : 
                          'border-primary';


  if (!staffId && !isLoading && !pageError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
          <CardHeader className="text-center pt-8">
            <div className="mb-6 flex justify-center">
              <Logo size="lg" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Staff Status Management</CardTitle>
            <CardDescription className="text-md text-muted-foreground">
              Enter a Staff Member ID to manage their status.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="manual-staff-id">Staff Member ID</Label>
              <Input
                id="manual-staff-id"
                placeholder="Enter staff ID here"
                value={manualIdInput}
                onChange={(e) => setManualIdInput(e.target.value)}
                disabled={isManualLookupLoading}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isManualLookupLoading) handleManualLookup(); }}
              />
            </div>
            <Button onClick={handleManualLookup} className="w-full py-3 text-base" disabled={isManualLookupLoading || !manualIdInput.trim()}>
              {isManualLookupLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserSearch className="mr-2 h-5 w-5" />}
              Find Staff Member
            </Button>
          </CardContent>
          <CardFooter className="flex-col items-center gap-3 pb-8 text-sm">
            <p className="text-muted-foreground">
              Alternatively, scan a staff member's QR code.
            </p>
            <Button asChild className="w-full mt-2" variant="outline">
              <Link href="/staff">
                <Home className="mr-2 h-4 w-4" /> Go to Staff Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading && actionInProgress === 'initial_load') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className={cn("w-full max-w-md shadow-xl border-t-8", cardBorderColor)}>
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-xl text-muted-foreground">Loading Staff Data...</p>
            {staffId && <p className="text-sm text-muted-foreground">ID: {staffId}</p>}
          </CardContent>
           <CardFooter className="flex-col gap-3 pb-8">
             <Button asChild className="w-full" variant="outline" disabled><Link href="/staff"><Home className="mr-2 h-4 w-4"/>Staff Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (pageError && !staffMember) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-destructive">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <XCircle className="h-16 w-16 text-destructive" />
            <p className="text-xl font-semibold text-destructive">Error</p>
            <p className="text-md text-muted-foreground">{pageError}</p>
            {staffId && <p className="text-sm text-muted-foreground">Attempted ID: {staffId}</p>}
            <div className="flex flex-col gap-2 w-full">
              <Button variant="outline" onClick={() => staffId && fetchStaffMemberData(staffId)} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry Lookup for ID: {staffId}
              </Button>
              <Button variant="secondary" onClick={() => router.push('/staff-checkin')}>
                <UserSearch className="mr-2 h-4 w-4" /> Try Manual Lookup
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3 pb-8 pt-4 border-t">
            <Button asChild className="w-full" variant="outline"><Link href="/staff"><Home className="mr-2 h-4 w-4"/>Staff Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!staffMember && staffId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-yellow-500">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <AlertTriangle className="h-16 w-16 text-yellow-500" />
            <p className="text-xl text-muted-foreground">Staff data unavailable for ID: {staffId}.</p>
            <Button variant="outline" onClick={() => router.push('/staff-checkin')}> <UserSearch className="mr-2 h-4 w-4" /> Try Manual Lookup </Button>
          </CardContent>
           <CardFooter className="flex-col gap-3 pb-8 pt-4 border-t">
            <Button asChild className="w-full" variant="outline"><Link href="/staff"><Home className="mr-2 h-4 w-4"/>Staff Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!staffMember) {
    if (!staffId) {
         router.replace('/staff-checkin'); 
         return null; 
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-yellow-500">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <AlertTriangle className="h-16 w-16 text-yellow-500" />
             <p className="text-xl text-muted-foreground">Unexpected state. Staff data missing.</p>
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
                <AvatarImage src={staffMember.imageUrl} alt={staffMember.name} data-ai-hint="person avatar large" />
                <AvatarFallback className="text-4xl">{staffMember.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
          <CardTitle className="text-3xl font-bold tracking-tight">{staffMember.name}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            {staffMember.role} {staffMember.team ? `• ${staffMember.team}` : ''}
          </CardDescription>
           <div className="mt-4">
            <StaffMemberStatusBadge status={staffMember.status} />
           </div>
           {staffMember.updatedAt && (
             <p className="text-xs text-muted-foreground mt-2">
                Last Status Update: {isValid(parseISO(staffMember.updatedAt as string)) ? format(parseISO(staffMember.updatedAt as string), 'PPpp') : 'N/A'}
             </p>
           )}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-3 text-center py-6 px-6">
            {pageError && (
                <p className="text-red-600 dark:text-red-400 text-sm mb-2 bg-red-100 dark:bg-red-900/30 p-2 rounded-md">{pageError}</p>
            )}
            <Button
                onClick={() => handleStatusUpdate('On Duty')}
                disabled={!!actionInProgress || staffMember.status === 'On Duty'}
                className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white text-md py-5"
                size="lg"
            >
                {actionInProgress === 'On Duty' ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <UserCheck className="mr-2 h-5 w-5" />}
                Set to On Duty
            </Button>
            <Button
                onClick={() => handleStatusUpdate('Off Duty')}
                disabled={!!actionInProgress || staffMember.status === 'Off Duty'}
                variant="outline" 
                className="w-full text-md py-5"
                size="lg"
            >
                {actionInProgress === 'Off Duty' ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <UserX className="mr-2 h-5 w-5" />}
                Set to Off Duty
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="w-full text-md py-5" size="lg" disabled={!!actionInProgress}>
                        {actionInProgress && actionInProgress !== 'initial_load' && !['On Duty', 'Off Duty'].includes(actionInProgress)
                          ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                          : <ListRestart className="mr-2 h-5 w-5" />}
                        Other Statuses...
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-[calc(100%-2rem)] max-w-sm mx-auto sm:w-72">
                    {ALL_STAFF_ATTENDANCE_STATUSES_OPTIONS
                      .filter(opt => opt.status !== 'On Duty' && opt.status !== 'Off Duty') // Filter out main button actions
                      .map(opt => (
                        <DropdownMenuItem
                            key={opt.status}
                            onClick={() => handleStatusUpdate(opt.status)}
                            disabled={!!actionInProgress || staffMember.status === opt.status}
                            className={cn("text-md py-3", staffMember.status === opt.status && "bg-accent text-accent-foreground focus:bg-accent focus:text-accent-foreground")}
                        >
                            <opt.icon className="mr-3 h-5 w-5" />
                            {opt.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </CardContent>
        <CardFooter className="flex-col gap-3 pb-6 px-6 border-t pt-6 mt-2">
            <Button onClick={() => staffId && fetchStaffMemberData(staffId)} variant="ghost" className="w-full text-muted-foreground hover:text-primary" disabled={!!actionInProgress}>
                <RefreshCw className="mr-2 h-4 w-4"/> Refresh Staff Data
            </Button>
             <Button variant="secondary" onClick={() => router.push('/staff-checkin')} className="w-full">
                <UserSearch className="mr-2 h-4 w-4" /> Lookup Another Staff Member
            </Button>
            <div className="flex w-full gap-2">
                <Button asChild className="flex-1" variant="outline">
                    <Link href="/staff"> <Home className="mr-2 h-4 w-4"/> Staff Dashboard </Link>
                </Button>
                {staffId && (
                    <Button asChild className="flex-1" variant="outline">
                        <Link href={`/staff/${staffId}`}> <Edit3 className="mr-2 h-4 w-4"/> Full Profile </Link>
                    </Button>
                )}
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function StaffCheckinPage() {
  return (
    <React.Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8 border-primary">
          <CardHeader className="text-center pt-8"><div className="mb-4"><Logo size="lg"/></div></CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 text-center py-10">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-xl text-muted-foreground">Loading Staff Status Page...</p>
          </CardContent>
           <CardFooter className="flex-col gap-3 pb-8">
             <Button asChild className="w-full" variant="outline" disabled><Link href="/staff"><Home className="mr-2 h-4 w-4"/>Staff Dashboard</Link></Button>
          </CardFooter>
        </Card>
      </div>
    }>
      <StaffCheckinPageContent />
    </React.Suspense>
  );
}
