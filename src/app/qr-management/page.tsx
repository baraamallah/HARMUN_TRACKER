
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldAlert, ArrowLeft, Loader2, TriangleAlert, Home, LogOut, QrCode as QrCodeIcon, Search } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { OWNER_UID } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import type { Participant, StaffMember } from '@/types';
import { QrCodeDisplay } from '@/components/shared/QrCodeDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { getSystemLogoUrlSetting } from '@/lib/actions';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';

export default function QrManagementPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const { toast } = useToast();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');
  const debouncedParticipantSearchTerm = useDebounce(participantSearchTerm, 300);

  const [staffForQr, setStaffForQr] = useState<StaffMember[]>([]);
  const [isLoadingStaffForQr, setIsLoadingStaffForQr] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const debouncedStaffSearchTerm = useDebounce(staffSearchTerm, 300);

  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [eventLogoUrl, setEventLogoUrl] = useState<string | undefined>(undefined);
  const [isLoadingLogo, setIsLoadingLogo] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppBaseUrl(window.location.origin);
    }
    const fetchLogo = async () => {
      setIsLoadingLogo(true);
      try {
        const url = await getSystemLogoUrlSetting();
        if (url) setEventLogoUrl(url);
      } catch (error) {
        console.error("Failed to fetch system logo URL for QR management:", error);
      } finally {
        setIsLoadingLogo(false);
      }
    };
    fetchLogo();
  }, []);

  const fetchParticipantsData = useCallback(async () => {
    if (!currentUser || currentUser.uid !== OWNER_UID) return;
    setIsLoadingParticipants(true);
    try {
      const participantsColRef = collection(db, PARTICIPANTS_COLLECTION);
      const q = query(participantsColRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const fetchedParticipants = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          school: data.school || '',
          committee: data.committee || '',
          status: data.status || 'Absent',
          imageUrl: data.imageUrl,
        } as Participant;
      });
      setParticipants(fetchedParticipants);
    } catch (error: any) {
      console.error("Error fetching participants for QR codes: ", error);
      toast({ title: 'Error Fetching Participants', description: error.message || "Failed to load participants for QR codes.", variant: 'destructive' });
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [currentUser, toast]);

  const fetchStaffForQrData = useCallback(async () => {
    if (!currentUser || currentUser.uid !== OWNER_UID) return;
    setIsLoadingStaffForQr(true);
    try {
      const staffColRef = collection(db, STAFF_MEMBERS_COLLECTION);
      const q = query(staffColRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const fetchedStaff = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          role: data.role || '',
          team: data.team,
          imageUrl: data.imageUrl,
          status: data.status || 'Off Duty',
        } as StaffMember;
      });
      setStaffForQr(fetchedStaff);
    } catch (error: any) {
      console.error("Error fetching staff for QR codes: ", error);
      toast({ title: 'Error Fetching Staff (QR)', description: error.message || "Failed to load staff for QR codes.", variant: 'destructive' });
    } finally {
      setIsLoadingStaffForQr(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
      if (user && user.uid === OWNER_UID) {
        fetchParticipantsData();
        fetchStaffForQrData();
      }
    });
    return () => unsubscribe();
  }, [fetchParticipantsData, fetchStaffForQrData]);

  const handleSuperAdminLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const filteredParticipantsForQr = participants.filter(p =>
    p.name.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase()) ||
    p.school.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase()) ||
    p.committee.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase())
  );

  const filteredStaffForQr = staffForQr.filter(s =>
    s.name.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase()) ||
    (s.role && s.role.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase())) ||
    (s.team && s.team.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase()))
  );

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-md shadow-2xl border-t-4 border-primary">
          <CardHeader className="text-center py-8">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">QR Code Management</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">Verifying credentials...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser || currentUser.uid !== OWNER_UID) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-destructive/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-t-4 border-destructive">
          <CardHeader className="py-8">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert size={60} />
            </div>
            <CardTitle className="text-4xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-xl mt-3 text-muted-foreground">
              This area is restricted to the System Owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {currentUser && (
              <Button onClick={handleSuperAdminLogout} variant="destructive" size="lg" className="w-full text-lg py-3">
                <LogOut className="mr-2 h-5 w-5" /> Logout ({currentUser.email || 'Restricted User'})
              </Button>
            )}
            {!currentUser && (
                 <p className="text-md text-muted-foreground mt-4">
                    Please <Link href="/auth/login" className="font-semibold text-primary hover:underline">log in</Link> with the designated Owner account.
                 </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4 p-6 pt-2">
            <Link href="/" legacyBehavior passHref>
              <Button variant="outline" className="w-full text-md py-3">
                <Home className="mr-2 h-5 w-5" /> Go to Main Dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const renderQrGridSkeleton = (count: number, keyPrefix: string) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={`${keyPrefix}-skel-${i}`} className="p-4 border rounded-lg shadow-sm bg-muted/50 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-40 w-40 mx-auto rounded-md" />
          <Skeleton className="h-8 w-full mt-2" />
          <Skeleton className="h-4 w-full mt-1" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <QrCodeIcon className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                QR Code Management
              </h1>
              {currentUser && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Owner Access: {currentUser.email}
                </p>
              )}
            </div>
          </div>
          <Link href="/" legacyBehavior passHref>
            <Button variant="outline" size="lg" className="text-md">
              <Home className="mr-2 h-5 w-5" /> Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-1/2 lg:w-1/3 mx-auto mb-8">
            <TabsTrigger value="participants">Participant QRs</TabsTrigger>
            <TabsTrigger value="staff">Staff QRs</TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold flex items-center gap-2">Participant Check-in QR Codes</CardTitle>
                <CardDescription>
                  Generate and view QR codes for individual participant check-in. Each QR code links to <code>{appBaseUrl}/checkin?id=PARTICIPANT_ID</code>.
                  {isLoadingLogo && <span className="ml-2 text-xs text-muted-foreground">(Loading event logo settings...)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search participants by name, school, or committee..."
                    value={participantSearchTerm}
                    onChange={(e) => setParticipantSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                {isLoadingParticipants || isLoadingLogo ? (
                  renderQrGridSkeleton(8, 'p')
                ) : filteredParticipantsForQr.length > 0 && appBaseUrl ? (
                  <ScrollArea className="h-[600px] pr-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {filteredParticipantsForQr.map(participant => (
                        <div key={participant.id} className="flex flex-col items-center p-1 rounded-lg">
                          <h3 className="text-md font-semibold mb-2 truncate w-full text-center" title={participant.name}>{participant.name}</h3>
                          <QrCodeDisplay
                            value={`${appBaseUrl}/checkin?id=${participant.id}`}
                            initialSize={160}
                            downloadFileName={`harmun-participant-qr-${participant.name.replace(/\s+/g, '_')}-${participant.id}.png`}
                            eventLogoUrl={eventLogoUrl}
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : filteredParticipantsForQr.length === 0 && !isLoadingParticipants ? (
                  <p className="text-center text-muted-foreground py-10">No participants match your search, or no participants available.</p>
                ) : !appBaseUrl && !isLoadingParticipants ? (
                  <p className="text-center text-orange-500 py-10">Initializing application base URL to generate QR links...</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold flex items-center gap-2">Staff Member Status QR Codes</CardTitle>
                <CardDescription>
                  Generate and view QR codes for individual staff member status updates. Each QR code links to <code>{appBaseUrl}/staff-checkin?id=STAFF_ID</code>.
                  {isLoadingLogo && <span className="ml-2 text-xs text-muted-foreground">(Loading event logo settings...)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search staff by name, role, or team..."
                    value={staffSearchTerm}
                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                {isLoadingStaffForQr || isLoadingLogo ? (
                  renderQrGridSkeleton(4, 's')
                ) : filteredStaffForQr.length > 0 && appBaseUrl ? (
                  <ScrollArea className="h-[600px] pr-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {filteredStaffForQr.map(staff => (
                        <div key={staff.id} className="flex flex-col items-center p-1 rounded-lg">
                          <h3 className="text-md font-semibold mb-2 truncate w-full text-center" title={`${staff.name} (${staff.role})`}>{staff.name}</h3>
                          <QrCodeDisplay
                            value={`${appBaseUrl}/staff-checkin?id=${staff.id}`}
                            initialSize={160}
                            downloadFileName={`harmun-staff-qr-${staff.name.replace(/\s+/g, '_')}-${staff.id}.png`}
                            eventLogoUrl={eventLogoUrl}
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : filteredStaffForQr.length === 0 && !isLoadingStaffForQr ? (
                  <p className="text-center text-muted-foreground py-10">No staff members match your search, or no staff available.</p>
                ) : !appBaseUrl && !isLoadingStaffForQr ? (
                  <p className="text-center text-orange-500 py-10">Initializing application base URL to generate QR links...</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="py-10 border-t mt-16 bg-background/80">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-md text-muted-foreground">
              MUN Tracker - QR Code Management &copy; {new Date().getFullYear()}
            </p>
            {currentUser && (
              <p className="text-xs text-muted-foreground mt-1">
                Owner UID: {OWNER_UID}
              </p>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
