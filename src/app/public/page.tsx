
'use client';

import * as React from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ListFilter, CheckSquare, Square, Loader2, Clock, CalendarDays, Filter, Calendar } from 'lucide-react';
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
import { getSystemSchools, getSystemCommittees, getParticipants, getCurrentConferenceDay } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ALL_ATTENDANCE_STATUSES_OPTIONS } from '@/lib/constants';

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
  const [dayFilter, setDayFilter] = React.useState<'All' | 'Day 1' | 'Day 2' | 'Both Days'>('All');
  const [currentDay, setCurrentDay] = React.useState<'day1' | 'day2'>('day1');

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

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


  const fetchData = React.useCallback(async () => {
    setIsLoadingData(true);
    try {
      const fetchedParticipants = await getParticipants({
        school: selectedSchool,
        committee: selectedCommittee,
        status: quickStatusFilter,
        searchTerm: debouncedSearchTerm,
      });
      setParticipants(fetchedParticipants);
    } catch (error: any) {
      console.error("Failed to fetch participant data:", error);
      toast({ title: "Error", description: error.message || "Could not load participants.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedSchool, selectedCommittee, quickStatusFilter, debouncedSearchTerm, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time listener for auto-refresh
  const fetchDataRef = React.useRef(fetchData);
  React.useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  React.useEffect(() => {
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, orderBy('createdAt', 'desc'));

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
          console.log('Public real-time update detected:', changes.length, 'changes');
          fetchDataRef.current();
        }
      },
      (error) => {
        console.error('Public real-time listener error:', error);
      }
    );

    return () => unsubscribe();
  }, []);


  React.useEffect(() => {
    // Fetch initial data on mount
    const fetchInitialData = async () => {
      try {
        const [schoolsData, committeesData] = await Promise.all([
          getSystemSchools(),
          getSystemCommittees(),
        ]);
        setSchools(['All Schools', ...schoolsData]);
        setCommittees(['All Committees', ...committeesData]);

        const day = await getCurrentConferenceDay();
        setCurrentDay(day);
      } catch (error) {
        console.error("Failed to fetch initial dropdown/config data:", error);
        toast({title: "Error", description: "Could not load system configuration.", variant: "destructive"});
      }
    };
    fetchInitialData();
  }, [toast]);

  // Client-side day filtering
  const filteredParticipants = React.useMemo(() => {
    if (dayFilter === 'All') return participants;
    if (dayFilter === 'Day 1') return participants.filter(p => Boolean(p.dayAttendance?.day1));
    if (dayFilter === 'Day 2') return participants.filter(p => Boolean(p.dayAttendance?.day2));
    if (dayFilter === 'Both Days') return participants.filter(p => Boolean(p.dayAttendance?.day1) && Boolean(p.dayAttendance?.day2));
    return participants;
  }, [participants, dayFilter]);

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
  }, [debouncedSearchTerm, selectedSchool, selectedCommittee, quickStatusFilter, dayFilter, pageSize]);

  // Calculate attendance stats
  const attendanceStats = React.useMemo(() => {
    const total = participants.length;
    const day1Present = participants.filter(p => Boolean(p.dayAttendance?.day1)).length;
    const day2Present = participants.filter(p => Boolean(p.dayAttendance?.day2)).length;
    const currentDayPresent = currentDay === 'day1' ? day1Present : day2Present;
    const currentDayAbsent = total - currentDayPresent;

    return {
      total,
      currentDayPresent,
      currentDayAbsent,
    };
  }, [participants, currentDay]);


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
      <div className="flex flex-col gap-4 sm:gap-6 pb-4">
        {/* Header Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Public Participant View</h1>
              <p className="text-sm sm:text-base text-muted-foreground">View participant attendance status in real-time.</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">Live Updates</span>
              </div>
              <div className="text-right mt-2 hidden sm:block">
                {currentTime && (
                  <p className="text-xl font-bold text-primary flex items-center justify-end gap-2">
                    <Clock className="h-5 w-5" /> {currentTime}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Stats Section */}
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
              <Select value={selectedSchool} onValueChange={setSelectedSchool} disabled={isLoadingData}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Schools" /></SelectTrigger>
                <SelectContent>{schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedCommittee} onValueChange={setSelectedCommittee} disabled={isLoadingData}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Committees" /></SelectTrigger>
                <SelectContent>{committees.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={quickStatusFilter} onValueChange={(val) => setQuickStatusFilter(val as AttendanceStatus | 'All')} disabled={isLoadingData}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => <SelectItem key={opt.status} value={opt.status}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={dayFilter} onValueChange={(val) => setDayFilter(val as 'All' | 'Day 1' | 'Day 2' | 'Both Days')} disabled={isLoadingData}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Days</SelectItem>
                  <SelectItem value="Day 1">Day 1 Only</SelectItem>
                  <SelectItem value="Day 2">Day 2 Only</SelectItem>
                  <SelectItem value="Both Days">Both Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
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
          </div>
        </div>
        
        <ParticipantTable
          participants={displayedParticipants}
          isLoading={isLoadingData}
          onEditParticipant={() => { /* No edit action on public page */ }}
          visibleColumns={{ ...visibleColumns, actions: false, selection: false }}
          selectedParticipants={[]}
          onSelectParticipant={() => {}}
          onSelectAll={() => {}}
          isAllSelected={false}
        />

        {/* Pagination Controls */}
        {!isLoadingData && filteredParticipants.length > 0 && (
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
      </div>
    </PublicLayout>
  );
}
