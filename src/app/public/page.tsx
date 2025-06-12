
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation'; // Added usePathname, useRouter, useSearchParams
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp, Unsubscribe } from 'firebase/firestore';
import { ListFilter, CheckSquare, Square, Loader2, Users, Clock } from 'lucide-react';
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
  DropdownMenuItem, // Ensure this is imported
} from '@/components/ui/dropdown-menu';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const initialVisibleColumns: Omit<VisibleColumns, "selection" | "actions"> = {
  avatar: true,
  name: true,
  school: true,
  committee: true,
  country: true, // Added country
  status: true,
};

const columnLabels: Record<keyof typeof initialVisibleColumns, string> = {
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

function PublicDashboardPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams(); // For potential future direct linking with filters

  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState(searchParams.get('search') || '');
  const [selectedSchool, setSelectedSchool] = React.useState(searchParams.get('school') || 'All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState(searchParams.get('committee') || 'All Committees');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<AttendanceStatus | 'All'>(
    (searchParams.get('status') as AttendanceStatus | 'All') || 'All'
  );

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState(initialVisibleColumns);

  const [currentTimeDisplay, setCurrentTimeDisplay] = React.useState<string>('');

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeDisplay(format(new Date(), 'PPPPpppp')); // e.g., July 21st, 2024 at 10:30:00 AM
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = React.useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [schoolsData, committeesData] = await Promise.all([
        getSystemSchools(),
        getSystemCommittees(),
      ]);
      setSchools(['All Schools', ...schoolsData]);
      setCommittees(['All Committees', ...committeesData]);
    } catch (error: any) {
      console.error("Failed to fetch system lists for public view:", error);
      toast({title: "Error", description: "Could not load filter options.", variant: "destructive"})
    }
  }, [toast]);


  React.useEffect(() => {
    fetchData(); // Fetch schools and committees once
  }, [fetchData]);

  React.useEffect(() => {
    setIsLoadingData(true);
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

    const unsubscribe = onSnapshot(participantsQuery, (querySnapshot) => {
      let fetchedParticipants = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          school: data.school || '',
          committee: data.committee || '',
          country: data.country || '',
          status: data.status || 'Absent',
          imageUrl: data.imageUrl,
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
      setIsLoadingData(false);
    }, (error) => {
      console.error("Error fetching participants with onSnapshot:", error);
      let errorMessage = "Failed to load participant data.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Ensure Firestore rules allow public read access for participants.";
      } else if ((error.message || '').includes('requires an index')) {
        errorMessage = "A Firestore index is required. Check browser console for a link to create it.";
      }
      toast({title: "Error", description: errorMessage, variant: "destructive"});
      setIsLoadingData(false);
    });

    return () => unsubscribe(); // Cleanup listener on component unmount or when dependencies change

  }, [selectedSchool, selectedCommittee, quickStatusFilter, debouncedSearchTerm, toast]);


  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key as keyof typeof initialVisibleColumns] = show;
        return acc;
      }, {} as typeof initialVisibleColumns)
    );
  };


  return (
    <PublicLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Public Attendance View</h1>
            <p className="text-muted-foreground">View participant attendance status (read-only).</p>
          </div>
          {currentTimeDisplay && (
            <div className="text-sm text-muted-foreground p-2 border rounded-md shadow-sm bg-card flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{currentTimeDisplay}</span>
            </div>
          )}
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
              {(Object.keys(initialVisibleColumns) as Array<keyof typeof initialVisibleColumns>).map((key) => (
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

        <div className="flex flex-wrap gap-2 mb-4">
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
          visibleColumns={{ ...visibleColumns, selection: false, actions: false }}
          selectedParticipants={[]}
          onSelectParticipant={() => {}}
          onSelectAll={() => {}}
          isAllSelected={false}
        />
      </div>
    </PublicLayout>
  );
}


export default function PublicDashboardPage() {
  // Wrap content with Suspense for useSearchParams
  return (
    <React.Suspense fallback={
      <PublicLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading Public View...</p>
          </div>
           <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </PublicLayout>
    }>
      <PublicDashboardPageContent />
    </React.Suspense>
  );
}
