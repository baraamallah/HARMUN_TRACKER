'use client';

import * as React from 'react';
import type { Participant } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { ParticipantActions } from './ParticipantActions';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ParticipantTableProps {
  participants: Participant[];
  isLoading: boolean;
  onEditParticipant: (participant: Participant) => void;
}

type SortKey = keyof Pick<Participant, 'name' | 'school' | 'committee' | 'status'>;
type SortOrder = 'asc' | 'desc';

export function ParticipantTable({ participants, isLoading, onEditParticipant }: ParticipantTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('name');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('asc');

  const sortedParticipants = React.useMemo(() => {
    return [...participants].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [participants, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortOrder === 'asc' ? 
      <ArrowUpDown className="ml-2 h-4 w-4 opacity-100" /> : 
      <ArrowUpDown className="ml-2 h-4 w-4 opacity-100 transform rotate-180" />;
  };
  
  if (isLoading) {
    return (
      <div className="rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {[...Array(6)].map((_, i) => (
                <TableHead key={i}><Skeleton className="h-5 w-24" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (participants.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border rounded-md shadow-sm bg-card">
        <img src="https://placehold.co/120x120.png/F0F4F8/363D45?text=No+Data" alt="No data" className="mb-4 opacity-70" data-ai-hint="empty state illustration" />
        <h3 className="text-xl font-semibold text-muted-foreground">No Participants Found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or add new participants.</p>
      </div>
    );
  }


  return (
    <div className="rounded-md border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Avatar</TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('name')} className="px-1">
                Name {renderSortIcon('name')}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('school')} className="px-1">
                School {renderSortIcon('school')}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('committee')} className="px-1">
                Committee {renderSortIcon('committee')}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('status')} className="px-1">
                Status {renderSortIcon('status')}
              </Button>
            </TableHead>
            <TableHead className="text-right w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedParticipants.map((participant) => (
            <TableRow key={participant.id} className="hover:bg-muted/50 transition-colors">
              <TableCell>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={participant.imageUrl} alt={participant.name} data-ai-hint="person avatar" />
                  <AvatarFallback>{participant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{participant.name}</TableCell>
              <TableCell>{participant.school}</TableCell>
              <TableCell>{participant.committee}</TableCell>
              <TableCell>
                <AttendanceStatusBadge status={participant.status} />
              </TableCell>
              <TableCell className="text-right">
                <ParticipantActions participant={participant} onEdit={onEditParticipant} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
