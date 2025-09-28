
'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { StaffMember } from '@/types';
import { StaffMemberForm } from '@/components/staff/StaffMemberForm';
import { useAuth } from '@/hooks/use-auth';

interface StaffManagementTableProps {
  staffMembers: StaffMember[];
  isLoading: boolean;
  onStaffUpdate: () => void;
}

export function StaffManagementTable({ staffMembers, isLoading, onStaffUpdate }: StaffManagementTableProps) {
  const { staffMember: loggedInStaffMember, userAppRole } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);

  const handleEditClick = (staffMember: StaffMember) => {
    setStaffToEdit(staffMember);
    setIsFormOpen(true);
  };

  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setStaffToEdit(null);
    onStaffUpdate();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-3 border rounded-md">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
            <Skeleton className="h-8 w-20 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMembers.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={staff.imageUrl || undefined} alt={staff.name} />
                    <AvatarFallback>{staff.name?.[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>{staff.name}</TableCell>
                <TableCell>{staff.role}</TableCell>
                <TableCell>{staff.department}</TableCell>
                <TableCell>{staff.team}</TableCell>
                <TableCell className="text-right">
                  {(userAppRole === 'owner' || userAppRole === 'admin' || loggedInStaffMember?.permissions?.canEditStaff) && (
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(staff)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {isFormOpen && (
        <StaffMemberForm
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          staffMemberToEdit={staffToEdit}
          onFormSubmitSuccess={handleFormSubmitSuccess}
        />
      )}
    </div>
  );
}
