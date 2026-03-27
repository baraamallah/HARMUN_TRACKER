'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { AppLayoutClientShell } from '@/components/layout/AppLayoutClientShell';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import {
  getParticipants,
  getSystemCommittees
} from '@/lib/actions';
import type { Participant, AttendanceStatus } from '@/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Users,
  Save,
  CheckCircle,
  XCircle,
  Coffee,
  UserRound,
  Wrench,
  LogOutIcon,
  AlertOctagon,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, serverTimestamp, onSnapshot, query, where, collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ALL_ATTENDANCE_STATUSES_OPTIONS } from '@/lib/constants';

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
  const [sessionNotes, setSessionNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Redirect if not session manager or admin
  useEffect(() => {
    if (!authSessionLoading) {
      if (!userAppRole || (userAppRole !== 'session_manager' && userAppRole !== 'admin' && userAppRole !== 'owner')) {
        router.push('/');
      }
    }
  }, [userAppRole, authSessionLoading, router]);

  // Set default committee and notes from user profile
  useEffect(() => {
    if (adminUser) {
      if (adminUser.defaultCommittee && !selectedCommittee) {
        setSelectedCommittee(adminUser.defaultCommittee);
      }
      setSessionNotes(adminUser.sessionNotes || '');
    }
  }, [adminUser, selectedCommittee]);

  // Fetch committees
  useEffect(() => {
    async function fetchCommittees() {
      try {
        const list = await getSystemCommittees();
        setCommittees(list);
      } catch (error) {
        console.error("Error fetching committees:", error);
      }
    }
    fetchCommittees();
  }, []);

  // Real-time listener for participants
  useEffect(() => {
    if (!selectedCommittee) return;

    setIsLoading(true);
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, where('committee', '==', selectedCommittee));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as Participant[];

      // Sort by name
      data.sort((a, b) => a.name.localeCompare(b.name));
      setParticipants(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to participants:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCommittee]);

  const handleSaveNotes = async () => {
    if (!adminUser?.id) return;
    setIsSavingNotes(true);
    try {
      const userRef = doc(db, 'users', adminUser.id);
      await updateDoc(userRef, {
        sessionNotes: sessionNotes,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Notes Saved", description: "Your session notes have been updated." });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCommitteeChange = async (newCommittee: string) => {
    setSelectedCommittee(newCommittee);
    if (!adminUser?.id || userAppRole !== 'session_manager') return;

    setIsUpdatingCommittee(true);
    try {
      const userRef = doc(db, 'users', adminUser.id);
      await updateDoc(userRef, {
        defaultCommittee: newCommittee,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Default Committee Updated", description: `"${newCommittee}" is now your default committee.` });
    } catch (error) {
      console.error("Error updating default committee:", error);
    } finally {
      setIsUpdatingCommittee(false);
    }
  };

  const handleBulkStatusUpdate = async (status: AttendanceStatus) => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, "participants", id), {
          status,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast({
        title: "Bulk Update Successful",
        description: `${selectedIds.length} participant(s) updated to ${status}.`
      });
      setSelectedIds([]);
    } catch (error: any) {
      console.error("Bulk update failed:", error);
      toast({ title: "Bulk Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredParticipants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParticipants.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">In Session Management</h1>
            <p className="text-muted-foreground">Manage your committee session participants and notes.</p>
          </div>
          <div className="w-full md:w-64 flex items-center gap-2">
            {isUpdatingCommittee && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Select value={selectedCommittee} onValueChange={handleCommitteeChange} disabled={isUpdatingCommittee}>
              <SelectTrigger>
                <SelectValue placeholder="Select Committee" />
              </SelectTrigger>
              <SelectContent>
                {committees.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main List Area */}
          <div className="lg:col-span-2 space-y-4">
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
                      onChange={(e) => setSearchTerm(e.target.value)}
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
                      {filteredParticipants.map(participant => (
                        <div
                          key={participant.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm",
                            selectedIds.includes(participant.id) ? "bg-primary/5 border-primary/30" : "bg-card border-border"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedIds.includes(participant.id)}
                              onCheckedChange={() => toggleSelect(participant.id)}
                            />
                            <div>
                              <p className="font-semibold text-sm sm:text-base">{participant.name}</p>
                              <p className="text-xs text-muted-foreground">{participant.school}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                participant.status === 'Present' ? 'default' :
                                participant.status === 'Absent' ? 'destructive' : 'secondary'
                              }
                              className="hidden sm:flex items-center gap-1"
                            >
                              {getStatusIcon(participant.status)}
                              {participant.status}
                            </Badge>

                            {/* Quick status toggle for single student */}
                            <div className="flex items-center gap-1">
                               <Button
                                variant={participant.status === 'Present' ? 'default' : 'outline'}
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  setSelectedIds([participant.id]);
                                  handleBulkStatusUpdate('Present');
                                }}
                                disabled={isBulkUpdating}
                               >
                                 <CheckCircle className="h-4 w-4" />
                               </Button>
                               <Button
                                variant={participant.status === 'Absent' ? 'destructive' : 'outline'}
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  setSelectedIds([participant.id]);
                                  handleBulkStatusUpdate('Absent');
                                }}
                                disabled={isBulkUpdating}
                               >
                                 <XCircle className="h-4 w-4" />
                               </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">No participants found in this committee.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            <Card className="shadow-md border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Save className="h-5 w-5 text-primary" />
                  Session Notes
                </CardTitle>
                <CardDescription>
                  Personal notes for your session. These are saved to your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Write your session notes here... (e.g. outstanding delegates, issues, etc.)"
                  className="min-h-[300px] bg-background resize-none focus-visible:ring-primary"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Session Notes
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Quick Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Use the checkboxes to select multiple students for bulk status changes.</p>
                <p>• The top bar allows you to set status for all selected students at once.</p>
                <p>• Use the search bar to quickly find specific students.</p>
                <p>• Notes are private to your account and persistent across sessions.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayoutClientShell>
  );
}
