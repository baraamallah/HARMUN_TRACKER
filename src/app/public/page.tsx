
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ListFilter, CheckSquare, Square, Users } from 'lucide-react';
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
  DropdownMenuItem, // Added DropdownMenuItem here
} from '@/components/ui/dropdown-menu';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getSystemSchools, getSystemCommittees, getParticipants as getParticipantsAction } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Omit 'selection' and 'actions' as they are not relevant for public view
type PublicVisibleColumns = Omit<VisibleColumns, 'selection' | 'actions'>;

const initialVisibleColumns: PublicVisibleColumns = {
  avatar: true,
  name: true,
  school: true,
  committee: true,
  country: true,
  status: true,
};

const columnLabels: Record<keyof PublicVisibleColumns, string> = {
  avatar: 'Avatar',
  name: 'Name',
  school: 'School',
  committee: 'Committee',
  country: 'Country',
  status: 'Status',
};

const statusFilterOptions: { label: string; value: AttendanceStatus | 'All' }[] = [
  { label: 'All Participants', value: 'All' },
  { label: 'Present', value: 'Present' },
  { label: 'Absent', value: 'Absent' },
];

function PublicPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict
  const { toast } = useToast();

  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState(searchParamsHook.get('search') || '');
  const [selectedSchool, setSelectedSchool] = React.useState(searchParamsHook.get('school') || 'All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState(searchParamsHook.get('committee') || 'All Committees');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<AttendanceStatus | 'All'>(
    (searchParamsHook.get('status') as AttendanceStatus | 'All') || 'All'
  );

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<PublicVisibleColumns>(initialVisibleColumns);

  const updateURLParams = React.useCallback(() => {
    const params = new URLSearchParams(searchParamsHook.toString()); // Use searchParamsHook
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm); else params.delete('search');
    if (selectedSchool && selectedSchool !== 'All Schools') params.set('school', selectedSchool); else params.delete('school');
    if (selectedCommittee && selectedCommittee !== 'All Committees') params.set('committee', selectedCommittee); else params.delete('committee');
    if (quickStatusFilter && quickStatusFilter !== 'All') params.set('status', quickStatusFilter); else params.delete('status');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedSearchTerm, selectedSchool, selectedCommittee, quickStatusFilter, router, pathname, searchParamsHook]);


  React.useEffect(() => {
    updateURLParams(); // Update URL whenever filters change

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const fetchedParticipants = await getParticipantsAction({
          school: selectedSchool === 'All Schools' ? undefined : selectedSchool,
          committee: selectedCommittee === 'All Committees' ? undefined : selectedCommittee,
          searchTerm: debouncedSearchTerm,
          status: quickStatusFilter,
        });
        setParticipants(fetchedParticipants);

        if (schools.length === 0 || committees.length === 0) {
          const [schoolsData, committeesData] = await Promise.all([
            getSystemSchools(),
            getSystemCommittees(),
          ]);
          setSchools(['All Schools', ...schoolsData]);
          setCommittees(['All Committees', ...committeesData]);
        }
      } catch (error: any) {
        console.error("Failed to fetch data for public view:", error);
        toast({
          title: "Error Loading Data",
          description: error.message || "Could not retrieve participant data for the public view.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [debouncedSearchTerm, selectedSchool, selectedCommittee, quickStatusFilter, toast, schools.length, committees.length, updateURLParams]);


  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(
      Object.keys(initialVisibleColumns).reduce((acc, key) => {
        acc[key as keyof PublicVisibleColumns] = show;
        return acc;
      }, {} as PublicVisibleColumns)
    );
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
              {(Object.keys(visibleColumns) as Array<keyof PublicVisibleColumns>).map((key) => (
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
        </div>

        <ParticipantTable
          participants={participants}
          isLoading={isLoadingData}
          onEditParticipant={() => { /* No edit on public page */ }}
          visibleColumns={{
            ...visibleColumns,
            selection: false, // Explicitly false
            actions: false, // Explicitly false
          }}
          selectedParticipants={[]}
          onSelectParticipant={() => {}}
          onSelectAll={() => {}}
          isAllSelected={false}
        />

        {participants.length > 0 && !isLoadingData && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Displaying {participants.length} participant(s). Links go to read-only profiles.
          </p>
        )}
      </div>
    </PublicLayout>
  );
}


export default function PublicPage() {
  return (
    <React.Suspense fallback={
      <PublicLayout>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-1/2 mb-2" />
          <Skeleton className="h-8 w-3/4 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </PublicLayout>
    }>
      <PublicPageContent />
    </React.Suspense>
  );
}
