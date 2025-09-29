'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const systemChecks = [
    {
        name: 'Firebase Services',
        status: 'ok',
        message: 'All services are operational',
    },
    {
        name: 'Database Connection',
        status: 'ok',
        message: 'Connected and responsive',
    },
    {
        name: 'Authentication Service',
        status: 'ok',
        message: 'Accepting new users',
    },
    {
        name: 'QR Code Generation',
        status: 'warning',
        message: 'API is experiencing high latency',
    },
    {
        name: 'Email Service',
        status: 'error',
        message: 'Failed to send emails',
    },
];

export function SuperiorAdminSystemStatus() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {systemChecks.map((check, index) => (
                    <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            {check.status === 'ok' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {check.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                            {check.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                            <div>
                                <p className="text-sm font-medium">{check.name}</p>
                                <p className="text-xs text-muted-foreground">{check.message}</p>
                            </div>
                        </div>
                        <Badge
                            variant={check.status === 'ok' ? 'default' : check.status === 'warning' ? 'secondary' : 'destructive'}
                        >
                            {check.status}
                        </Badge>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}