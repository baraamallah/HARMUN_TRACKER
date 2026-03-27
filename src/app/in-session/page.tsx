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
      await updateDoc(doc(db, 'users', adminUser.id), { defaultCommittee: newCommittee || null, updatedAt: serverTimestamp() });
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
      <div className="space-y-3 sm:space-y-6 -mx-1 sm:mx-0">
        {userAppRole === 'session_manager' && alerts.length > 0 && (
          <div className="sticky top-0 z-40 w-full px-1">
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:border-amber-600 p-2 sm:p-3 shadow-xl backdrop-blur-md">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex-shrink-0 mt-1">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">
                      🚻 {alerts.length} OVERDUE In Restroom
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {alerts.map(alert => (
                      <div
                        key={alert.participantId}
                        className="flex items-center justify-between gap-2 bg-white dark:bg-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1.5 shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-100 truncate">{alert.participantName}</span>
                          <span className="flex items-center gap-1 text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-mono font-black shrink-0">
                            <Clock className="h-3 w-3" />
                            <ElapsedLabel startTime={alert.startTime.toISOString()} />
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white shrink-0"
                          onClick={() => handleMarkBack(alert.participantId)}
                        >
                          BACK ✓
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground uppercase">Session Dashboard</h1>
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
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Attendees ({filteredParticipants.length})
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
                              'flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-xl border transition-all hover:shadow-md',
                              selectedIds.includes(participant.id) ? 'bg-primary/10 border-primary/40' : 'bg-card border-border',
                              isOverdue ? 'border-amber-500 shadow-amber-500/10 bg-amber-50/50 dark:bg-amber-900/10' : ''
                            )}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 mb-2 sm:mb-0">
                              <Checkbox
                                className="h-5 w-5"
                                checked={selectedIds.includes(participant.id)}
                                onCheckedChange={() => toggleSelect(participant.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className={cn(
                                    'font-black text-sm sm:text-lg tracking-tight truncate',
                                    isOverdue ? 'text-amber-800 dark:text-amber-200' : ''
                                  )}>
                                    {participant.name}
                                  </span>
                                  {isInRestroom && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] sm:text-xs font-bold ring-1 ring-amber-500/30">
                                      <Clock className="h-3 w-3" />
                                      <ElapsedLabel startTime={participant.restroomBreakStartTime!} />
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{participant.school}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-0 pt-2 sm:pt-0">
                              <Badge
                                variant={
                                  participant.status === 'Present' ? 'default' :
                                  participant.status === 'Absent' ? 'destructive' : 'secondary'
                                }
                                className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0 h-6"
                              >
                                {getStatusIcon(participant.status)}
                                {participant.status === 'Restroom Break' ? 'Toilet' : participant.status}
                              </Badge>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant={participant.status === 'Present' ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-xl"
                                  onClick={() => updateParticipantStatus(participant.id, 'Present')}
                                  disabled={isBulkUpdating}
                                >
                                  <CheckCircle className="h-5 w-5" />
                                </Button>
                                <Button
                                  variant={participant.status === 'Absent' ? 'destructive' : 'outline'}
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-xl"
                                  onClick={() => updateParticipantStatus(participant.id, 'Absent')}
                                  disabled={isBulkUpdating}
                                >
                                  <XCircle className="h-5 w-5" />
                                </Button>
                                <Button
                                  variant={isInRestroom ? 'secondary' : 'outline'}
                                  size="sm"
                                  className={cn(
                                    'h-9 w-9 p-0 rounded-xl',
                                    isInRestroom ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300' : ''
                                  )}
                                  onClick={() => handleRestroomToggle(participant)}
                                  disabled={isBulkUpdating}
                                >
                                  <RestroomIcon className="h-5 w-5" />
                                </Button>
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
