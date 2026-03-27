
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, School, Briefcase, PieChart as PieChartIcon, Percent, RefreshCw, UserCheck, UserX, Coffee, Trophy, TrendingUp, Award, Zap } from "lucide-react";
import type { AnalyticsData } from '@/types';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell, TooltipProps, Area, AreaChart, BarChart } from 'recharts';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#F97316', '#6366F1'];
const STAFF_COLORS = ['#059669', '#4B5563', '#D97706', '#2563EB'];

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border bg-background/95 backdrop-blur-md p-3 shadow-xl ring-1 ring-black/5">
        <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">{label || payload[0].name}</p>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: payload[0].color }} />
          <span className="text-sm font-bold">
            {payload[0].value} <span className="text-xs font-medium text-muted-foreground">Count</span>
          </span>
        </div>
      </div>
    );
  }
  return null;
};

interface AnalyticsClientPageProps {
  initialData?: AnalyticsData | null;
  error?: string | null;
}

export function AnalyticsClientPage({ initialData, error }: AnalyticsClientPageProps) {
  const {
    attendanceRate,
    presentCount,
    absentCount,
    inBreakCount,
    topCommittee,
    largestTeam
  } = useMemo(() => {
    if (!initialData) return {
      attendanceRate: 0,
      presentCount: 0,
      absentCount: 0,
      inBreakCount: 0,
      topCommittee: null,
      largestTeam: null
    };

    const present = initialData.statusDistribution.find(s => s.status === 'Present')?.count || 0;
    const absent = initialData.statusDistribution.find(s => s.status === 'Absent')?.count || 0;
    const inBreak = initialData.statusDistribution.find(s => s.status === 'In Break')?.count || 0;
    const rate = initialData.totalParticipants > 0 ? (present / initialData.totalParticipants) * 100 : 0;

    const topComm = initialData.participantsByCommittee.length > 0
      ? initialData.participantsByCommittee[0]
      : null;

    const largeTeam = initialData.staffByTeam.length > 0
      ? initialData.staffByTeam[0]
      : null;

    return {
      attendanceRate: rate,
      presentCount: present,
      absentCount: absent,
      inBreakCount: inBreak,
      topCommittee: topComm,
      largestTeam: largeTeam
    };
  }, [initialData]);

  if (error || !initialData) {
    return (
      <div className="text-center">
        <p className="text-destructive">{error || 'Could not load analytics data.'}</p>
        <Button onClick={() => window.location.reload()} className="mt-4"><RefreshCw className="mr-2 h-4 w-4"/>Retry</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Real-time overview of conference engagement and staffing.</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4"/>
            Refresh Data
        </Button>
      </div>

      {/* Visual Insights Section */}
      <div className="grid gap-6 md:grid-cols-3 mb-10">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-100 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> Growth & Participation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black mb-1">{initialData.totalParticipants}</div>
            <p className="text-blue-100 text-sm font-medium">Delegates currently registered</p>
            <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-blue-100 uppercase font-bold">Schools</p>
                <p className="text-xl font-bold">{initialData.totalSchools}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-blue-100 uppercase font-bold">Committees</p>
                <p className="text-xl font-bold">{initialData.totalCommittees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-100 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-3 w-3" /> Live Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black mb-1">{attendanceRate.toFixed(1)}%</div>
            <p className="text-emerald-100 text-sm font-medium">Overall attendance rate</p>
            <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-emerald-100 uppercase font-bold">Present</p>
                <p className="text-xl font-bold">{presentCount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-100 uppercase font-bold">In Break</p>
                <p className="text-xl font-bold">{inBreakCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-100 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Award className="h-3 w-3" /> Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-amber-100 uppercase font-bold mb-1">Largest Committee</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate mr-2">{topCommittee?.committee || 'N/A'}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">{topCommittee?.count || 0}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/20">
                <p className="text-[10px] text-amber-100 uppercase font-bold mb-1">Largest Staff Team</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate mr-2">{largestTeam?.team || 'N/A'}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">{largestTeam?.count || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3 mb-10">
        <Card className="lg:col-span-1 shadow-md border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Attendance Status
            </CardTitle>
            <CardDescription>Participant status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={initialData.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {initialData.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              Committees Capacity
            </CardTitle>
            <CardDescription>Delegate distribution per committee</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={initialData.participantsByCommittee} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="committee" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-border" />
        <h2 className="text-2xl font-black tracking-tight text-muted-foreground uppercase italic">Staff Operations</h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2 mb-10">
        <Card className="shadow-md border-primary/10 overflow-hidden">
          <div className="h-2 bg-emerald-500" />
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-emerald-500" />
              Staff Readiness
            </CardTitle>
            <CardDescription>Current duty status for all staff</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={initialData.staffStatusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {initialData.staffStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STAFF_COLORS[index % STAFF_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md border-primary/10 overflow-hidden">
          <div className="h-2 bg-primary" />
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Department Allocation
            </CardTitle>
            <CardDescription>Staff distribution across teams</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={initialData.staffByTeam} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="team" type="category" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
