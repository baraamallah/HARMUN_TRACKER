
'use client';

import * as React from 'react';
import { PlusCircle, ListFilter, CheckSquare, Square, Loader2, UserX } from 'lucide-react';
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
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getParticipants, getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function PublicViewPage() {
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

  const [visibleColumns, setVisibleColumns] = React.useState<VisibleColumns>({
    avatar: true,
    name: true,
    school: true,
    committee: true,
    status: true,
    actions: false, // Actions always false for public view
  });

  const columnLabels: Record<keyof Omit<VisibleColumns, 'actions'>, string> = {
    avatar: 'Avatar',
    name: 'Name',
    school: 'School',
    committee: 'Committee',
    status: 'Status',
  };

  const fetchData = React.useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [participantsData, schoolsData, committeesData] = await Promise.all([
        getParticipants({ 
          school: selectedSchool === 'All Schools' ? undefined : selectedSchool, 
          committee: selectedCommittee === 'All Committees' ? undefined : selectedCommittee,
          searchTerm: debouncedSearchTerm,
          status: quickStatusFilter === 'All' ? undefined : quickStatusFilter,
        }),
        getSystemSchools(),
        getSystemCommittees(),
      ]);
      setParticipants(participantsData);
      setSchools(['All Schools', ...schoolsData]);
      setCommittees(['All Committees', ...committeesData]);
    } catch (error) {
      console.error("Failed to fetch public data:", error);
      toast({title: "Error", description: "Failed to load participant data.", variant: "destructive"})
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm, quickStatusFilter, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev => 
      Object.keys(prev).reduce((acc, key) => {
        if (key === 'actions') {
          acc[key as 'actions'] = false; // Actions always hidden
        } else {
          acc[key as keyof Omit<VisibleColumns, 'actions'>] = show;
        }
        return acc;
      }, {} as VisibleColumns)
    );
  };

  const statusFilterOptions: { label: string; value: AttendanceStatus | 'All' }[] = [
    { label: 'All Participants', value: 'All' },
    { label: 'Present', value: 'Present' },
    { label: 'Absent', value: 'Absent' },
  ];


  if (isLoadingData && participants.length === 0) { // Show initial loading skeleton
    return (
      <PublicLayout>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-9 w-72 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </PublicLayout>
    );
  }


  return (
    <PublicLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Public Attendance View</h1>
            <p className="text-muted-foreground">View participant attendance status.</p>
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
              {(Object.keys(columnLabels) as Array<keyof typeof columnLabels>).map((key) => (
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
        
        <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg shadow-sm bg-card items-center">
          <Input
            placeholder="Search by name, school, committee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow"
          />
          <div className="flex gap-2 flex-shrink-0">
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
        </div>

        <div className="flex gap-2 mb-4">
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
          onEditParticipant={() => { /* No-op for public view */ }}
          visibleColumns={visibleColumns}
        />
      </div>
    </PublicLayout>
  );
}
