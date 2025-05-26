
'use client'; // This page will manage state and interactivity

import * as React from 'react';
import { PlusCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { ParticipantForm } from '@/components/participants/ParticipantForm';
import { ImportCsvDialog } from '@/components/participants/ImportCsvDialog';
import { ExportCsvButton } from '@/components/participants/ExportCsvButton';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import type { Participant } from '@/types';
import { getParticipants, getSchools, getCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';


export default function AdminDashboardPage() {
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');

  const [isParticipantFormOpen, setIsParticipantFormOpen] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = React.useState<Participant | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [participantsData, schoolsData, committeesData] = await Promise.all([
        getParticipants({ 
          school: selectedSchool === 'All Schools' ? undefined : selectedSchool, 
          committee: selectedCommittee === 'All Committees' ? undefined : selectedCommittee,
          searchTerm: debouncedSearchTerm 
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
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm]);

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
            <Button onClick={handleAddParticipant}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Participant
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg shadow-sm bg-card">
          <Input
            placeholder="Search by name, school, committee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:col-span-1"
          />
          <Select value={selectedSchool} onValueChange={setSelectedSchool}>
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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

        <ParticipantTable
          participants={participants}
          isLoading={isLoading}
          onEditParticipant={handleEditParticipant}
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
