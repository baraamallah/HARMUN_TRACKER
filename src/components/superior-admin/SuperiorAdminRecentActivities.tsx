'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
    id: string;
    name: string;
    action: string;
    target: string;
    timestamp: any;
    avatar: string;
}

export function SuperiorAdminRecentActivities() {
    const [activities, setActivities] = React.useState<Activity[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchActivities() {
            try {
                const activitiesCollection = collection(db, 'activities');
                const activitiesQuery = query(activitiesCollection, orderBy('timestamp', 'desc'), limit(5));
                const activitiesSnapshot = await getDocs(activitiesQuery);

                const activitiesData = activitiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    action: doc.data().action,
                    target: doc.data().target,
                    timestamp: doc.data().timestamp,
                    avatar: doc.data().avatar,
                }));

                setActivities(activitiesData);
            } catch (error) {
                console.error("Error fetching activities: ", error);
            } finally {
                setLoading(false);
            }
        }

        fetchActivities();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(5)].map((_, index) => (
                        <div key={index} className="flex items-center space-x-4">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1 space-y-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={activity.avatar} alt="Avatar" />
                            <AvatarFallback>{activity.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">{activity.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {activity.action} {activity.target}
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true })}
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
