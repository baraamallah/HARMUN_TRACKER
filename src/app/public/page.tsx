'use client'; // This page will manage state and interactivity for filters

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PublicAttendanceTable } from '@/components/public/PublicAttendanceTable';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { Participant } from '@/types';
import { getParticipants, getSchools, getCommittees } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce'; // Assuming a debounce hook exists

// A simple debounce hook (can be moved to hooks/use-debounce.ts)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function PublicAttendancePage() {
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [schools, setSchools] = React.useState<string[]>([]);
  const [committees, setCommittees] = React.useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All Schools');
  const [selectedCommittee, setSelectedCommittee] = React.useState('All Committees');

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
      console.error("Failed to fetch public data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSchool, selectedCommittee, debouncedSearchTerm]);

  React.useEffect(() => {
    fetchData();
    // Optional: Set up polling for "real-time" updates on the public page
    const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId);
  }, [fetchData]);


  return (
    <PublicLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Public Attendance View</h1>
          <p className="text-muted-foreground">Live attendance status for all participants.</p>
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

        <PublicAttendanceTable participants={participants} isLoading={isLoading} />
      </div>
    </PublicLayout>
  );
}
