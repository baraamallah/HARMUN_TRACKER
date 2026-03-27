'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getSystemCommittees } from '@/lib/actions';
import type { Participant, AttendanceStatus } from '@/types';
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Loader2, Users, CheckCircle, XCircle, Search, AlertTriangle, Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import {
  doc, updateDoc, writeBatch, serverTimestamp, onSnapshot, query, where,
  collection, getDoc
} from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ALL_ATTENDANCE_STATUSES_OPTIONS } from '@/lib/constants';
import { useRestroomAlerts, formatElapsed } from '@/hooks/use-restroom-alerts';

// ─── Restroom Icon ────────────────────────────────────────────────────────────
function RestroomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="5" r="1" />
      <circle cx="15" cy="5" r="1" />
      <path d="M7 8h4l-1 6H8L7 8Z" />
      <path d="M13 8h2l1.5 3.5L18 8" />
      <path d="M16.5 11.5V20" />
      <path d="M9 14v6" />
      <path d="M11 14v6" />
    </svg>
  );
}

// ─── Elapsed label (live) ─────────────────────────────────────────────────────
function ElapsedLabel({ startTime }: { startTime: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => {
      const ms = Date.now() - new Date(startTime).getTime();
      setLabel(formatElapsed(ms));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span>{label}</span>;
}

const SYSTEM_CONFIG_COLLECTION = 'system_config';
const APP_SETTINGS_DOC_ID = 'main_settings';
const DEFAULT_THRESHOLD_MS = 10 * 60 * 1000;

export default function InSessionPage() {
  const { adminUser, userAppRole, authSessionLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [committees, setCommittees] = useState<string[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState<string>('');
  const [isUpdatingCommittee, setIsUpdatingCommittee] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [thresholdMs, setThresholdMs] = useState(DEFAULT_THRESHOLD_MS);

  // ── Load threshold from Firestore ────────────────────────────────────────
  useEffect(() => {
    const configRef = doc(db, SYSTEM_CONFIG_COLLECTION, APP_SETTINGS_DOC_ID);
    getDoc(configRef).then(snap => {
      if (snap.exists() && snap.data().restroomAlertThresholdMinutes) {
        setThresholdMs(snap.data().restroomAlertThresholdMinutes * 60 * 1000);
      }
    }).catch(console.error);
  }, []);

  // ── Redirect if not authorised ───────────────────────────────────────────
  useEffect(() => {
    if (!authSessionLoading) {
      if (!userAppRole || (userAppRole !== 'session_manager' && userAppRole !== 'admin' && userAppRole !== 'owner')) {
        router.push('/');
      }
    }
  }, [userAppRole, authSessionLoading, router]);

  // ── Populate committee defaults ─────────────────────────────────────────
  useEffect(() => {
    if (adminUser) {
      if (adminUser.defaultCommittee && !selectedCommittee) setSelectedCommittee(adminUser.defaultCommittee);
    }
  }, [adminUser, selectedCommittee]);

  // ── Fetch committees ─────────────────────────────────────────────────────
  useEffect(() => {
    getSystemCommittees().then(setCommittees).catch(console.error);
  }, []);

  // ── Real-time participant listener ───────────────────────────────────────
  useEffect(() => {
    if (!selectedCommittee) return;
    setIsLoading(true);
    const q = query(collection(db, 'participants'), where('committee', '==', selectedCommittee));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setParticipants(data);
      setIsLoading(false);
    }, err => { console.error(err); setIsLoading(false); });
    return () => unsub();
  }, [selectedCommittee]);

  // ── Overdue restroom alerts (for the persistent banner) ──────────────────
  const alerts = useRestroomAlerts(participants, thresholdMs);

  // ── Save notes is no longer needed ──

  const handleCommitteeChange = async (newCommittee: string) => {
    setSelectedCommittee(newCommittee);
    if (!adminUser?.id || userAppRole !== 'session_manager') return;
    setIsUpdatingCommittee(true);
    try {
      await updateDoc(doc(db, 'users', adminUser.id), { defaultCommittee: newCommittee, updatedAt: serverTimestamp() });
    } catch (err) { console.error(err); }
    finally { setIsUpdatingCommittee(false); }
  };

  // Core single-participant update – handles restroomBreakStartTime automatically
  const updateParticipantStatus = useCallback(async (id: string, status: AttendanceStatus) => {
    const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (status === 'Restroom Break') {
      updates.restroomBreakStartTime = new Date().toISOString();
    } else {
      updates.restroomBreakStartTime = null;
    }
    await updateDoc(doc(db, 'participants', id), updates);
  }, []);

  const handleBulkStatusUpdate = async (status: AttendanceStatus) => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
        if (status === 'Restroom Break') updates.restroomBreakStartTime = new Date().toISOString();
        else updates.restroomBreakStartTime = null;
        batch.update(doc(db, 'participants', id), updates);
      });
      await batch.commit();
      toast({ title: 'Bulk Update Successful', description: `${selectedIds.length} participant(s) → ${status}.` });
      setSelectedIds([]);
    } catch (err: any) {
      toast({ title: 'Bulk Update Failed', description: err.message, variant: 'destructive' });
    } finally { setIsBulkUpdating(false); }
  };

  const handleRestroomToggle = async (participant: Participant) => {
    const newStatus: AttendanceStatus = participant.status === 'Restroom Break' ? 'Present' : 'Restroom Break';
    try {
      await updateParticipantStatus(participant.id, newStatus);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkBack = async (participantId: string) => {
    try {
      await updateParticipantStatus(participantId, 'Present');
      toast({ title: 'Marked as Back', description: 'Status updated to Present.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === filteredParticipants.length ? [] : filteredParticipants.map(p => p.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.school.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: AttendanceStatus) => {
    const opt = ALL_ATTENDANCE_STATUSES_OPTIONS.find(o => o.status === status);
    if (!opt) return null;
    return <opt.icon className="h-4 w-4" />;
  };

  if (authSessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayoutClientShell>
      <div className="space-y-6">
        {/* ── Persistent Restroom Alert Banner (Session Manager only) ── */}
        {userAppRole === 'session_manager' && alerts.length > 0 && (
          <div className="sticky top-0 z-40 w-full">
            <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-600 p-3 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2">
                    🚻 {alerts.length} student{alerts.length > 1 ? 's' : ''} overdue in restroom
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {alerts.map(alert => (
                      <div
                        key={alert.participantId}
                        className="flex items-center gap-2 bg-white dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md px-3 py-1.5"
                      >
                        <RestroomIcon className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">{alert.participantName}</span>
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-mono font-bold">
                          <Clock className="h-3 w-3" />
                          <ElapsedLabel startTime={alert.startTime.toISOString()} />
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-green-500 text-green-700 dark:text-green-400 hover:bg-green-500/10"
                          onClick={() => handleMarkBack(alert.participantId)}
                        >
                          Back ✓
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">In Session Management</h1>
            <p className="text-muted-foreground">
              {selectedCommittee ? (
                <span>Committee: <span className="font-semibold text-foreground">{selectedCommittee}</span></span>
              ) : 'Select a committee to manage participants.'}
            </p>
          </div>
          {/* Only admins/owners can switch committees; session managers are locked to their own */}
          {userAppRole !== 'session_manager' && (
            <div className="w-full md:w-64 flex items-center gap-2">
              {isUpdatingCommittee && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Select value={selectedCommittee} onValueChange={handleCommitteeChange} disabled={isUpdatingCommittee}>
                <SelectTrigger><SelectValue placeholder="Select Committee" /></SelectTrigger>
                <SelectContent>
                  {committees.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ── Full-width participant list ── */}
        <Card className="shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Participants ({filteredParticipants.length})
                  </CardTitle>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredParticipants.length > 0 ? (
                  <div className="space-y-4">
                    {/* Bulk Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/40 rounded-lg border border-dashed border-muted-foreground/20">
                      <div className="flex items-center gap-2 px-2 mr-2 border-r border-muted-foreground/30">
                        <Checkbox
                          checked={selectedIds.length > 0 && selectedIds.length === filteredParticipants.length}
                          onCheckedChange={toggleSelectAll}
                        />
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {selectedIds.length} Selected
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ALL_ATTENDANCE_STATUSES_OPTIONS.map(opt => (
                          <Button
                            key={opt.status}
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] sm:text-xs px-2 sm:px-3"
                            disabled={selectedIds.length === 0 || isBulkUpdating}
                            onClick={() => handleBulkStatusUpdate(opt.status)}
                          >
                            <opt.icon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Participant List */}
                    <div className="grid gap-2">
                      {filteredParticipants.map(participant => {
                        const isInRestroom = participant.status === 'Restroom Break';
                        const isOverdue = alerts.some(a => a.participantId === participant.id);
                        const alert = alerts.find(a => a.participantId === participant.id);

                        return (
                          <div
                            key={participant.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm',
                              selectedIds.includes(participant.id) ? 'bg-primary/5 border-primary/30' : 'bg-card border-border',
                              isOverdue ? 'border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/20' : ''
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Checkbox
                                checked={selectedIds.includes(participant.id)}
                                onCheckedChange={() => toggleSelect(participant.id)}
                              />
                              <div className="min-w-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className={cn(
                                      'font-semibold text-sm sm:text-base cursor-default truncate',
                                      isOverdue ? 'text-amber-700 dark:text-amber-400' : ''
                                    )}>
                                      {participant.name}
                                      {isInRestroom && (
                                        <RestroomIcon className="inline h-4 w-4 ml-1.5 text-amber-500 align-text-bottom" />
                                      )}
                                    </p>
                                  </TooltipTrigger>
                                  {isInRestroom && participant.restroomBreakStartTime && (
                                    <TooltipContent side="right" className="text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" />
                                        <span>In restroom for <b><ElapsedLabel startTime={participant.restroomBreakStartTime} /></b></span>
                                      </div>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                <p className="text-xs text-muted-foreground truncate">{participant.school}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge
                                variant={
                                  participant.status === 'Present' ? 'default' :
                                  participant.status === 'Absent' ? 'destructive' : 'secondary'
                                }
                                className="hidden sm:flex items-center gap-1 text-xs"
                              >
                                {getStatusIcon(participant.status)}
                                {participant.status === 'Restroom Break' ? 'Restroom' : participant.status}
                              </Badge>

                              {/* Quick action buttons */}
                              <div className="flex items-center gap-1">
                                {/* Present */}
                                <Button
                                  variant={participant.status === 'Present' ? 'default' : 'outline'}
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => updateParticipantStatus(participant.id, 'Present')}
                                  disabled={isBulkUpdating}
                                  title="Mark Present"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                {/* Absent */}
                                <Button
                                  variant={participant.status === 'Absent' ? 'destructive' : 'outline'}
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => updateParticipantStatus(participant.id, 'Absent')}
                                  disabled={isBulkUpdating}
                                  title="Mark Absent"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                                {/* Restroom Toggle */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={isInRestroom ? 'secondary' : 'outline'}
                                      size="icon"
                                      className={cn(
                                        'h-8 w-8 rounded-full',
                                        isInRestroom
                                          ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                                          : ''
                                      )}
                                      onClick={() => handleRestroomToggle(participant)}
                                      disabled={isBulkUpdating}
                                    >
                                      <RestroomIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    {isInRestroom ? 'Mark as Back (Present)' : 'Send to Restroom Break'}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      {selectedCommittee ? (
                        'No participants found in this committee.'
                      ) : userAppRole === 'session_manager' ? (
                        'Your assigned committee is not set. Please contact a Superior Admin to assign your committee in your account settings.'
                      ) : (
                        'Please select a committee from the dropdown above to manage participants.'
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
        </div>
    </AppLayoutClientShell>
  );
}
