'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { PlusCircle, Layers, Trash2, Loader2, Users as UsersIcon, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton } from '@/components/participants/LoadingSkeleton';
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
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ExportExcelButton } from '@/components/participants/ExportExcelButton';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getParticipants } from '@/lib/actions';
import { isEffectivelyAbsent } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, writeBatch, serverTimestamp, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ALL_ATTENDANCE_STATUSES_OPTIONS } from '@/lib/constants';

interface ParticipantDashboardClientProps {
  initialParticipants: Participant[];
  systemSchools: string[];
  systemCommittees: string[];
}

export function ParticipantDashboardClient({ initialParticipants, systemSchools, systemCommittees }: ParticipantDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { loggedInUser: user, permissions, authSessionLoading: isAuthLoading } = useAuth();

  const [participants, setParticipants] = React.useState<Participant[]>(initialParticipants);
  const [isLoading, setIsLoading] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [statusFilter, setStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');
  const [dayFilter, setDayFilter] = React.useState<'All' | 'Day 1' | 'Day 2' | 'Both Days'>('All');
  const [currentDay, setCurrentDay] = React.useState<'day1' | 'day2'>('day1');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = React.useState<Participant | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<VisibleColumns>({
    selection: true, avatar: true, name: true, school: true,
    committee: true, country: true, status: true, actions: true,
  });

  const [selectedParticipantIds, setSelectedParticipantIds] = React.useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login?redirect=/');
    }
  }, [isAuthLoading, user, router]);

  const fetchData = React.useCallback(async () => {
    if (isAuthLoading || !user) return;

    setIsLoading(true);
    try {
      // Present/Absent filters use effective status (Stepped Out = Absent); fetch all and filter client-side
      const statusToFetch = (statusFilter === 'Present' || statusFilter === 'Absent') ? 'All' : statusFilter;
      const fetchedParticipants = await getParticipants({
        school: selectedSchool,
        committee: selectedCommittee,
        status: statusToFetch,
        searchTerm: debouncedSearchTerm,
      });
      setParticipants(fetchedParticipants);
    } catch (error: any) {
      console.error("Failed to fetch filtered data:", error);
      toast({ title: "Error", description: error.message || "Could not load participants.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchool, selectedCommittee, statusFilter, debouncedSearchTerm, toast, isAuthLoading, user]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time listener for auto-refresh when new data is added
  const fetchDataRef = React.useRef(fetchData);
  React.useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  React.useEffect(() => {
    if (isAuthLoading || !user) return;

    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, orderBy('createdAt', 'desc'));

    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Skip the first snapshot (initial load)
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }

        // Only update if there are actual document changes
        const changes = snapshot.docChanges();
        if (changes.length > 0 && !snapshot.metadata.hasPendingWrites) {
          console.log('Real-time update detected:', changes.length, 'changes');
          fetchDataRef.current();
        }
      },
      (error) => {
        console.error('Real-time listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [isAuthLoading, user]);

  // Fetch current conference day on mount
  React.useEffect(() => {
    const fetchCurrentDay = async () => {
      try {
        const { getCurrentConferenceDay } = await import('@/lib/actions');
        const day = await getCurrentConferenceDay();
        setCurrentDay(day);
      } catch (error) {
        console.error('Error fetching current conference day:', error);
      }
    };
    fetchCurrentDay();
  }, []);

  // Client-side day + effective status filtering (Stepped Out = Absent, anything else = Present)
  const filteredParticipants = React.useMemo(() => {
    let list = participants;
    if (dayFilter === 'Day 1') list = list.filter(p => Boolean(p.dayAttendance?.day1));
    else if (dayFilter === 'Day 2') list = list.filter(p => Boolean(p.dayAttendance?.day2));
    else if (dayFilter === 'Both Days') list = list.filter(p => Boolean(p.dayAttendance?.day1) && Boolean(p.dayAttendance?.day2));

    if (statusFilter === 'Present') list = list.filter(p => !isEffectivelyAbsent(p.status));
    else if (statusFilter === 'Absent') list = list.filter(p => isEffectivelyAbsent(p.status));
    return list;
  }, [participants, dayFilter, statusFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredParticipants.length / pageSize);
  const displayedParticipants = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredParticipants.slice(startIndex, endIndex);
  }, [filteredParticipants, currentPage, pageSize]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedSchool, selectedCommittee, statusFilter, dayFilter, pageSize]);

  // Calculate attendance stats: dayAttendance = attended that day; effective Present = not Absent/Stepped Out
  const attendanceStats = React.useMemo(() => {
    const total = participants.length;
    const day1Present = participants.filter(p => Boolean(p.dayAttendance?.day1) && !isEffectivelyAbsent(p.status)).length;
    const day2Present = participants.filter(p => Boolean(p.dayAttendance?.day2) && !isEffectivelyAbsent(p.status)).length;
    const day1Absent = total - day1Present;
    const day2Absent = total - day2Present;
    const currentDayPresent = currentDay === 'day1' ? day1Present : day2Present;
    const currentDayAbsent = currentDay === 'day1' ? day1Absent : day2Absent;
    
    return {
      total,
      day1Present,
      day2Present,
      day1Absent,
      day2Absent,
      currentDayPresent,
      currentDayAbsent,
    };
  }, [participants, currentDay]);

  const handleAddParticipant = () => {
    setParticipantToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditParticipant = (participant: Participant) => {
    setParticipantToEdit(participant);
    setIsFormOpen(true);
  };

  const handleSelectParticipant = (participantId: string, isSelected: boolean) => {
    setSelectedParticipantIds(prev => isSelected ? [...prev, participantId] : prev.filter(id => id !== participantId));
  };

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedParticipantIds(isSelected ? displayedParticipants.map(p => p.id) : []);
  };

  const isAllSelected = displayedParticipants.length > 0 && displayedParticipants.every(p => selectedParticipantIds.includes(p.id));

  const handleBulkStatusUpdate = async (status: AttendanceStatus) => {
    if (selectedParticipantIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedParticipantIds.forEach(id => {
        batch.update(doc(db, "participants", id), { status, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      toast({ title: "Bulk Update Successful", description: `${selectedParticipantIds.length} participant(s) updated to ${status}.` });
      fetchData();
    } catch (error: any) {
      console.error("Bulk update failed:", error);
      toast({ title: "Bulk Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
      setSelectedParticipantIds([]);
    }
  };

  const confirmBulkDelete = () => {
    if (selectedParticipantIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedParticipantIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedParticipantIds.forEach(id => {
        batch.delete(doc(db, "participants", id));
      });
      await batch.commit();
      toast({ title: "Bulk Delete Successful", description: `${selectedParticipantIds.length} participant(s) deleted.` });
      fetchData();
      setSelectedParticipantIds([]);
    } catch (error: any) {
      console.error("Bulk delete failed:", error);
      toast({ title: "Bulk Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage and track participant attendance.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Auto-refresh</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportCsvDialog onImportSuccess={fetchData} />
          <ExportExcelButton
            participants={participants}
            currentFilters={{
              school: selectedSchool,
              committee: selectedCommittee,
              status: statusFilter === 'All' ? undefined : statusFilter,
              day: dayFilter,
            }}
          />
          <ExportCsvButton participants={filteredParticipants} />
          <Button onClick={handleAddParticipant} disabled={!permissions?.canEditParticipants} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Participant
          </Button>
        </div>
      </div>

      {/* Current Day Indicator and Advanced Filters */}
      <div className="p-3 sm:p-4 border rounded-lg shadow-sm bg-card space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Conference Day:</span>
              <span className="text-lg sm:text-xl font-bold text-foreground">
                {currentDay === 'day1' ? 'Day 1' : 'Day 2'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Today's Status</div>
              <div className="flex gap-3 sm:gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Present:</span>
                  <span className="ml-1 text-sm font-bold text-green-600 dark:text-green-400">
                    {attendanceStats.currentDayPresent}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Absent:</span>
                  <span className="ml-1 text-sm font-bold text-red-600 dark:text-red-400">
                    {attendanceStats.currentDayAbsent}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground border-l pl-4">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Search by name, school, committee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full focus-visible:ring-primary"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Select value={selectedSchool} onValueChange={setSelectedSchool} disabled={isLoading}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All Schools" /></SelectTrigger>
              <SelectContent>{systemSchools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedCommittee} onValueChange={setSelectedCommittee} disabled={isLoading}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All Committees" /></SelectTrigger>
              <SelectContent>{systemCommittees.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as AttendanceStatus | 'All')} disabled={isLoading}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => <SelectItem key={opt.status} value={opt.status}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dayFilter} onValueChange={(val) => setDayFilter(val as 'All' | 'Day 1' | 'Day 2' | 'Both Days')} disabled={isLoading}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All Days" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Days</SelectItem>
                <SelectItem value="Day 1">Day 1 Only</SelectItem>
                <SelectItem value="Day 2">Day 2 Only</SelectItem>
                <SelectItem value="Both Days">Both Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedParticipantIds.length > 0 && (
          <div className="border-t pt-3 sm:pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <span className="text-sm font-semibold text-muted-foreground">{selectedParticipantIds.length} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isBulkUpdating || isBulkDeleting || (!permissions?.canEditParticipants && !permissions?.canDeleteParticipants)} className="w-full sm:w-auto">
                  <Layers className="mr-2 h-4 w-4" />
                  Bulk Actions
                  {(isBulkUpdating || isBulkDeleting) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Set status for selected to:</DropdownMenuLabel>
                {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => (
                  <DropdownMenuItem key={opt.status} onClick={() => handleBulkStatusUpdate(opt.status)} disabled={isBulkUpdating || !permissions?.canEditParticipants}>
                    <opt.icon className="mr-2 h-4 w-4" />{opt.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={confirmBulkDelete} disabled={isBulkDeleting || !permissions?.canDeleteParticipants} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <ParticipantTable
        participants={displayedParticipants}
        isLoading={isLoading}
        onEditParticipant={handleEditParticipant}
        visibleColumns={visibleColumns}
        selectedParticipants={selectedParticipantIds}
        onSelectParticipant={handleSelectParticipant}
        onSelectAll={handleSelectAll}
        isAllSelected={isAllSelected}
      />

      {/* Pagination Controls */}
      {!isLoading && filteredParticipants.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredParticipants.length)} of {filteredParticipants.length} participants
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per page:</span>
              <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(Number(val))}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        </div>
      )}

      <ParticipantForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        participantToEdit={participantToEdit}
        schools={systemSchools.filter(s => s !== 'All Schools')}
        committees={systemCommittees.filter(c => c !== 'All Committees')}
        onFormSubmitSuccess={fetchData}
      />

      <AlertDialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedParticipantIds.length} selected participant(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-destructive hover:bg-destructive/90">
              {isBulkDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Yes, Delete Selected'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}