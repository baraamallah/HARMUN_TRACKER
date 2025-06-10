
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, ListFilter, CheckSquare, Square, Loader2, Layers, CheckCircle, XCircle, Coffee, UserRound, Wrench, LogOutIcon, AlertOctagon, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
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
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { ParticipantForm } from '@/components/participants/ParticipantForm';
import { ImportCsvDialog } from '@/components/participants/ImportCsvDialog';
import { ExportCsvButton } from '@/components/participants/ExportCsvButton';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const ALL_ATTENDANCE_STATUSES_OPTIONS: { status: AttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'Present', label: 'Present', icon: CheckCircle },
    { status: 'Absent', label: 'Absent', icon: XCircle },
    { status: 'Present On Account', label: 'Present (On Account)', icon: AlertOctagon },
    { status: 'In Break', label: 'In Break', icon: Coffee },
    { status: 'Restroom Break', label: 'Restroom Break', icon: UserRound },
    { status: 'Technical Issue', label: 'Technical Issue', icon: Wrench },
    { status: 'Stepped Out', label: 'Stepped Out', icon: LogOutIcon },
];

type AuthStateType = 'loading' | 'authenticated' | 'unauthenticated';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [authStatus, setAuthStatus] = React.useState<AuthStateType>('loading');

  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');

  const [isParticipantFormOpen, setIsParticipantFormOpen] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = React.useState<Participant | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<VisibleColumns>({
    selection: true,
    avatar: true,
    name: true,
    school: true,
    committee: true,
    country: true,
    status: true,
    actions: true,
  });

  const columnLabels: Record<keyof VisibleColumns, string> = {
    selection: 'Select',
    avatar: 'Avatar',
    name: 'Name',
    school: 'School',
    committee: 'Committee',
    country: 'Country',
    status: 'Status',
    actions: 'Actions',
  };

  const [selectedParticipantIds, setSelectedParticipantIds] = React.useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);


  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthStatus('authenticated');
      } else {
        setCurrentUser(null);
        setAuthStatus('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [authStatus, router]);

  const fetchData = React.useCallback(async () => {
    if (authStatus !== 'authenticated' || !currentUser) {
      return;
    }

    setIsLoadingData(true);
    try {
      const participantsColRef = collection(db, 'participants');
      const queryConstraints = [];

      if (selectedSchool !== 'All Schools') {
        queryConstraints.push(where('school', '==', selectedSchool));
      }
      if (selectedCommittee !== 'All Committees') {
        queryConstraints.push(where('committee', '==', selectedCommittee));
      }
      if (quickStatusFilter !== 'All') {
        queryConstraints.push(where('status', '==', quickStatusFilter));
      }

      const participantsQuery = query(participantsColRef, ...queryConstraints, orderBy('name'));
      const participantsSnapshot = await getDocs(participantsQuery);
      let fetchedParticipants = participantsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          school: data.school || '',
          committee: data.committee || '',
          country: data.country,
          status: data.status || 'Absent',
          imageUrl: data.imageUrl,
          notes: data.notes,
          additionalDetails: data.additionalDetails,
          classGrade: data.classGrade,
          email: data.email,
          phone: data.phone,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as Participant;
      });

      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        fetchedParticipants = fetchedParticipants.filter(p =>
          p.name.toLowerCase().includes(term) ||
          p.school.toLowerCase().includes(term) ||
          p.committee.toLowerCase().includes(term) ||
          (p.country && p.country.toLowerCase().includes(term))
        );
      }
      setParticipants(fetchedParticipants);

      const [schoolsData, committeesData] = await Promise.all([
        getSystemSchools(),
        getSystemCommittees(),
      ]);
      setSchools(['All Schools', ...schoolsData]);
      setCommittees(['All Committees', ...committeesData]);
      setSelectedParticipantIds([]);
    } catch (error: any) {
      console.error("Failed to fetch data:", error);
      let errorMessage = "Failed to load dashboard data.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Ensure you have rights to view participant data, and check Firestore rules.";
      } else if (error.message && error.message.includes('requires an index')) {
        errorMessage = "A Firestore index is required. Check browser console for a link to create it.";
      }
      toast({title: "Error", description: errorMessage, variant: "destructive"})
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser, authStatus, selectedSchool, selectedCommittee, debouncedSearchTerm, quickStatusFilter, toast]);

  React.useEffect(() => {
    if (authStatus === 'authenticated' && currentUser) {
      fetchData();
    }
  }, [fetchData, authStatus, currentUser]);

  const handleAddParticipant = () => {
    setParticipantToEdit(null);
    setIsParticipantFormOpen(true);
  };

  const handleEditParticipant = (participant: Participant) => {
    setParticipantToEdit(participant);
    setIsParticipantFormOpen(true);
  };

  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key as keyof VisibleColumns] = show;
        return acc;
      }, {} as VisibleColumns)
    );
  };

  const statusFilterOptions: { label: string; value: AttendanceStatus | 'All' }[] = [
    { label: 'All Participants', value: 'All' },
    { label: 'Present', value: 'Present' },
    { label: 'Absent', value: 'Absent' },
  ];

  const handleSelectParticipant = (participantId: string, isSelected: boolean) => {
    setSelectedParticipantIds(prevSelected =>
      isSelected
        ? [...prevSelected, participantId]
        : prevSelected.filter(id => id !== participantId)
    );
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedParticipantIds(participants.map(p => p.id));
    } else {
      setSelectedParticipantIds([]);
    }
  };

  const isAllSelected = participants.length > 0 && selectedParticipantIds.length === participants.length;

  const handleBulkStatusUpdate = async (status: AttendanceStatus) => {
    if (selectedParticipantIds.length === 0) {
      toast({ title: "No participants selected", description: "Please select participants to update.", variant: "default" });
      return;
    }
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedParticipantIds.forEach(id => {
        const participantRef = doc(db, "participants", id);
        batch.update(participantRef, { status, updatedAt: serverTimestamp() });
      });
      await batch.commit();

      toast({
        title: "Bulk Update Successful",
        description: `${selectedParticipantIds.length} participant(s) updated to ${status}.`,
      });
      fetchData();
      setSelectedParticipantIds([]);
    } catch (error: any) {
      console.error("Client-side Error bulk marking attendance: ", error);
      toast({
        title: "Bulk Update Failed",
        description: error.message || "An unexpected error occurred during bulk update. Check Firestore rules.",
        variant: "destructive"
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const confirmBulkDelete = () => {
    if (selectedParticipantIds.length === 0) {
      toast({ title: "No participants selected", description: "Please select participants to delete.", variant: "default" });
      return;
    }
    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedParticipantIds.forEach(id => {
        const participantRef = doc(db, "participants", id);
        batch.delete(participantRef);
      });
      await batch.commit();

      toast({
        title: "Bulk Delete Successful",
        description: `${selectedParticipantIds.length} participant(s) deleted.`,
      });
      fetchData();
      setSelectedParticipantIds([]);
    } catch (error: any) {
      console.error("Client-side error during bulk deletion: ", error);
      let description = "An unexpected error occurred during bulk deletion.";
      if (error && error.message) {
        description = error.message;
      }
      toast({ title: "Bulk Delete Failed", description, variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };


  if (authStatus === 'loading') {
    return (
      <AppLayoutClientShell>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Verifying authentication...</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-9 w-72 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </AppLayoutClientShell>
    );
  }

  if (authStatus === 'unauthenticated' || !currentUser) { // After loading, if still no user, show redirect message
    return (
       <AppLayoutClientShell>
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Redirecting to login...</p>
        </div>
       </AppLayoutClientShell>
    );
  }

  return (
    <AppLayoutClientShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
            <p className="text-muted-foreground">Manage and track participant attendance.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ImportCsvDialog onImportSuccess={fetchData} />
            <ExportCsvButton participants={participants} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ListFilter className="mr-2 h-4 w-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toggleAllColumns(true)}>
                  <CheckSquare className="mr-2 h-4 w-4" /> Show All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleAllColumns(false)}>
                  <Square className="mr-2 h-4 w-4" /> Hide All
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(visibleColumns) as Array<keyof VisibleColumns>).map((key) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns[key]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, [key]: checked }))
                    }
                  >
                    {columnLabels[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleAddParticipant}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Participant
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 p-4 border rounded-lg shadow-sm bg-card items-center">
          <Input
            placeholder="Search by name, school, committee, country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow"
          />
          <Select value={selectedSchool} onValueChange={setSelectedSchool}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by school" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((school) => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by committee" />
            </SelectTrigger>
            <SelectContent>
              {committees.map((committee) => (
                <SelectItem key={committee} value={committee}>
                  {committee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 items-center">
            {statusFilterOptions.map(opt => (
              <Button
                key={opt.value}
                variant={quickStatusFilter === opt.value ? "default" : "outline"}
                onClick={() => setQuickStatusFilter(opt.value)}
                className={cn(quickStatusFilter === opt.value && "ring-2 ring-ring ring-offset-2 dark:ring-offset-background")}
              >
                {opt.label}
              </Button>
            ))}
            {selectedParticipantIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" disabled={isBulkUpdating || isBulkDeleting}>
                    <Layers className="mr-2 h-4 w-4" />
                    Actions for {selectedParticipantIds.length} Selected
                    {(isBulkUpdating || isBulkDeleting) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Set status for selected to:</DropdownMenuLabel>
                  {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.status} onClick={() => handleBulkStatusUpdate(opt.status)} disabled={isBulkUpdating || isBulkDeleting}>
                      <opt.icon className="mr-2 h-4 w-4" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={confirmBulkDelete}
                    disabled={isBulkUpdating || isBulkDeleting}
                    className="text-destructive hover:!text-destructive focus:!text-destructive focus:!bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>

        <ParticipantTable
          participants={participants}
          isLoading={isLoadingData && authStatus === 'authenticated'} // Data is only loading if authenticated
          onEditParticipant={handleEditParticipant}
          visibleColumns={visibleColumns}
          selectedParticipants={selectedParticipantIds}
          onSelectParticipant={handleSelectParticipant}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
        />
      </div>

      <ParticipantForm
        isOpen={isParticipantFormOpen}
        onOpenChange={setIsParticipantFormOpen}
        participantToEdit={participantToEdit}
        schools={schools.filter(s => s !== 'All Schools')}
        committees={committees.filter(c => c !== 'All Committees')}
        onFormSubmitSuccess={fetchData}
      />

      <AlertDialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedParticipantIds.length} selected participant(s)?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Yes, Delete Selected'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayoutClientShell>
  );
}
