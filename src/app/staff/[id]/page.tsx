
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSystemStaffTeams } from '@/lib/actions'; 
import type { StaffMember, StaffAttendanceStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffMemberStatusBadge } from '@/components/staff/StaffMemberStatusBadge';
import { StaffMemberForm } from '@/components/staff/StaffMemberForm';
import { ArrowLeft, Edit, Loader2, Info, StickyNote, ChevronDown, Briefcase, Phone as PhoneIcon, Mail, Users2 as StaffIcon, UserCheck, UserX, Coffee, Plane, Network, RefreshCw } from 'lucide-react'; 
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

export default function StaffMemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === 'string' ? params.id : '';

  const [staffMember, setStaffMember] = React.useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmittingStatus, setIsSubmittingStatus] = React.useState(false);
  const [isLoadingSecondary, setIsLoadingSecondary] = React.useState(true); // For lazy loading

  const [isStaffFormOpen, setIsStaffFormOpen] = React.useState(false);
  const [systemStaffTeams, setSystemStaffTeams] = React.useState<string[]>([]); 

  const fetchStaffDataAndTeams = React.useCallback(async (isInitialLoad = true) => { 
    if (!id) {
      if(isInitialLoad) setIsLoading(false);
      toast({ title: "Error", description: "Staff Member ID is missing.", variant: "destructive" });
      router.push('/staff');
      return;
    }
    if(isInitialLoad) setIsLoading(true);
    try {
      const staffMemberRef = doc(db, 'staff_members', id);
      const staffDocSnap = await getDoc(staffMemberRef);
      let fetchedStaffData: StaffMember | null = null;

      if (staffDocSnap.exists()) {
        const data = staffDocSnap.data();
        fetchedStaffData = {
          id: staffDocSnap.id,
          name: data.name || '',
          role: data.role || '',
          department: data.department,
          team: data.team,
          email: data.email,
          phone: data.phone,
          contactInfo: data.contactInfo,
          status: data.status || 'Off Duty',
          imageUrl: data.imageUrl,
          // Lazily loaded fields are initially omitted or set to null
          notes: data.notes || '',
          createdAt: data.createdAt instanceof FirestoreTimestampType ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof FirestoreTimestampType ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as StaffMember;
      }
      
      if (isInitialLoad) {
        const teamsData = await getSystemStaffTeams(); 
        setSystemStaffTeams(teamsData); 
      }

      if (fetchedStaffData) {
        setStaffMember(fetchedStaffData);
      } else {
        toast({ title: "Not Found", description: "Staff member data could not be found.", variant: "destructive" });
        router.push('/staff');
      }
    } catch (error: any) {
      console.error("Failed to fetch staff member data or teams (client-side for staff data):", error);
      let errorMessage = "Failed to load staff member data or teams.";
       if (error.code === 'permission-denied') {
        errorMessage = "Permission denied when fetching staff data. Check Firestore rules.";
      }
      toast({ title: "Error Fetching Data", description: errorMessage, variant: "destructive" });
    } finally {
      if(isInitialLoad) setIsLoading(false);
    }
  }, [id, toast, router]);

  React.useEffect(() => {
    fetchStaffDataAndTeams(true);
  }, [fetchStaffDataAndTeams]);
  
  // Lazy load notes
  React.useEffect(() => {
    if (!id || !staffMember) return;

    const fetchSecondaryData = async () => {
        setIsLoadingSecondary(true);
        try {
            const staffRef = doc(db, 'staff_members', id);
            const docSnap = await getDoc(staffRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStaffMember(sm => sm ? ({ ...sm, notes: data.notes || '' }) : null);
            }
        } catch (error) {
            console.error("Failed to lazy load secondary staff data:", error);
            toast({ title: "Could not load details", description: "Failed to load notes.", variant: 'default' });
        } finally {
            setIsLoadingSecondary(false);
        }
    };

    const timer = setTimeout(fetchSecondaryData, 500); // 500ms delay before fetching
    return () => clearTimeout(timer);
  }, [id, staffMember?.id, toast]);

  const handleFormSubmitSuccess = () => {
    fetchStaffDataAndTeams(false); // Re-fetch without full loading state
    setIsStaffFormOpen(false);
  };

  const handleMarkStatusClientSide = async (status: StaffAttendanceStatus) => {
    if (!staffMember) return;
    setIsSubmittingStatus(true);
    try {
      const staffMemberRef = doc(db, 'staff_members', staffMember.id);
      await updateDoc(staffMemberRef, { status, updatedAt: serverTimestamp() });
      
      setStaffMember(prev => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null);
      toast({
        title: 'Status Updated',
        description: `${staffMember.name}'s status set to ${status}.`,
      });
    } catch (error: any) {
      console.error("Client-side Error marking staff status on profile page: ", error);
      toast({
        title: 'Error Updating Status',
        description: error.message || 'An unknown error occurred while updating status.',
        variant: 'destructive',
      });
       fetchStaffDataAndTeams(false); // Refresh data on error
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const staffStatusOptions: { status: StaffAttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'On Duty', label: 'On Duty', icon: UserCheck },
    { status: 'Off Duty', label: 'Off Duty', icon: UserX },
    { status: 'On Break', label: 'On Break', icon: Coffee },
    { status: 'Away', label: 'Away', icon: Plane },
  ];


  if (isLoading) { 
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
          </div>
        </div>
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <StaffIcon className="h-32 w-32 mx-auto text-muted-foreground mb-4" data-ai-hint="error user" />
        <h1 className="text-2xl font-bold">Staff Member Not Found</h1>
        <p className="text-muted-foreground mb-6">The staff member you are looking for does not exist.</p>
        <Button asChild variant="outline">
          <Link href="/staff"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Staff List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-5xl">
       <Button asChild variant="outline" className="mb-6 hover:bg-accent transition-colors">
        <Link href="/staff"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Staff List</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <section aria-labelledby="staff-member-info-heading" className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <CardHeader className="items-center text-center p-6">
              <Avatar className="h-32 w-32 border-4 border-primary mb-4 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                <AvatarImage src={staffMember.imageUrl} alt={`${staffMember.name}'s avatar`} data-ai-hint="person avatar large" />
                <AvatarFallback className="text-4xl">{staffMember.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <CardTitle id="staff-member-info-heading" className="text-3xl font-bold">{staffMember.name}</CardTitle>
              <div className="mt-2">
                <StaffMemberStatusBadge status={staffMember.status} />
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-3 px-6 pb-6">
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Briefcase className="mr-2 h-4 w-4 text-primary/70" />Role:</span>
                <span className="text-right">{staffMember.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><StaffIcon className="mr-2 h-4 w-4 text-primary/70" />Department:</span>
                <span className="text-right">{staffMember.department || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Network className="mr-2 h-4 w-4 text-primary/70" />Team:</span>
                <span className="text-right">{staffMember.team || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><Mail className="mr-2 h-4 w-4 text-primary/70" />Email:</span>
                <span className="text-right break-all">{staffMember.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground flex items-center"><PhoneIcon className="mr-2 h-4 w-4 text-primary/70" />Phone:</span>
                <span className="text-right">{staffMember.phone || 'N/A'}</span>
              </div>
              {staffMember.contactInfo && (
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground flex items-center"><Info className="mr-2 h-4 w-4 text-primary/70" />Other Contact:</span>
                  <span className="text-right">{staffMember.contactInfo}</span>
                </div>
              )}
               <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Profile Created:</span>
                <span className="text-right">
                  {staffMember.createdAt && isValid(parseISO(staffMember.createdAt as string)) ? format(parseISO(staffMember.createdAt as string), 'PP p') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Last Updated:</span>
                <span className="text-right">
                  {staffMember.updatedAt && isValid(parseISO(staffMember.updatedAt as string)) ? format(parseISO(staffMember.updatedAt as string), 'PP p') : 'N/A'}
                </span>
              </div>
            </CardContent>
            <CardFooter className="p-4 flex flex-col gap-2 border-t">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={isSubmittingStatus || isLoading} aria-haspopup="true" aria-expanded="false" aria-label="Change staff member status">
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Change Status
                    {isSubmittingStatus && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {staffStatusOptions.map(opt => (
                    <DropdownMenuItem
                      key={opt.status}
                      onClick={() => handleMarkStatusClientSide(opt.status)}
                      disabled={isSubmittingStatus || isLoading || staffMember.status === opt.status}
                      className={staffMember.status === opt.status ? "bg-accent/50 text-accent-foreground" : ""}
                      aria-label={`Mark as ${opt.label}`}
                    >
                      <opt.icon className="mr-2 h-4 w-4" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setIsStaffFormOpen(true)} className="w-full" aria-label="Edit staff member details" disabled={isLoading || isSubmittingStatus}>
                <Edit className="mr-2 h-4 w-4" /> Edit Details
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fetchStaffDataAndTeams(false)}
                disabled={isLoading || isSubmittingStatus}
                aria-label="Refresh staff data"
              >
                {isLoading && !isSubmittingStatus ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh Data
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section aria-labelledby="staff-member-notes-heading" className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <CardHeader>
              <CardTitle id="staff-member-notes-heading" className="flex items-center text-xl"><StickyNote className="mr-3 h-6 w-6 text-primary" />Notes</CardTitle>
              <CardDescription>Private notes and observations about the staff member.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSecondary ? <Skeleton className="h-20 w-full" /> : staffMember.notes ? (
                <p className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-md min-h-[80px]">{staffMember.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic p-3 bg-muted/50 rounded-md min-h-[80px]">No notes recorded for this staff member.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <StaffMemberForm
        isOpen={isStaffFormOpen}
        onOpenChange={setIsStaffFormOpen}
        staffMemberToEdit={staffMember}
        onFormSubmitSuccess={handleFormSubmitSuccess}
        staffTeams={systemStaffTeams} 
      />
    </div>
  );
}
