
'use client';

import * as React from 'react';
import Link from 'next/link';
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
import { ArrowUpDown, UserX, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
    if (sortKey !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-70" />;
    return sortOrder === 'asc' ?
      <ArrowUpDown className="ml-2 h-4 w-4 opacity-100 text-primary" /> :
      <ArrowUpDown className="ml-2 h-4 w-4 opacity-100 text-primary transform rotate-180" />;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {visibleColumns.avatar && <TableHead className="w-[70px]"><Skeleton className="h-5 w-12" /></TableHead>}
              {visibleColumns.name && <TableHead><Skeleton className="h-5 w-32" /></TableHead>}
              {visibleColumns.school && <TableHead className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableHead>}
              {visibleColumns.committee && <TableHead className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.status && <TableHead><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.actions && <TableHead className="text-right w-[80px]"><Skeleton className="h-5 w-10 ml-auto" /></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={`skel-row-${i}`} className="bg-background">
                {visibleColumns.avatar && <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>}
                {visibleColumns.name && <TableCell><Skeleton className="h-5 w-40" /></TableCell>}
                {visibleColumns.school && <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>}
                {visibleColumns.committee && <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28" /></TableCell>}
                {visibleColumns.status && <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>}
                {visibleColumns.actions && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (participants.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border rounded-lg shadow-sm bg-card p-10 text-center">
        <Users className="h-24 w-24 text-muted-foreground/50 mb-6" data-ai-hint="no users group" />
        <h3 className="text-2xl font-semibold text-foreground mb-2">No Participants Found</h3>
        <p className="text-lg text-muted-foreground">
          Try adjusting your search filters or add new participants to the list.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {visibleColumns.avatar && <TableHead className="w-[70px] pl-6">Avatar</TableHead>}
            {visibleColumns.name && (
              <TableHead className="min-w-[150px]">
                <Button variant="ghost" onClick={() => handleSort('name')} className="px-1 group">
                  Name {renderSortIcon('name')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.school && (
              <TableHead className="hidden md:table-cell min-w-[150px]">
                <Button variant="ghost" onClick={() => handleSort('school')} className="px-1 group">
                  School {renderSortIcon('school')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.committee && (
              <TableHead className="hidden lg:table-cell min-w-[150px]">
                <Button variant="ghost" onClick={() => handleSort('committee')} className="px-1 group">
                  Committee {renderSortIcon('committee')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.status && (
              <TableHead className="min-w-[120px]">
                <Button variant="ghost" onClick={() => handleSort('status')} className="px-1 group">
                  Status {renderSortIcon('status')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.actions && <TableHead className="text-right w-[80px] pr-6">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedParticipants.map((participant) => (
            <TableRow key={participant.id} className="hover:bg-muted/30 transition-colors">
              {visibleColumns.avatar && (
                <TableCell className="pl-6">
                   <Link href={`/participants/${participant.id}`} aria-label={`View profile of ${participant.name}`}>
                    <Avatar className="h-10 w-10 border hover:ring-2 hover:ring-primary transition-all">
                      <AvatarImage src={participant.imageUrl} alt={participant.name} data-ai-hint="person avatar" />
                      <AvatarFallback>{participant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>
                </TableCell>
              )}
              {visibleColumns.name && (
                <TableCell className="font-medium text-foreground">
                  <Link href={`/participants/${participant.id}`} className="hover:underline text-primary">
                    {participant.name}
                  </Link>
                </TableCell>
              )}
              {visibleColumns.school && <TableCell className="hidden md:table-cell text-muted-foreground">{participant.school}</TableCell>}
              {visibleColumns.committee && <TableCell className="hidden lg:table-cell text-muted-foreground">{participant.committee}</TableCell>}
              {visibleColumns.status && (
                <TableCell>
                  <AttendanceStatusBadge status={participant.status} />
                </TableCell>
              )}
              {visibleColumns.actions && (
                <TableCell className="text-right pr-6">
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
