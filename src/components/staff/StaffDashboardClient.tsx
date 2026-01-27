'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { PlusCircle, Loader2, Users2 as UsersIcon, Layers, Trash2 } from 'lucide-react';
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
import { getStaffMembers } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { ImportStaffCsvDialog } from '@/components/staff/ImportStaffCsvDialog';
import { ExportStaffCsvButton } from '@/components/staff/ExportStaffCsvButton';
import { writeBatch, doc, serverTimestamp, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';

// Helper function to transform Firestore data into a StaffMember object
function toISODateString(dateValue: any): string | null {
  if (!dateValue) return null;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toISOString();
  }
  if (typeof dateValue === 'string') {
    if (!isNaN(Date.parse(dateValue))) {
       return new Date(dateValue).toISOString();
    }
  }
  return null;
}

function transformStaffDoc(docSnap: { id: string; data: () => any; }): StaffMember {
    const data = docSnap.data();
    return {
        id: String(docSnap.id),
        name: data.name || '',
        role: data.role || '',
        department: data.department || '',
        team: data.team || '',
        email: data.email || '',
        phone: data.phone || '',
        contactInfo: data.contactInfo || '',
        status: data.status || 'Off Duty',
        imageUrl: data.imageUrl,
        notes: data.notes || '',
        createdAt: toISODateString(data.createdAt),
        updatedAt: toISODateString(data.updatedAt),
    };
}

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
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<StaffAttendanceStatus | 'All'>('All');
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

  React.useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login?redirect=/staff');
    }
  }, [isAuthLoading, user, router]);
  
  const fetchData = React.useCallback(async () => {
    if (isAuthLoading || !user) return;

    setIsLoading(true);
    try {
        const staffColRef = collection(db, "staff_members");
        const queryConstraints = [];

        // Only apply one server-side filter at a time to avoid composite index requirements
        // Apply the most selective filter first
        if (selectedTeamFilter !== "All Teams") {
            queryConstraints.push(where('team', '==', selectedTeamFilter));
        } else if (quickStatusFilter !== 'All') {
            queryConstraints.push(where('status', '==', quickStatusFilter));
        }
        
        const q = query(staffColRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);

        let staffData = querySnapshot.docs.map(docSnap => transformStaffDoc(docSnap));

        // Apply remaining filters client-side
        if (selectedTeamFilter === "All Teams" && quickStatusFilter !== 'All') {
            // Status filter was already applied server-side, no additional filtering needed
        } else if (selectedTeamFilter !== "All Teams" && quickStatusFilter !== 'All') {
            // Team filter was applied server-side, now filter by status client-side
            staffData = staffData.filter(s => s.status === quickStatusFilter);
        }

        // Apply search filter client-side
        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            staffData = staffData.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.role.toLowerCase().includes(term) ||
                (s.department && s.department.toLowerCase().includes(term)) ||
                (s.team && s.team.toLowerCase().includes(term))
            );
        }
        
        setStaffMembers(staffData);
    } catch (error: any) {
        console.error("Failed to fetch filtered staff data:", error);
        let errorMessage = error.message || "Could not load staff members.";
        
        // Check if this is a composite index error
        if (error.code === 'failed-precondition' || (error.message && error.message.includes('index'))) {
            errorMessage = "A database index is required for this filter combination. The filters have been adjusted to work without requiring additional database configuration.";
            console.warn("Firestore composite index needed. URL:", error.message);
        }
        
        toast({ title: "Error", description: errorMessage, variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [selectedTeamFilter, quickStatusFilter, debouncedSearchTerm, toast, isAuthLoading, user]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    setSelectedStaffMemberIds(isSelected ? staffMembers.map(s => s.id) : []);
  };

  const isAllStaffSelected = staffMembers.length > 0 && selectedStaffMemberIds.length === staffMembers.length;

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">Manage staff members, their roles, teams, and status.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportStaffCsvDialog onImportSuccess={fetchData} />
          <ExportStaffCsvButton staffMembers={staffMembers} />
          <Button onClick={handleAddStaffMember} disabled={!permissions?.canCreateStaff}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Staff Member
          </Button>
        </div>
      </div>

      <div className="p-4 border rounded-lg shadow-sm bg-card space-y-4">
         <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search by name, role, department, team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow focus-visible:ring-primary"
            disabled={isLoading}
          />
          <div className="flex gap-4">
             <Select value={quickStatusFilter} onValueChange={(value) => setQuickStatusFilter(value as StaffAttendanceStatus | 'All')} disabled={isLoading}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                {ALL_STAFF_STATUS_FILTER_OPTIONS.map((opt) => <SelectItem key={opt.status} value={opt.status}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter} disabled={isLoading}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filter by team" /></SelectTrigger>
              <SelectContent>
                {systemStaffTeams.map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedStaffMemberIds.length > 0 && (
            <div className="border-t pt-4 flex items-center gap-4">
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
        staffMembers={staffMembers}
        isLoading={isLoading}
        onEditStaffMember={handleEditStaffMember}
        visibleColumns={visibleColumns}
        selectedStaffMembers={selectedStaffMemberIds}
        onSelectStaffMember={handleSelectStaffMember}
        onSelectAll={handleSelectAllStaff}
        isAllSelected={isAllStaffSelected}
      />

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