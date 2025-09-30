
'use client';

import * as React from 'react';
import Link from 'next/link';
import type { StaffMember, StaffVisibleColumns } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { StaffMemberStatusBadge } from './StaffMemberStatusBadge';
import { StaffMemberActions } from './StaffMemberActions';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Users2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StaffMemberTableProps {
  staffMembers: StaffMember[];
  isLoading: boolean;
  onEditStaffMember: (staffMember: StaffMember) => void;
  visibleColumns: StaffVisibleColumns;
  selectedStaffMembers: string[];
  onSelectStaffMember: (staffMemberId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  isAllSelected: boolean;
}

type SortKey = keyof Pick<StaffMember, 'name' | 'role' | 'department' | 'team' | 'status'>;
type SortOrder = 'asc' | 'desc';

export function StaffMemberTable({
  staffMembers,
  isLoading,
  onEditStaffMember,
  visibleColumns,
  selectedStaffMembers,
  onSelectStaffMember,
  onSelectAll,
  isAllSelected
}: StaffMemberTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('name');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('asc');

  const sortedStaffMembers = React.useMemo(() => {
    return [...staffMembers].sort((a, b) => {
      const valA = a[sortKey] || '';
      const valB = b[sortKey] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [staffMembers, sortKey, sortOrder]);

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
              {visibleColumns.selection && <TableHead className="w-[50px] pl-4"><Skeleton className="h-5 w-5" /></TableHead>}
              {visibleColumns.avatar && <TableHead className="w-[70px]"><Skeleton className="h-5 w-12" /></TableHead>}
              {visibleColumns.name && <TableHead><Skeleton className="h-5 w-32" /></TableHead>}
              {visibleColumns.role && <TableHead><Skeleton className="h-5 w-28" /></TableHead>}
              {visibleColumns.department && <TableHead className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.team && <TableHead className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.contactInfo && <TableHead className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.status && <TableHead><Skeleton className="h-5 w-24" /></TableHead>}
              {visibleColumns.actions && <TableHead className="text-right w-[80px]"><Skeleton className="h-5 w-10 ml-auto" /></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={`skel-staff-row-${i}`} className="bg-background">
                {visibleColumns.selection && <TableCell className="pl-4"><Skeleton className="h-5 w-5" /></TableCell>}
                {visibleColumns.avatar && <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>}
                {visibleColumns.name && <TableCell><Skeleton className="h-5 w-40" /></TableCell>}
                {visibleColumns.role && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                {visibleColumns.department && <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>}
                {visibleColumns.team && <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28" /></TableCell>}
                {visibleColumns.contactInfo && <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28" /></TableCell>}
                {visibleColumns.status && <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>}
                {visibleColumns.actions && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (staffMembers.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border rounded-lg shadow-sm bg-card p-10 text-center">
        <Users2 className="h-24 w-24 text-muted-foreground/50 mb-6" data-ai-hint="no staff group" />
        <h3 className="text-2xl font-semibold text-foreground mb-2">No Staff Members Found</h3>
        <p className="text-lg text-muted-foreground">
          Try adjusting your search filters or add new staff members to the list.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {visibleColumns.selection && (
              <TableHead className="w-[50px] pl-4">
                <Checkbox
                  checked={isAllSelected && sortedStaffMembers.length > 0}
                  onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  aria-label="Select all staff members"
                  disabled={sortedStaffMembers.length === 0}
                />
              </TableHead>
            )}
            {visibleColumns.avatar && <TableHead className="pl-2 pr-2 md:pl-6 w-[60px] md:w-[70px]">Avatar</TableHead>}
            {visibleColumns.name && (
              <TableHead className="min-w-[150px]">
                <Button variant="ghost" onClick={() => handleSort('name')} className="px-1 group">
                  Name {renderSortIcon('name')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.role && (
              <TableHead className="min-w-[120px]">
                <Button variant="ghost" onClick={() => handleSort('role')} className="px-1 group">
                  Role {renderSortIcon('role')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.department && (
              <TableHead className="hidden md:table-cell min-w-[120px]">
                <Button variant="ghost" onClick={() => handleSort('department')} className="px-1 group">
                  Department {renderSortIcon('department')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.team && (
              <TableHead className="hidden lg:table-cell min-w-[120px]">
                <Button variant="ghost" onClick={() => handleSort('team')} className="px-1 group">
                  Team {renderSortIcon('team')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.contactInfo && <TableHead className="hidden lg:table-cell min-w-[150px]">Contact</TableHead>}
            {visibleColumns.status && (
              <TableHead className="min-w-[120px]">
                <Button variant="ghost" onClick={() => handleSort('status')} className="px-1 group">
                  Status {renderSortIcon('status')}
                </Button>
              </TableHead>
            )}
            {visibleColumns.actions && <TableHead className="text-right w-[80px] pr-4 md:pr-6">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStaffMembers.map((staff) => (
            <TableRow 
              key={staff.id} 
              className="hover:bg-muted/30 transition-colors"
              data-state={selectedStaffMembers.includes(staff.id) ? 'selected' : undefined}
            >
              {visibleColumns.selection && (
                <TableCell className="pl-4">
                  <Checkbox
                    checked={selectedStaffMembers.includes(staff.id)}
                    onCheckedChange={(checked) => onSelectStaffMember(staff.id, Boolean(checked))}
                    aria-label={`Select staff member ${staff.name}`}
                  />
                </TableCell>
              )}
              {visibleColumns.avatar && (
                <TableCell className="pl-2 pr-2 md:pl-6">
                   <Link
                     href={`/staff/${staff.id}`}
                     aria-label={`View profile of ${staff.name}`}>
                    <Avatar className="h-10 w-10 border hover:ring-2 hover:ring-primary transition-all">
                      <AvatarImage src={staff.imageUrl} alt={staff.name} data-ai-hint="person avatar" />
                      <AvatarFallback>{staff.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>
                </TableCell>
              )}
              {visibleColumns.name && (
                <TableCell className="font-medium text-foreground">
                  <Link
                    href={`/staff/${staff.id}`}
                    className="hover:underline text-primary">
                    {staff.name}
                  </Link>
                </TableCell>
              )}
              {visibleColumns.role && <TableCell className="text-muted-foreground text-sm">{staff.role}</TableCell>}
              {visibleColumns.department && <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{staff.department || 'N/A'}</TableCell>}
              {visibleColumns.team && <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{staff.team || 'N/A'}</TableCell>}
              {visibleColumns.contactInfo && <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">{staff.contactInfo || 'N/A'}</TableCell>}
              {visibleColumns.status && (
                <TableCell>
                  <StaffMemberStatusBadge status={staff.status} />
                </TableCell>
              )}
              {visibleColumns.actions && (
                <TableCell className="text-right pr-4 md:pr-6">
                  <StaffMemberActions staffMember={staff} onEdit={onEditStaffMember} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
