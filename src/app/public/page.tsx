
'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { ListFilter, Square, CheckSquare, Eye } from 'lucide-react'; // Removed unused CheckSquare, Square
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getParticipants, getSystemSchools, getSystemCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
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

  // Public page doesn't need 'actions' or 'selection' columns to be configurable for visibility
  const [visibleColumns, setVisibleColumns] = React.useState<Omit<VisibleColumns, 'actions' | 'selection'>>({
    avatar: true,
    name: true,
    school: true,
    committee: true,
    status: true,
  });

  // Type for columnLabels should match the keys of the visibleColumns state for this page
  const columnLabels: Record<keyof typeof visibleColumns, string> = {
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
      toast({title: "Error", description: "Failed to load public attendance data.", variant: "destructive"})
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
        acc[key as keyof typeof visibleColumns] = show;
        return acc;
      }, {} as Omit<VisibleColumns, 'actions' | 'selection'>)
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <Eye className="mr-3 h-8 w-8 text-primary" /> Public Attendance View
            </h1>
            <p className="text-muted-foreground">View current participant attendance status (read-only).</p>
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
                  <Square className="mr-2 h-4 w-4" /> Hide All (except Name)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(visibleColumns) as Array<keyof typeof visibleColumns>).map((key) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns[key]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, [key]: checked }))
                    }
                    disabled={key === 'name'} // Ensure 'Name' column cannot be hidden
                  >
                    {columnLabels[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 p-4 border rounded-lg shadow-sm bg-card items-center">
          <Input
            placeholder="Search by name, school, committee..."
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
              >
                {opt.label}
              </Button>
            ))}
        </div>

        <ParticipantTable
          participants={participants}
          isLoading={isLoadingData}
          onEditParticipant={() => {}} // No-op for public page
          visibleColumns={{ ...visibleColumns, actions: false, selection: false }} // Ensure actions and selection are always false for public table
          // Props not needed for public view related to selection
          selectedParticipants={[]}
          onSelectParticipant={() => {}}
          onSelectAll={() => {}}
          isAllSelected={false}
        />
      </div>
    </PublicLayout>
  );
}
