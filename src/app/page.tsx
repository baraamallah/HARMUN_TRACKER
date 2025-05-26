
'use client'; // This page will manage state and interactivity

import * as React from 'react';
import { PlusCircle, ListFilter, CheckSquare, Square } from 'lucide-react';
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
import { ParticipantForm } from '@/components/participants/ParticipantForm';
import { ImportCsvDialog } from '@/components/participants/ImportCsvDialog';
import { ExportCsvButton } from '@/components/participants/ExportCsvButton';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import type { Participant, VisibleColumns, AttendanceStatus } from '@/types';
import { getParticipants, getSchools, getCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';


export default function AdminDashboardPage() {
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');
  const [quickStatusFilter, setQuickStatusFilter] = React.useState<AttendanceStatus | 'All'>('All');


  const [isParticipantFormOpen, setIsParticipantFormOpen] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = React.useState<Participant | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [visibleColumns, setVisibleColumns] = React.useState<VisibleColumns>({
    avatar: true,
    name: true,
    school: true,
    committee: true,
    status: true,
    actions: true,
  });

  const columnLabels: Record<keyof VisibleColumns, string> = {
    avatar: 'Avatar',
    name: 'Name',
    school: 'School',
    committee: 'Committee',
    status: 'Status',
    actions: 'Actions',
  };

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [participantsData, schoolsData, committeesData] = await Promise.all([
        getParticipants({ 
          school: selectedSchool === 'All Schools' ? undefined : selectedSchool, 
          committee: selectedCommittee === 'All Committees' ? undefined : selectedCommittee,
          searchTerm: debouncedSearchTerm,
          status: quickStatusFilter,
        }),
        getSchools(),
        getCommittees(),
      ]);
      setParticipants(participantsData);
      setSchools(['All Schools', ...schoolsData]);
      setCommittees(['All Committees', ...committeesData]);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Optionally set an error state and display a message
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm, quickStatusFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]); // Re-fetch when filters or search term change

  const handleAddParticipant = () => {
    setParticipantToEdit(null);
    setIsParticipantFormOpen(true);
  };

  const handleEditParticipant = (participant: Participant) => {
    setParticipantToEdit(participant);
    setIsParticipantFormOpen(true);
  };
  
  const toggleAllColumns = (show: boolean) => {
    setVisibleColumns(prev => 
      Object.keys(prev).reduce((acc, key) => {
        acc[key as keyof VisibleColumns] = show;
        return acc;
      }, {} as VisibleColumns)
    );
  };

  const statusFilterOptions: { label: string; value: AttendanceStatus | 'All' }[] = [
    { label: 'All Participants', value: 'All' },
    { label: 'Present', value: 'Present' },
    { label: 'Absent', value: 'Absent' },
  ];

  return (
    <AppLayoutClientShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
            <p className="text-muted-foreground">Manage and track participant attendance.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ImportCsvDialog />
            <ExportCsvButton participants={participants} />
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
                {(Object.keys(visibleColumns) as Array<keyof VisibleColumns>).map((key) => (
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
            <Button onClick={handleAddParticipant}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Participant
            </Button>
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
                className={cn(quickStatusFilter === opt.value && "ring-2 ring-ring ring-offset-2")}
              >
                {opt.label}
              </Button>
            ))}
        </div>

        <ParticipantTable
          participants={participants}
          isLoading={isLoading}
          onEditParticipant={handleEditParticipant}
          visibleColumns={visibleColumns}
        />
      </div>

      <ParticipantForm
        isOpen={isParticipantFormOpen}
        onOpenChange={setIsParticipantFormOpen}
        participantToEdit={participantToEdit}
        schools={schools.filter(s => s !== 'All Schools')} // Pass actual schools, not "All Schools"
        committees={committees.filter(c => c !== 'All Committees')} // Pass actual committees
      />
    </AppLayoutClientShell>
  );
}
