
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, ListFilter, Loader2, Users2, Layers, Trash2, CheckSquare, Square, UploadCloud, DownloadCloud } from 'lucide-react'; // Added UploadCloud, DownloadCloud
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
import { StaffMemberTable } from '@/components/staff/StaffMemberTable';
import { StaffMemberForm } from '@/components/staff/StaffMemberForm';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import type { StaffMember, StaffVisibleColumns, StaffAttendanceStatus } from '@/types';
import { getSystemStaffTeams } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImportStaffCsvDialog } from '@/components/staff/ImportStaffCsvDialog'; // Added
import { ExportStaffCsvButton } from '@/components/staff/ExportStaffCsvButton'; // Added

const ALL_STAFF_STATUS_FILTER_OPTIONS: { status: StaffAttendanceStatus | 'All'; label: string; }[] = [
    { status: 'All', label: 'All Statuses' },
    { status: 'On Duty', label: 'On Duty' },
    { status: 'Off Duty', label: 'Off Duty' },
    { status: 'On Break', label: 'On Break' },
    { status: 'Away', label: 'Away' },
];

const STAFF_BULK_STATUS_OPTIONS: { status: StaffAttendanceStatus; label: string; icon: React.ElementType }[] = [
    { status: 'On Duty', label: 'On Duty', icon: Users2 },
    { status: 'Off Duty', label: 'Off Duty', icon: Users2 },
    { status: 'On Break', label: 'On Break', icon: Users2 },
    { status: 'Away', label: 'Away', icon: Users2 },
];


export default function StaffDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);

  const [staffMembers, setStaffMembers] = React.useState<StaffMember[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [systemStaffTeams, setSystemStaffTeams] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<StaffAttendanceStatus | 'All'>('All');
  const [selectedTeamFilter, setSelectedTeamFilter] = React.useState<string>('All Teams');


  const [isStaffFormOpen, setIsStaffFormOpen] = React.useState(false);
  const [staffToEdit, setStaffToEdit] = React.useState<StaffMember | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<StaffVisibleColumns>({
    selection: true,
    avatar: true,
    name: true,
    role: true,
    department: true,
    team: true,
    contactInfo: true,
    status: true,
    actions: true,
  });

  const columnLabels: Record<keyof StaffVisibleColumns, string> = {
    selection: 'Select',
    avatar: 'Avatar',
    name: 'Name',
    role: 'Role',
    department: 'Department',
    team: 'Team',
    contactInfo: 'Contact Info',
    status: 'Status',
    actions: 'Actions',
  };

  const [selectedStaffMemberIds, setSelectedStaffMemberIds] = React.useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);


  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        router.push('/auth/login');
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchData = React.useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingData(true);
    try {
      const staffColRef = collection(db, 'staff_members');
      const queryConstraints = [];

      if (selectedTeamFilter !== "All Teams") {
        queryConstraints.push(where('team', '==', selectedTeamFilter));
      }
      if (quickStatusFilter !== 'All') {
        queryConstraints.push(where('status', '==', quickStatusFilter));
      }
      
      const q = query(staffColRef, ...queryConstraints, orderBy('name'));
      const staffQuerySnapshot = await getDocs(q);
      let fetchedStaffData = staffQuerySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
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
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as StaffMember;
      });

      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        fetchedStaffData = fetchedStaffData.filter(s =>
          s.name.toLowerCase().includes(term) ||
          (s.role && s.role.toLowerCase().includes(term)) ||
          (s.department && s.department.toLowerCase().includes(term)) ||
          (s.team && s.team.toLowerCase().includes(term))
        );
      }
      setStaffMembers(fetchedStaffData);
      setSelectedStaffMemberIds([]);

      const teamsData = await getSystemStaffTeams();
      setSystemStaffTeams(['All Teams', ...teamsData]);

    } catch (error: any) {
      console.error("Failed to fetch staff data (client-side):", error);
      let errorMessage = "Failed to load staff data.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Ensure you have rights to view staff data, and check Firestore rules.";
      } else if (error.message && error.message.includes('requires an index')) {
        errorMessage = "A Firestore index is required. Check browser console for a link to create it.";
      }
      toast({title: "Error", description: errorMessage, variant: "destructive"})
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser, debouncedSearchTerm, quickStatusFilter, selectedTeamFilter, toast]);

  React.useEffect(() => {
    if (!isAuthLoading && currentUser) {
      fetchData();
    }
  }, [fetchData, isAuthLoading, currentUser]);

  const handleAddStaffMember = () => {
    setStaffToEdit(null);
    setIsStaffFormOpen(true);
  };

  const handleEditStaffMember = (staffMember: StaffMember) => {
    setStaffToEdit(staffMember);
    setIsStaffFormOpen(true);
  };

  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key as keyof StaffVisibleColumns] = show;
        return acc;
      }, {} as StaffVisibleColumns)
    );
  };

  const handleSelectStaffMember = (staffMemberId: string, isSelected: boolean) => {
    setSelectedStaffMemberIds(prevSelected =>
      isSelected
        ? [...prevSelected, staffMemberId]
        : prevSelected.filter(id => id !== staffMemberId)
    );
  };

  const handleSelectAllStaff = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedStaffMemberIds(staffMembers.map(s => s.id));
    } else {
      setSelectedStaffMemberIds([]);
    }
  };

  const isAllStaffSelected = staffMembers.length > 0 && selectedStaffMemberIds.length === staffMembers.length;

  const handleBulkStatusUpdate = async (status: StaffAttendanceStatus) => {
    if (selectedStaffMemberIds.length === 0) {
      toast({ title: "No staff selected", description: "Please select staff members to update.", variant: "default" });
      return;
    }
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedStaffMemberIds.forEach(id => {
        const staffRef = doc(db, "staff_members", id);
        batch.update(staffRef, { status, updatedAt: serverTimestamp() });
      });
      await batch.commit();

      toast({
        title: "Bulk Update Successful",
        description: `${selectedStaffMemberIds.length} staff member(s) updated to ${status}.`,
      });
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error("Client-side Error bulk updating staff status: ", error);
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
    if (selectedStaffMemberIds.length === 0) {
      toast({ title: "No staff selected", description: "Please select staff members to delete.", variant: "default" });
      return;
    }
    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedStaffMemberIds.forEach(id => {
        const staffRef = doc(db, "staff_members", id);
        batch.delete(staffRef);
      });
      await batch.commit();

      toast({
        title: "Bulk Delete Successful",
        description: `${selectedStaffMemberIds.length} staff member(s) deleted.`,
      });
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error("Client-side error during staff bulk deletion: ", error);
      toast({ title: "Bulk Delete Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };


  if (isAuthLoading) {
    return (
      <AppLayoutClientShell>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Verifying authentication...</p>
          </div>
           <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </AppLayoutClientShell>
    );
  }

  if (!currentUser) {
    return (
       <AppLayoutClientShell>
        <div className="flex items-center justify-center h-64">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
        </div>
       </AppLayoutClientShell>
    );
  }

  return (
    <AppLayoutClientShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
            <p className="text-muted-foreground">Manage staff members, their roles, teams, and status.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ImportStaffCsvDialog onImportSuccess={fetchData} />
            <ExportStaffCsvButton staffMembers={staffMembers} />
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
                {(Object.keys(visibleColumns) as Array<keyof StaffVisibleColumns>).map((key) => (
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
            <Button onClick={handleAddStaffMember}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Staff Member
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 p-4 border rounded-lg shadow-sm bg-card items-center">
          <Input
            placeholder="Search by name, role, department, team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow"
          />
          <Select value={quickStatusFilter} onValueChange={(value) => setQuickStatusFilter(value as StaffAttendanceStatus | 'All')}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STAFF_STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.status} value={opt.status}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              {systemStaffTeams.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 items-center">
            {selectedStaffMemberIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" disabled={isBulkUpdating || isBulkDeleting}>
                    <Layers className="mr-2 h-4 w-4" />
                    Actions for {selectedStaffMemberIds.length} Selected
                    {(isBulkUpdating || isBulkDeleting) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Set status for selected to:</DropdownMenuLabel>
                  {STAFF_BULK_STATUS_OPTIONS.map(opt => (
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

        <StaffMemberTable
          staffMembers={staffMembers}
          isLoading={isLoadingData}
          onEditStaffMember={handleEditStaffMember}
          visibleColumns={visibleColumns}
          selectedStaffMembers={selectedStaffMemberIds}
          onSelectStaffMember={handleSelectStaffMember}
          onSelectAll={handleSelectAllStaff}
          isAllSelected={isAllStaffSelected}
        />
      </div>

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
              Are you sure you want to permanently delete {selectedStaffMemberIds.length} selected staff member(s)?
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
