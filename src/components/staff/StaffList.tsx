'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface StaffMember {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    avatar: string;
}

export function StaffList() {
    const [staff, setStaff] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchStaff() {
            try {
                const staffCollection = collection(db, 'staff_members');
                const staffQuery = query(staffCollection, orderBy('name'));
                const staffSnapshot = await getDocs(staffQuery);

                const staffData = staffSnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    email: doc.data().email,
                    role: doc.data().role,
                    status: doc.data().status,
                    avatar: doc.data().avatar,
                }));

                setStaff(staffData);
            } catch (error) {
                console.error("Error fetching staff: ", error);
            } finally {
                setLoading(false);
            }
        }

        fetchStaff();
    }, []);

    if (loading) {
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(5)].map((_, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">
                                <div className="flex items-center space-x-3">
                                    <Skeleton className="h-9 w-9 rounded-full" />
                                    <div>
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-32 mt-1" />
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-6 w-20" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {staff.map((member) => (
                    <TableRow key={member.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={member.avatar} alt="Avatar" />
                                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p>{member.name}</p>
                                    <p className="text-sm text-muted-foreground">{member.email}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>{member.role}</TableCell>
                        <TableCell>
                            <Badge variant={member.status === 'Active' ? 'default' : 'secondary'}>{member.status}</Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
