import * as React from 'react';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { AboutPageContent } from '@/components/about/AboutPageContent';

export const metadata = {
    title: 'About Us | HARMUN Attendance Tracker',
    description: 'Learn more about our Model United Nations conference and the team behind it.',
};

export default function AboutPage() {
    return (
        <AppLayoutClientShell>
            <AboutPageContent />
        </AppLayoutClientShell>
    );
}
