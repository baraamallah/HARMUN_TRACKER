
'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ParticipantTable } from '@/components/participants/ParticipantTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant, VisibleColumns } from '@/types';
import { getParticipants, getSchools, getCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce'; // Correct import

export default function PublicFacingPage() {
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // For public view, actions are not available
  const visibleColumns: VisibleColumns = {
    avatar: true,
    name: true,
    school: true,
    committee: true,
    status: true,
    actions: false, // Actions column is hidden for public page
  };

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
      console.error("Failed to fetch data for public page:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dummy onEditParticipant for public page as actions are hidden
  const handleEditParticipant = () => {}; 

  return (
    <PublicLayout>
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">MUN Participant Status</h1>
          <p className="text-muted-foreground">View current participant attendance information.</p>
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
          onEditParticipant={handleEditParticipant} // Pass dummy function
          visibleColumns={visibleColumns}
        />
      </div>
    </PublicLayout>
  );
}
