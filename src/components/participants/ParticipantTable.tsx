
'use client';

import * as React from 'react';
import type { Participant, VisibleColumns } from '@/types';
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
  visibleColumns: VisibleColumns;
}

type SortKey = keyof Pick<Participant, 'name' | 'school' | 'committee' | 'status'>;
type SortOrder = 'asc' | 'desc';

export function ParticipantTable({ participants, isLoading, onEditParticipant, visibleColumns }: ParticipantTableProps) {
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
              {visibleColumns.avatar && <TableHead className="w-[80px]"><Skeleton className="h-5 w-12" /></TableHead>}
              {visibleColumns.name && <TableHead><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.school && <TableHead><Skeleton className="h-5 w-20" /></TableHead>}
              {visibleColumns.committee && <TableHead><Skeleton className="h-5 w-20" /></TableHead>}
              {visibleColumns.status && <TableHead><Skeleton className="h-5 w-20" /></TableHead>}
              {visibleColumns.actions && <TableHead className="text-right w-[100px]"><Skeleton className="h-5 w-10 ml-auto" /></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={`skel-row-${i}`}>
                {visibleColumns.avatar && <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>}
                {visibleColumns.name && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                {visibleColumns.school && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                {visibleColumns.committee && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                {visibleColumns.status && <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>}
                {visibleColumns.actions && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>}
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
            {visibleColumns.avatar && <TableHead className="w-[80px]">Avatar</TableHead>}
            {visibleColumns.name && (
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('name')} className="px-1">
                  Name {renderSortIcon('name')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.school && (
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('school')} className="px-1">
                  School {renderSortIcon('school')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.committee && (
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('committee')} className="px-1">
                  Committee {renderSortIcon('committee')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.status && (
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('status')} className="px-1">
                  Status {renderSortIcon('status')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.actions && <TableHead className="text-right w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedParticipants.map((participant) => (
            <TableRow key={participant.id} className="hover:bg-muted/50 transition-colors">
              {visibleColumns.avatar && (
                <TableCell>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.imageUrl} alt={participant.name} data-ai-hint="person avatar" />
                    <AvatarFallback>{participant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </TableCell>
              )}
              {visibleColumns.name && <TableCell className="font-medium">{participant.name}</TableCell>}
              {visibleColumns.school && <TableCell>{participant.school}</TableCell>}
              {visibleColumns.committee && <TableCell>{participant.committee}</TableCell>}
              {visibleColumns.status && (
                <TableCell>
                  <AttendanceStatusBadge status={participant.status} />
                </TableCell>
              )}
              {visibleColumns.actions && (
                <TableCell className="text-right">
                  <ParticipantActions participant={participant} onEdit={onEditParticipant} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
