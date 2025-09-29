'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Parser } from 'json2csv';

export function ExportDataButton() {
    const exportAllData = async () => {
        try {
            const participantsCollection = collection(db, 'participants');
            const participantsSnapshot = await getDocs(participantsCollection);
            const participantsData = participantsSnapshot.docs.map(doc => doc.data());

            const staffCollection = collection(db, 'staff_members');
            const staffSnapshot = await getDocs(staffCollection);
            const staffData = staffSnapshot.docs.map(doc => doc.data());

            const json2csvParser = new Parser();
            const participantsCsv = json2csvParser.parse(participantsData);
            const staffCsv = json2csvParser.parse(staffData);

            const zip = new (await import('jszip')).default();
            zip.file('participants.csv', participantsCsv);
            zip.file('staff.csv', staffCsv);

            const content = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            const url = URL.createObjectURL(content);
            link.setAttribute('href', url);
            link.setAttribute('download', 'harmun_tracker_export.zip');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Error exporting data: ", error);
        }
    };

    return (
        <Button variant="outline" onClick={exportAllData}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
        </Button>
    );
}
