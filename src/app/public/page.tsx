
'use client';

import * as React from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ListFilter,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getSystemSchools, getSystemCommittees, getParticipants } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const initialVisibleColumns: Omit<VisibleColumns, 'actions' | 'selection'> = {
  avatar: true,
  name: true,
  school: true,
  committee: true,
  country: true, // Added missing country property
  status: true,
};

const columnLabels: Record<keyof Omit<VisibleColumns, 'actions' | 'selection'>, string> = {
  avatar: 'Avatar',
  name: 'Name',
  school: 'School',
  committee: 'Committee',
  country: 'Country',
  status: 'Status',
};

export default function PublicAttendancePage() {
  const { toast } = useToast();
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [statusFilter, setStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] =
    React.useState<Omit<VisibleColumns, 'actions' | 'selection'>>(initialVisibleColumns);

  const fetchData = React.useCallback(async () => {
    setIsLoadingData(true);
    try {
      const fetchedParticipants = await getParticipants({
        school: selectedSchool,
        committee: selectedCommittee,
        searchTerm: debouncedSearchTerm,
        status: statusFilter,
      });
      setParticipants(fetchedParticipants);

      const [schoolsData, committeesData] = await Promise.all([
        getSystemSchools(),
        getSystemCommittees(),
      ]);
      setSchools(['All Schools', ...schoolsData]);
      setCommittees(['All Committees', ...committeesData]);
    } catch (error: any) {
      console.error("Failed to fetch public data:", error);
      let errorMessage = "Failed to load attendance data.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Check Firestore rules for public access.";
      } else if (error.message && error.message.includes('requires an index')) {
        errorMessage = "A Firestore index is required for the query. Check browser console for a link to create it.";
      }
      toast({title: "Error", description: errorMessage, variant: "destructive"})
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm, statusFilter, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key as keyof Omit<VisibleColumns, 'actions' | 'selection'>] = show;
        return acc;
      }, {} as Omit<VisibleColumns, 'actions' | 'selection'>)
    );
  };

  const statusFilterOptions: { label: string; value: AttendanceStatus | 'All' }[] = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Present', value: 'Present' },
    { label: 'Absent', value: 'Absent' },
  ];

  // The public page doesn't need editing or selection capabilities
  const fullVisibleColumns: VisibleColumns = {
    ...visibleColumns,
    actions: false, // Actions are not available on public view
    selection: false, // Selection is not available on public view
  };

  return (
    <PublicLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Public Attendance View</h1>
            <p className="text-muted-foreground">
              View participant attendance status. Data is read-only.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
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
                {(Object.keys(visibleColumns) as Array<keyof Omit<VisibleColumns, 'actions' | 'selection'>>).map((key) => (
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
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4 p-4 border rounded-lg shadow-sm bg-card items-center">
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
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AttendanceStatus | 'All')}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {isLoadingData ? (
             <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-lg text-muted-foreground">Loading attendance data...</p>
              </div>
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
        ) : (
          <ParticipantTable
            participants={participants}
            isLoading={false} // isLoadingData is handled above
            onEditParticipant={() => {}} // No edit on public page
            visibleColumns={fullVisibleColumns}
            selectedParticipants={[]} // No selection on public page
            onSelectParticipant={() => {}} // No selection
            onSelectAll={() => {}} // No selection
            isAllSelected={false} // No selection
          />
        )}
      </div>
    </PublicLayout>
  );
}
