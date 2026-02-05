'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Users,
    Calendar,
    MapPin,
    Mail,
    Phone,
    Globe,
    Award,
    Target,
    Heart
} from 'lucide-react';

interface TeamMember {
    name: string;
    role: string;
    email?: string;
    imageUrl?: string;
}

const teamMembers: TeamMember[] = [
    {
        name: 'Conference Director',
        role: 'Leadership',
        email: 'director@harmun.org',
    },
    {
        name: 'Secretary General',
        role: 'Administration',
        email: 'secgen@harmun.org',
    },
    {
        name: 'Technical Team',
        role: 'Technology',
        email: 'tech@harmun.org',
    },
    {
        name: 'Logistics Coordinator',
        role: 'Operations',
        email: 'logistics@harmun.org',
    },
];

export function AboutPageContent() {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4 py-8">
                <Badge variant="outline" className="mb-4">
                    <Award className="mr-2 h-3 w-3" />
                    Model United Nations Conference
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    HARMUN Attendance Tracker
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Empowering delegates through technology and innovation in Model United Nations conferences
                </p>
            </div>

            {/* Conference Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <Calendar className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Conference Dates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Day 1 & Day 2
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Two-day intensive conference experience
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <MapPin className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Location</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Conference Venue
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            State-of-the-art facilities for delegates
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <Users className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Participants</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Multiple Schools & Committees
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Bringing together future leaders
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            {/* Mission Section */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Target className="h-6 w-6 text-primary" />
                        <CardTitle className="text-2xl">Our Mission</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-lg leading-relaxed">
                        To provide an efficient and modern attendance tracking system that enhances the
                        Model United Nations conference experience for delegates, staff, and organizers.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-primary/10 p-2">
                                <Heart className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Delegate-Focused</h4>
                                <p className="text-sm text-muted-foreground">
                                    Streamlined check-in and attendance management
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-primary/10 p-2">
                                <Globe className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Real-Time Updates</h4>
                                <p className="text-sm text-muted-foreground">
                                    Live attendance tracking across all committees
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Separator />

            {/* Team Section */}
            <div className="space-y-6">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight">Meet the Team</h2>
                    <p className="text-muted-foreground mt-2">
                        Dedicated individuals working to make HARMUN a success
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {teamMembers.map((member, index) => (
                        <Card
                            key={index}
                            className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                        >
                            <CardHeader className="text-center">
                                <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                                    <Users className="h-10 w-10 text-primary" />
                                </div>
                                <CardTitle className="text-lg">{member.name}</CardTitle>
                                <CardDescription>{member.role}</CardDescription>
                            </CardHeader>
                            {member.email && (
                                <CardContent className="text-center">
                                    <a
                                        href={`mailto:${member.email}`}
                                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                        <Mail className="h-3 w-3" />
                                        {member.email}
                                    </a>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Contact Section */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-2xl">Get in Touch</CardTitle>
                    <CardDescription>
                        Have questions? We'd love to hear from you.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-primary/10 p-3">
                                <Mail className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">Email</p>
                                <a
                                    href="mailto:info@harmun.org"
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    info@harmun.org
                                </a>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-primary/10 p-3">
                                <Phone className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">Phone</p>
                                <p className="text-sm text-muted-foreground">
                                    +1 (555) 123-4567
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer Note */}
            <div className="text-center text-sm text-muted-foreground py-8">
                <p>
                    Built with ❤️ for the Model United Nations community
                </p>
            </div>
        </div>
    );
}
