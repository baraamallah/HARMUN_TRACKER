
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, ListFilter, CheckSquare, Square, Loader2, Layers, CheckCircle, XCircle, Coffee, UserRound, Wrench, LogOutIcon, AlertOctagon, Trash2, Users as UsersIcon, Filter } from 'lucide-react';
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
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getParticipants } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
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

interface ParticipantDashboardClientProps {
  initialParticipants: Participant[];
  systemSchools: string[];
  systemCommittees: string[];
}

export function ParticipantDashboardClient({ initialParticipants, systemSchools, systemCommittees }: ParticipantDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  // State management
  const [participants, setParticipants] = React.useState<Participant[]>(initialParticipants);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [statusFilter, setStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = React.useState<Participant | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<VisibleColumns>({
    selection: true, avatar: true, name: true, school: true,
    committee: true, country: true, status: true, actions: true,
  });
  
  const columnLabels: Record<keyof VisibleColumns, string> = {
    selection: 'Select', avatar: 'Avatar', name: 'Name', school: 'School',
    committee: 'Committee', country: 'Country', status: 'Status', actions: 'Actions',
  };

  const [selectedParticipantIds, setSelectedParticipantIds] = React.useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);

  // Effect for fetching data when filters change
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedParticipants = await getParticipants({
        school: selectedSchool,
        committee: selectedCommittee,
        status: statusFilter,
        searchTerm: debouncedSearchTerm,
      });
      setParticipants(fetchedParticipants);
    } catch (error: any) {
      console.error("Failed to fetch filtered data:", error);
      toast({ title: "Error", description: error.message || "Could not load participants.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchool, selectedCommittee, statusFilter, debouncedSearchTerm, toast]);

  React.useEffect(() => {
    // We don't fetch on initial load because we have initialParticipants
    // This effect runs only when filters change.
    fetchData();
  }, [fetchData]);

  // Handlers
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
    setSelectedParticipantIds(isSelected ? participants.map(p => p.id) : []);
  };

  const isAllSelected = participants.length > 0 && selectedParticipantIds.length === participants.length;

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
          <p className="text-muted-foreground">Manage and track participant attendance.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportCsvDialog onImportSuccess={fetchData} />
          <ExportCsvButton participants={participants} />
          <Button onClick={handleAddParticipant}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Participant
          </Button>
        </div>
      </div>

      <div className="p-4 border rounded-lg shadow-sm bg-card space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by name, school, committee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow focus-visible:ring-primary"
            />
            <div className="flex gap-4">
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="All Schools" /></SelectTrigger>
                  <SelectContent>{systemSchools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
                  <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="All Committees" /></SelectTrigger>
                  <SelectContent>{systemCommittees.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as AttendanceStatus | 'All')}>
                  <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => <SelectItem key={opt.status} value={opt.status}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
            </div>
        </div>

        {selectedParticipantIds.length > 0 && (
          <div className="border-t pt-4 flex items-center gap-4">
             <span className="text-sm font-semibold text-muted-foreground">{selectedParticipantIds.length} selected</span>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isBulkUpdating || isBulkDeleting}>
                    <Layers className="mr-2 h-4 w-4" />
                    Bulk Actions
                    {(isBulkUpdating || isBulkDeleting) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Set status for selected to:</DropdownMenuLabel>
                  {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.status} onClick={() => handleBulkStatusUpdate(opt.status)} disabled={isBulkUpdating}>
                      <opt.icon className="mr-2 h-4 w-4" />{opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={confirmBulkDelete} disabled={isBulkDeleting} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        )}
      </div>

      <ParticipantTable
        participants={participants}
        isLoading={isLoading}
        onEditParticipant={handleEditParticipant}
        visibleColumns={visibleColumns} // This can be managed by a column dropdown if needed
        selectedParticipants={selectedParticipantIds}
        onSelectParticipant={handleSelectParticipant}
        onSelectAll={handleSelectAll}
        isAllSelected={isAllSelected}
      />

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
