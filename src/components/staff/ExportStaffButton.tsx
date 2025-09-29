'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Parser } from 'json2csv';

export function ExportStaffButton() {
    const exportToCsv = async () => {
        try {
            const staffCollection = collection(db, 'staff_members');
            const staffQuery = query(staffCollection, orderBy('name'));
            const staffSnapshot = await getDocs(staffQuery);

            const staffData = staffSnapshot.docs.map(doc => ({
                name: doc.data().name,
                email: doc.data().email,
                role: doc.data().role,
                status: doc.data().status,
            }));

            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(staffData);

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'staff_list.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error exporting staff list: ", error);
        }
    };

    return (
        <Button variant="outline" onClick={exportToCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export List
        </Button>
    );
}
