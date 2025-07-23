
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, Loader2 } from "lucide-react";
import { getParticipantCountByCommittee, getCheckInTrend } from '@/lib/actions';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface CommitteeData {
  committee: string;
  count: number;
}

interface CheckInTrendData {
  time: string;
  count: number;
}

export default function AnalyticsPage() {
  const [committeeData, setCommitteeData] = useState<CommitteeData[]>([]);
  const [checkInTrendData, setCheckInTrendData] = useState<CheckInTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const [committeeCounts, checkInTrends] = await Promise.all([
          getParticipantCountByCommittee(),
          getCheckInTrend(),
        ]);
        setCommitteeData(committeeCounts);
        setCheckInTrendData(checkInTrends);
      } catch (error) {
        toast({
          title: 'Error Fetching Analytics Data',
          description: 'Could not load the data for the charts.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Participants by Committee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={committeeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="committee" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#64B5F6" name="Participants" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Check-in Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={checkInTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#81C784" name="Check-ins" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
