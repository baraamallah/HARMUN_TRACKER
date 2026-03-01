'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { PlusCircle, Loader2, Users2 as UsersIcon, Layers, Trash2, Filter, Calendar } from 'lucide-react';
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
import { StaffMemberTable } from '@/components/staff/StaffMemberTable';
import { StaffMemberForm } from '@/components/staff/StaffMemberForm';
import type { StaffMember, StaffVisibleColumns, StaffAttendanceStatus } from '@/types';
import { getStaffMembers, getCurrentConferenceDay } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { ImportStaffCsvDialog } from '@/components/staff/ImportStaffCsvDialog';
import { ExportStaffCsvButton } from '@/components/staff/ExportStaffCsvButton';
import { ExportStaffExcelButton } from '@/components/staff/ExportStaffExcelButton';
import { writeBatch, doc, serverTimestamp, query, collection, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { STAFF_BULK_STATUS_OPTIONS, ALL_STAFF_STATUS_FILTER_OPTIONS } from '@/lib/constants';

interface StaffDashboardClientProps {
    initialStaffMembers: StaffMember[];
    systemStaffTeams: string[];
}

export function StaffDashboardClient({ initialStaffMembers, systemStaffTeams }: StaffDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { loggedInUser: user, permissions, authSessionLoading: isAuthLoading } = useAuth();
  
  const [staffMembers, setStaffMembers] = React.useState<StaffMember[]>(initialStaffMembers);
  const [isLoading, setIsLoading] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<StaffAttendanceStatus | 'All' | 'Others'>('All');
  const [selectedTeamFilter, setSelectedTeamFilter] = React.useState<string>('All Teams');

  const [isStaffFormOpen, setIsStaffFormOpen] = React.useState(false);
  const [staffToEdit, setStaffToEdit] = React.useState<StaffMember | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<StaffVisibleColumns>({
    selection: true, avatar: true, name: true, role: true, department: true,
    team: true, contactInfo: true, status: true, actions: true,
  });

  const [selectedStaffMemberIds, setSelectedStaffMemberIds] = React.useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login?redirect=/staff');
    }
  }, [isAuthLoading, user, router]);
  
  const fetchData = React.useCallback(async () => {
    if (isAuthLoading || !user) return;

    setIsLoading(true);
    try {
        const statusToFetch = quickStatusFilter === 'Others' ? 'All' : quickStatusFilter;
        const fetchedStaff = await getStaffMembers({
            team: selectedTeamFilter,
            status: statusToFetch,
            searchTerm: debouncedSearchTerm,
        });
        setStaffMembers(fetchedStaff);
    } catch (error: any) {
        console.error("Failed to fetch filtered staff data:", error);
        toast({ title: "Error", description: error.message || "Could not load staff members.", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [selectedTeamFilter, quickStatusFilter, debouncedSearchTerm, toast, isAuthLoading, user]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time listener for auto-refresh
  const fetchDataRef = React.useRef(fetchData);
  React.useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  React.useEffect(() => {
    if (isAuthLoading || !user) return;

    const staffRef = collection(db, 'staff_members');
    const q = query(staffRef, orderBy('createdAt', 'desc'));

    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }

        const changes = snapshot.docChanges();
        if (changes.length > 0 && !snapshot.metadata.hasPendingWrites) {
          console.log('Staff real-time update detected:', changes.length, 'changes');
          fetchDataRef.current();
        }
      },
      (error) => {
        console.error('Staff real-time listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [isAuthLoading, user]);

  // Client-side Others filter
  const filteredStaffMembers = React.useMemo(() => {
    if (quickStatusFilter !== 'Others') return staffMembers;
    return staffMembers.filter(s => s.status === 'On Break' || s.status === 'Away');
  }, [staffMembers, quickStatusFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStaffMembers.length / pageSize);
  const displayedStaffMembers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredStaffMembers.slice(startIndex, endIndex);
  }, [filteredStaffMembers, currentPage, pageSize]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedTeamFilter, quickStatusFilter, pageSize]);

  // Fetch current conference day on mount (for consistency with dashboard)
  const [currentDay, setCurrentDay] = React.useState<'day1' | 'day2'>('day1');
  React.useEffect(() => {
    const fetchCurrentDay = async () => {
      try {
        const day = await getCurrentConferenceDay();
        setCurrentDay(day);
      } catch (error) {
        console.error('Error fetching current conference day:', error);
      }
    };
    fetchCurrentDay();
  }, []);

  // Calculate staff stats
  const staffStats = React.useMemo(() => {
    const total = staffMembers.length;
    const onDuty = staffMembers.filter(s => s.status === 'On Duty').length;
    const offDuty = staffMembers.filter(s => s.status === 'Off Duty').length;
    const onBreak = staffMembers.filter(s => s.status === 'On Break').length;
    const away = staffMembers.filter(s => s.status === 'Away').length;
    const others = onBreak + away;
    return { total, onDuty, offDuty, onBreak, away, others };
  }, [staffMembers]);

  const handleAddStaffMember = () => {
    setStaffToEdit(null);
    setIsStaffFormOpen(true);
  };

  const handleEditStaffMember = (staffMember: StaffMember) => {
    setStaffToEdit(staffMember);
    setIsStaffFormOpen(true);
  };

  const handleSelectStaffMember = (staffMemberId: string, isSelected: boolean) => {
    setSelectedStaffMemberIds(prev => isSelected ? [...prev, staffMemberId] : prev.filter(id => id !== staffMemberId));
  };

  const handleSelectAllStaff = (isSelected: boolean) => {
    setSelectedStaffMemberIds(isSelected ? displayedStaffMembers.map(s => s.id) : []);
  };

  const isAllStaffSelected = displayedStaffMembers.length > 0 && displayedStaffMembers.every(s => selectedStaffMemberIds.includes(s.id));

  const handleBulkStatusUpdate = async (status: StaffAttendanceStatus) => {
    if (selectedStaffMemberIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedStaffMemberIds.forEach(id => {
        batch.update(doc(db, "staff_members", id), { status, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      toast({ title: "Bulk Update Successful", description: `${selectedStaffMemberIds.length} staff member(s) updated to ${status}.` });
      fetchData();
      setSelectedStaffMemberIds([]);
    } catch (error: any) {
      console.error("Bulk staff update failed:", error);
      toast({ title: "Bulk Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const confirmBulkDelete = () => {
    if (selectedStaffMemberIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedStaffMemberIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedStaffMemberIds.forEach(id => {
        batch.delete(doc(db, "staff_members", id));
      });
      await batch.commit();
      toast({ title: "Bulk Delete Successful", description: `${selectedStaffMemberIds.length} staff member(s) deleted.` });
      fetchData();
      setSelectedStaffMemberIds([]);
    } catch (error: any) {
      console.error("Bulk staff delete failed:", error);
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staff Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage staff members, their roles, teams, and status.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Auto-refresh</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Layers className="mr-2 h-4 w-4" /> Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-2">
              <div className="flex flex-col gap-2">
                <ImportStaffCsvDialog onImportSuccess={fetchData} />
                <ExportStaffExcelButton staffMembers={staffMembers} />
                <ExportStaffCsvButton staffMembers={staffMembers} />
                <Button onClick={handleAddStaffMember} disabled={!permissions?.canCreateStaff} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Staff Member
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Staff Status</div>
              <div className="flex gap-3 sm:gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">On Duty:</span>
                  <span className="ml-1 text-sm font-bold text-green-600 dark:text-green-400">
                    {staffStats.onDuty}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Off Duty:</span>
                  <span className="ml-1 text-sm font-bold text-red-600 dark:text-red-400">
                    {staffStats.offDuty}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Others:</span>
                  <span className="ml-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                    {staffStats.others}
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
            placeholder="Search by name, role, department, team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full focus-visible:ring-primary"
            disabled={isLoading}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <Select value={quickStatusFilter} onValueChange={(value) => setQuickStatusFilter(value as StaffAttendanceStatus | 'All' | 'Others')} disabled={isLoading}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                {ALL_STAFF_STATUS_FILTER_OPTIONS.map((opt) => <SelectItem key={opt.status} value={opt.status}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter} disabled={isLoading}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Filter by team" /></SelectTrigger>
              <SelectContent>
                {systemStaffTeams.map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedStaffMemberIds.length > 0 && (
            <div className="border-t pt-3 sm:pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <span className="text-sm font-semibold text-muted-foreground">{selectedStaffMemberIds.length} selected</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isBulkUpdating || isBulkDeleting || (!permissions?.canEditStaff && !permissions?.canDeleteStaff)}>
                      <Layers className="mr-2 h-4 w-4" /> Bulk Actions
                      {(isBulkUpdating || isBulkDeleting) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Set status for selected to:</DropdownMenuLabel>
                    {STAFF_BULK_STATUS_OPTIONS.map(opt => (
                      <DropdownMenuItem key={opt.status} onClick={() => handleBulkStatusUpdate(opt.status)} disabled={isBulkUpdating || !permissions?.canEditStaff}>
                        <opt.icon className="mr-2 h-4 w-4" /> {opt.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={confirmBulkDelete} disabled={isBulkDeleting || !permissions?.canDeleteStaff} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )}
      </div>

      <StaffMemberTable
        staffMembers={displayedStaffMembers}
        isLoading={isLoading}
        onEditStaffMember={handleEditStaffMember}
        visibleColumns={visibleColumns}
        selectedStaffMembers={selectedStaffMemberIds}
        onSelectStaffMember={handleSelectStaffMember}
        onSelectAll={handleSelectAllStaff}
        isAllSelected={isAllStaffSelected}
      />

      {/* Pagination Controls */}
      {!isLoading && filteredStaffMembers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredStaffMembers.length)} of {filteredStaffMembers.length} staff members
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

      <StaffMemberForm
        isOpen={isStaffFormOpen}
        onOpenChange={setIsStaffFormOpen}
        staffMemberToEdit={staffToEdit}
        onFormSubmitSuccess={fetchData}
        staffTeams={systemStaffTeams.filter(t => t !== 'All Teams')}
      />

      <AlertDialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedStaffMemberIds.length} selected staff member(s)? This action cannot be undone.
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