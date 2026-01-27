
'use client';

import * as React from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ListFilter, CheckSquare, Square, Loader2, Clock, CalendarDays } from 'lucide-react'; // Added Clock, CalendarDays
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
  DropdownMenuItem, // Ensured this is imported
} from '@/components/ui/dropdown-menu';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns'; // For formatting date and time

const initialVisibleColumns: Omit<VisibleColumns, 'actions' | 'selection'> = {
  avatar: true,
  name: true,
  school: true,
  committee: true,
  country: true, // Added country here
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

type PublicVisibleColumns = typeof initialVisibleColumns;

export default function PublicDashboardPage() {
  const { toast } = useToast();
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<PublicVisibleColumns>(initialVisibleColumns);

  const [currentTime, setCurrentTime] = React.useState<string | null>(null); // Initialize with null
  const [currentDate, setCurrentDate] = React.useState<string | null>(null); // Initialize with null

  React.useEffect(() => {
    // Set initial time/date and start interval only on client-side
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(format(now, 'p')); // e.g., 12:00:00 PM
      setCurrentDate(format(now, 'PPPP')); // e.g., Monday, January 1st, 2023
    };

    updateDateTime(); // Initial call
    const timerId = setInterval(updateDateTime, 1000); // Update every second

    return () => clearInterval(timerId); // Cleanup interval on component unmount
  }, []);


  const fetchData = React.useCallback(() => {
    setIsLoadingData(true);
    const participantsColRef = collection(db, 'participants');
    const queryConstraints = [];

    // Only apply one or two server-side filters to avoid composite index requirements
    // Priority: school > committee > status (most selective first)
    if (selectedSchool !== 'All Schools') {
      queryConstraints.push(where('school', '==', selectedSchool));
    } else if (selectedCommittee !== 'All Committees') {
      queryConstraints.push(where('committee', '==', selectedCommittee));
    } else if (quickStatusFilter !== 'All') {
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
          country: data.country,
          status: data.status || 'Absent',
          imageUrl: data.imageUrl,
          attended: data.attended || false,
          checkInTime: data.checkInTime instanceof Timestamp ? data.checkInTime.toDate().toISOString() : null,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        } as Participant;
      });

      // Apply remaining filters client-side
      if (selectedSchool !== 'All Schools') {
        // School filter applied server-side, apply committee and status client-side
        if (selectedCommittee !== 'All Committees') {
          fetchedParticipants = fetchedParticipants.filter(p => p.committee === selectedCommittee);
        }
        if (quickStatusFilter !== 'All') {
          fetchedParticipants = fetchedParticipants.filter(p => p.status === quickStatusFilter);
        }
      } else if (selectedCommittee !== 'All Committees') {
        // Committee filter applied server-side, apply status client-side
        if (quickStatusFilter !== 'All') {
          fetchedParticipants = fetchedParticipants.filter(p => p.status === quickStatusFilter);
        }
      }
      // If only status filter was applied, it was already done server-side

      // Apply search filter client-side
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
      console.error("Failed to fetch real-time participant data:", error);
      let errorMessage = "Failed to load participant data.";
      if ((error as any).code === 'permission-denied') {
        errorMessage = "Permission denied. Ensure you have rights to view participant data, and check Firestore rules.";
      } else if ((error as any).code === 'failed-precondition' || ((error as any).message && (error as any).message.includes('index'))) {
        errorMessage = "A database index is required for this filter combination. The filters have been adjusted to work without requiring additional database configuration.";
        console.warn("Firestore composite index needed:", (error as any).message);
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      setIsLoadingData(false);
    });

    return unsubscribe; // Return the unsubscribe function for cleanup

  }, [selectedSchool, selectedCommittee, debouncedSearchTerm, quickStatusFilter, toast]);

  React.useEffect(() => {
    const unsubscribe = fetchData();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchData]);


  React.useEffect(() => {
    // Fetch schools and committees once on mount
    const fetchDropdownData = async () => {
      try {
        const [schoolsData, committeesData] = await Promise.all([
          getSystemSchools(),
          getSystemCommittees(),
        ]);
        setSchools(['All Schools', ...schoolsData]);
        setCommittees(['All Committees', ...committeesData]);
      } catch (error) {
        console.error("Failed to fetch schools/committees for public view:", error);
        toast({title: "Error", description: "Could not load filter options.", variant: "destructive"});
      }
    };
    fetchDropdownData();
  }, [toast]);


  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key as keyof PublicVisibleColumns] = show;
        return acc;
      }, {} as PublicVisibleColumns)
    );
  };

  const statusFilterOptions: { label: string; value: AttendanceStatus | 'All' }[] = [
    { label: 'All Participants', value: 'All' },
    { label: 'Present', value: 'Present' },
    { label: 'Absent', value: 'Absent' },
  ];

  return (
    <PublicLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg shadow-sm bg-card">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Public Participant View</h1>
                <p className="text-muted-foreground">View participant attendance status.</p>
            </div>
            <div className="text-right">
              {currentTime && currentDate ? (
                <>
                  <p className="text-2xl font-semibold text-primary flex items-center justify-end gap-2">
                    <Clock className="h-6 w-6" /> {currentTime}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center justify-end gap-2">
                    <CalendarDays className="h-4 w-4" /> {currentDate}
                  </p>
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-32 mb-1" />
                  <Skeleton className="h-5 w-48" />
                </>
              )}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4 p-4 border rounded-lg shadow-sm bg-card items-end">
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
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full md:w-auto">
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
                {(Object.keys(initialVisibleColumns) as Array<keyof PublicVisibleColumns>).map((key) => (
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

        <div className="flex flex-wrap gap-2 mb-4">
            {statusFilterOptions.map(opt => (
              <Button
                key={opt.value}
                variant={quickStatusFilter === opt.value ? "default" : "outline"}
                onClick={() => setQuickStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
        </div>
        
        <ParticipantTable
          participants={participants}
          isLoading={isLoadingData}
          onEditParticipant={() => { /* No edit action on public page */ }}
          visibleColumns={{ ...visibleColumns, actions: false, selection: false }} // Actions and selection not needed for public
          selectedParticipants={[]}
          onSelectParticipant={() => {}}
          onSelectAll={() => {}}
          isAllSelected={false}
        />
      </div>
    </PublicLayout>
  );
}
