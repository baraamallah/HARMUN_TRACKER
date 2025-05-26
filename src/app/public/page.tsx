
'use client';

import * as React from 'react';
import { ListFilter, CheckSquare, Square } from 'lucide-react';
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
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout'; // Changed to PublicLayout
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getParticipants, getSchools, getCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

type PublicVisibleColumns = Omit<VisibleColumns, 'actions'>;


export default function PublicViewPage() {
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<PublicVisibleColumns>({
    avatar: true,
    name: true,
    school: true,
    committee: true,
    status: true,
    // Actions column is intentionally omitted for public view
  });

  const columnLabels: Record<keyof PublicVisibleColumns, string> = {
    avatar: 'Avatar',
    name: 'Name',
    school: 'School',
    committee: 'Committee',
    status: 'Status',
  };


  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [participantsData, schoolsData, committeesData] = await Promise.all([
        getParticipants({ 
          school: selectedSchool === 'All Schools' ? undefined : selectedSchool, 
          committee: selectedCommittee === 'All Committees' ? undefined : selectedCommittee,
          searchTerm: debouncedSearchTerm,
          status: quickStatusFilter === 'All' ? undefined : quickStatusFilter,
        }),
        getSchools(),
        getCommittees(),
      ]);
      setParticipants(participantsData);
      setSchools(['All Schools', ...schoolsData]);
      setCommittees(['All Committees', ...committeesData]);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm, quickStatusFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Public Attendance View</h1>
            <p className="text-muted-foreground">View participant attendance information.</p>
          </div>
          <div className="flex gap-2">
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
          isLoading={isLoading}
          onEditParticipant={() => {}} // No-op for public view
          visibleColumns={{...visibleColumns, actions: false }} // Ensure actions are always false
        />
      </div>
    </PublicLayout>
  );
}
