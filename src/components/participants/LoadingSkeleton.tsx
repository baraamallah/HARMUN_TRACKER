'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface LoadingSkeletonProps {
    rows?: number;
}

export function LoadingSkeleton({ rows = 5 }: LoadingSkeletonProps) {
    return (
        <div className="space-y-4">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[250px]" />
                    <Skeleton className="h-4 w-[350px]" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-[120px]" />
                    <Skeleton className="h-10 w-[120px]" />
                    <Skeleton className="h-10 w-[150px]" />
                </div>
            </div>

            {/* Filters Skeleton */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[200px]" />
                    </div>
                </CardContent>
            </Card>

            {/* Table Skeleton */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-5 w-5" />
                        <Skeleton className="h-5 w-5" />
                        <Skeleton className="h-5 w-[100px]" />
                        <Skeleton className="h-5 w-[150px]" />
                        <Skeleton className="h-5 w-[150px]" />
                        <Skeleton className="h-5 w-[100px]" />
                        <Skeleton className="h-5 w-[100px]" />
                        <Skeleton className="h-5 w-[80px]" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-2">
                            <Skeleton className="h-5 w-5" />
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-5 w-[150px]" />
                            <Skeleton className="h-5 w-[120px]" />
                            <Skeleton className="h-5 w-[120px]" />
                            <Skeleton className="h-5 w-[80px]" />
                            <Skeleton className="h-5 w-[100px]" />
                            <Skeleton className="h-8 w-[60px]" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
