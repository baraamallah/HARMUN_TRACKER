
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldAlert, ArrowLeft, Loader2, TriangleAlert, Home, LogOut, QrCode as QrCodeIcon, Search, Users, Download, FileArchive, Filter, Eye, CheckCircle2, Info } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { OWNER_UID } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import type { Participant, StaffMember, AdminManagedUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PUBLIC_EVENT_CONFIG } from '@/lib/public-event-config';
import QRCodeStyling, { type Options as QRCodeStylingOptions } from 'qr-code-styling';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Footer } from '@/components/layout/Footer';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';
const USERS_COLLECTION = 'users';

/**
 * QR MANAGEMENT FOOTER CONFIGURATION
 * Edit these values to manually update the QR management footer content easily.
 */
const QR_FOOTER_CONFIG = {
  brandName: 'MUN Tracker - QR Code Management',
};

export default function QrManagementPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const { toast } = useToast();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');
  const debouncedParticipantSearchTerm = useDebounce(participantSearchTerm, 300);
  const [selectedParticipantSchool, setSelectedParticipantSchool] = useState('All Schools');
  const [selectedParticipantCommittee, setSelectedParticipantCommittee] = useState('All Committees');
  const [isZippingParticipants, setIsZippingParticipants] = useState(false);

  const [staffForQr, setStaffForQr] = useState<StaffMember[]>([]);
  const [isLoadingStaffForQr, setIsLoadingStaffForQr] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const debouncedStaffSearchTerm = useDebounce(staffSearchTerm, 300);
  const [selectedStaffRole, setSelectedStaffRole] = useState('All Roles');
  const [selectedStaffTeam, setSelectedStaffTeam] = useState('All Teams');
  const [isZippingStaff, setIsZippingStaff] = useState(false);

  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [previewItem, setPreviewItem] = useState<Participant | StaffMember | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const participantSchools = [
    'All Schools',
    ...new Set(participants.map(p => p.school).filter((s): s is string => !!s).sort()),
  ];
  const participantCommittees = [
    'All Committees',
    ...new Set(participants.map(p => p.committee).filter((c): c is string => !!c).sort()),
  ];
  const staffRoles = [
    'All Roles',
    ...new Set(staffForQr.map(s => s.role).filter((r): r is string => !!r).sort()),
  ];
  const staffTeams = [
    'All Teams',
    ...new Set(staffForQr.map(s => s.team).filter((t): t is string => !!t).sort()),
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppBaseUrl(window.location.origin);
    }
  }, []);

  const eventLogoUrl = appBaseUrl ? `${appBaseUrl}${PUBLIC_EVENT_CONFIG.eventLogoPath}` : undefined;

  const fetchUserDataAndRoles = useCallback(async (user: User) => {
    if (user.uid === OWNER_UID) {
      setUserRole('owner');
      return 'owner';
    }
    try {
      const userDocRef = doc(db, USERS_COLLECTION, user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as AdminManagedUser;
        if (userData.role === 'admin') {
          setUserRole('admin');
          return 'admin';
        }
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      toast({ title: "Error", description: "Could not verify user role.", variant: "destructive" });
    }
    setUserRole('user'); 
    return 'user';
  }, [toast]);

  const fetchParticipantsData = useCallback(async () => {
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
      toast({ title: 'Error Fetching Participants', description: error.message || "Failed to load participants.", variant: 'destructive' });
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [toast]);

  const fetchStaffForQrData = useCallback(async () => {
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
          team: data.team || '',
          imageUrl: data.imageUrl,
          status: data.status || 'Off Duty',
        } as StaffMember;
      });
      setStaffForQr(fetchedStaff);
    } catch (error: any) {
      console.error("Error fetching staff for QR codes: ", error);
      toast({ title: 'Error Fetching Staff (QR)', description: error.message || "Failed to load staff.", variant: 'destructive' });
    } finally {
      setIsLoadingStaffForQr(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const role = await fetchUserDataAndRoles(user);
        if (role === 'owner' || role === 'admin') {
          fetchParticipantsData();
          fetchStaffForQrData();
        }
      } else {
        setUserRole(null);
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [fetchUserDataAndRoles, fetchParticipantsData, fetchStaffForQrData]);

  const handleSuperAdminLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const filteredParticipantsForQr = participants.filter(p =>
    (p.name.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase()) ||
    p.school.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase()) ||
    p.committee.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase())) &&
    (selectedParticipantSchool === 'All Schools' || p.school === selectedParticipantSchool) &&
    (selectedParticipantCommittee === 'All Committees' || p.committee === selectedParticipantCommittee)
  );

  const filteredStaffForQr = staffForQr.filter(s =>
    (s.name.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase()) ||
    (s.role && s.role.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase())) ||
    (s.team && s.team.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase()))) &&
    (selectedStaffRole === 'All Roles' || s.role === selectedStaffRole) &&
    (selectedStaffTeam === 'All Teams' || s.team === selectedStaffTeam)
  );

  const generateQRCodeBlob = async (data: string, logoUrl?: string) => {
    const qrOptions: QRCodeStylingOptions = {
      width: 600,
      height: 600,
      margin: 20,
      qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'H' },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 10, crossOrigin: 'anonymous' },
      dotsOptions: { type: 'rounded', color: '#1a1a1a' },
      backgroundOptions: { color: '#ffffff' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#000000' },
      cornersDotOptions: { type: 'dot', color: '#000000' },
      image: logoUrl,
    };
    const qrInstance = new QRCodeStyling(qrOptions);
    return await qrInstance.getRawData('png');
  };

  const combineQRWithText = async (item: Participant | StaffMember, qrBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        const textHeight = 120;
        canvas.width = img.width;
        canvas.height = img.height + textHeight;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR
        ctx.drawImage(img, 0, 0);

        // Draw Name
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.name.toUpperCase(), canvas.width / 2, img.height + 50);

        // Draw Subtitle (School or Team)
        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#666666';
        const subtitle = 'school' in item ? (item as Participant).school : (item as StaffMember).team || (item as StaffMember).role;
        if (subtitle) {
          ctx.fillText(subtitle, canvas.width / 2, img.height + 95);
        }

        canvas.toBlob((blob) => {
          if (blob) resolve(blob as Blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load QR image'));
      img.src = URL.createObjectURL(qrBlob as Blob);
    });
  };

  const handlePreview = async (item: Participant | StaffMember) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  const generateAndDownloadZip = async (items: Array<Participant | StaffMember>, type: 'participant' | 'staff') => {
    if (!appBaseUrl) {
      toast({ title: 'Error', description: 'Application base URL not available.', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'No Data', description: `No ${type}s match filters.`, variant: 'default' });
      return;
    }

    if (type === 'participant') setIsZippingParticipants(true);
    if (type === 'staff') setIsZippingStaff(true);

    toast({ title: 'Generating High-Quality QRs', description: `Processing ${items.length} ${type}(s) with labels...` });

    const zip = new JSZip();

    try {
      for (const item of items) {
        const qrData = type === 'participant'
          ? `${appBaseUrl}/checkin?id=${item.id}`
          : `${appBaseUrl}/staff-checkin?id=${item.id}`;
        
        const qrBlob = await generateQRCodeBlob(qrData, eventLogoUrl);
        if (qrBlob) {
          const combinedBlob = await combineQRWithText(item, qrBlob as Blob);
          const fileName = `${type}_${item.name.replace(/\s+/g, '_')}.png`;
          zip.file(fileName, combinedBlob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `HARMUN_${type}_Labeled_QRs.zip`);
      toast({ title: 'Download Ready', description: `Successfully generated ${items.length} labeled QR codes.` });

    } catch (error: any) {
      console.error(`Error generating ZIP for ${type}s:`, error);
      toast({ title: 'Generation Failed', description: error.message || 'Could not create labeled QRs.', variant: 'destructive' });
    } finally {
      if (type === 'participant') setIsZippingParticipants(false);
      if (type === 'staff') setIsZippingStaff(false);
    }
  };


  if (isLoadingAuth || (userRole === null && currentUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-md shadow-2xl border-t-4 border-primary">
          <CardHeader className="text-center py-8">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">QR Code Management</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">Verifying access...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser || (userRole !== 'owner' && userRole !== 'admin')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-destructive/10 via-background to-background p-6 text-center">
        <Card className="w-full max-w-lg shadow-2xl border-t-4 border-destructive">
          <CardHeader className="py-8">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert size={60} />
            </div>
            <CardTitle className="text-4xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-xl mt-3 text-muted-foreground">
              You do not have permission to access this page. Administrator or Owner access is required.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {currentUser && (
              <Button onClick={handleSuperAdminLogout} variant="outline" size="lg" className="w-full text-lg py-3">
                <LogOut className="mr-2 h-5 w-5" /> Logout ({currentUser.email || 'User'})
              </Button>
            )}
            {!currentUser && (
                 <p className="text-md text-muted-foreground mt-4">
                    Please <Link href="/auth/login" className="font-semibold text-primary hover:underline">log in</Link> with an authorized account.
                 </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4 p-6 pt-2">
            <Button asChild variant="outline" className="w-full text-md py-3">
              <Link href="/">
                <span><Home className="mr-2 h-5 w-5" /> Go to Main Dashboard</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
                  {userRole === 'owner' ? 'Owner Access' : 'Admin Access'}: {currentUser.email}
                </p>
              )}
            </div>
          </div>
          <Button asChild variant="outline" size="lg" className="text-md">
            <Link href="/">
              <span><Home className="mr-2 h-5 w-5" /> Dashboard</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Participants</p>
                <p className="text-2xl font-bold">{participants.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Staff</p>
                <p className="text-2xl font-bold">{staffForQr.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20 text-primary-foreground bg-primary">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider">System Status</p>
                <p className="text-2xl font-bold">Ready</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-1/2 lg:w-1/3 mx-auto mb-8">
            <TabsTrigger value="participants" className="data-[state=active]:shadow-md transition-all">Participant QRs</TabsTrigger>
            <TabsTrigger value="staff" className="data-[state=active]:shadow-md transition-all">Staff QRs</TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold flex items-center gap-2">Participant Check-in QR Codes</CardTitle>
                <CardDescription>
                  Manage and download QR codes for participant check-in.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search participants..."
                      value={participantSearchTerm}
                      onChange={(e) => setParticipantSearchTerm(e.target.value)}
                      className="pl-10 w-full focus-visible:ring-primary"
                      disabled={isLoadingParticipants || isZippingParticipants}
                    />
                  </div>

                  {/* Participant School Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isLoadingParticipants || isZippingParticipants}>
                        <Filter className="mr-2 h-4 w-4" /> {selectedParticipantSchool}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Filter by School</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {participantSchools.map(school => (
                        <DropdownMenuItem key={school} onClick={() => setSelectedParticipantSchool(school)}>
                          {school}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Participant Committee Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isLoadingParticipants || isZippingParticipants}>
                         <Filter className="mr-2 h-4 w-4" /> {selectedParticipantCommittee}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Filter by Committee</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {participantCommittees.map(committee => (
                        <DropdownMenuItem key={committee} onClick={() => setSelectedParticipantCommittee(committee)}>
                          {committee}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button 
                    onClick={() => generateAndDownloadZip(filteredParticipantsForQr, 'participant')}
                    disabled={isLoadingParticipants || isZippingParticipants || filteredParticipantsForQr.length === 0 || !appBaseUrl}
                    className="w-full sm:w-auto font-semibold"
                  >
                    {isZippingParticipants ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileArchive className="mr-2 h-5 w-5" />}
                    Generate & Download {filteredParticipantsForQr.length} QRs
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-lg flex items-start gap-3 mb-6">
                   <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                   <p className="text-sm text-blue-700 dark:text-blue-300">
                     Each generated QR code image will now include the <strong>person's name and school</strong> directly below the code for easier identification during printing and distribution.
                   </p>
                </div>
                
                {isLoadingParticipants ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
                    Loading participants...
                  </div>
                ) : filteredParticipantsForQr.length > 0 && appBaseUrl ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto p-2 border rounded-lg bg-muted/20">
                    {filteredParticipantsForQr.map(p => (
                      <Card key={p.id} className="overflow-hidden hover:ring-2 ring-primary/50 transition-all cursor-pointer group" onClick={() => handlePreview(p)}>
                        <div className="p-4 flex flex-col items-center text-center">
                          <div className="w-24 h-24 bg-white p-2 rounded border group-hover:scale-105 transition-transform">
                             <QrCodeIcon className="w-full h-full text-muted-foreground/30" />
                          </div>
                          <p className="mt-3 font-semibold truncate w-full">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate w-full">{p.school}</p>
                          <Button variant="ghost" size="sm" className="mt-2 h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="h-3 w-3 mr-1" /> Preview
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : filteredParticipantsForQr.length === 0 && !isLoadingParticipants ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Users className="h-16 w-16 mx-auto mb-3 opacity-50" />
                    No participants match your search and filter criteria, or no participants available.
                  </div>
                ) : !appBaseUrl && !isLoadingParticipants ? (
                  <p className="text-center text-orange-500 py-10">Initializing application base URL to generate QR links...</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold flex items-center gap-2">Staff Member Status QR Codes</CardTitle>
                <CardDescription>
                  Manage and download QR codes for staff member status updates.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                 <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search staff..."
                      value={staffSearchTerm}
                      onChange={(e) => setStaffSearchTerm(e.target.value)}
                      className="pl-10 w-full focus-visible:ring-primary"
                      disabled={isLoadingStaffForQr || isZippingStaff}
                    />
                  </div>

                  {/* Staff Role Filter */}
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isLoadingStaffForQr || isZippingStaff}>
                         <Filter className="mr-2 h-4 w-4" /> {selectedStaffRole}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {staffRoles.map(role => (
                        <DropdownMenuItem key={role} onClick={() => setSelectedStaffRole(role)}>
                          {role}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Staff Team Filter */}
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isLoadingStaffForQr || isZippingStaff}>
                         <Filter className="mr-2 h-4 w-4" /> {selectedStaffTeam}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Filter by Team</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {staffTeams
                        .map(team => (
                        <DropdownMenuItem key={team} onClick={() => setSelectedStaffTeam(team)}>
                          {team}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>


                  <Button 
                    onClick={() => generateAndDownloadZip(filteredStaffForQr, 'staff')}
                    disabled={isLoadingStaffForQr || isZippingStaff || filteredStaffForQr.length === 0 || !appBaseUrl}
                    className="w-full sm:w-auto font-semibold"
                  >
                    {isZippingStaff ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileArchive className="mr-2 h-5 w-5" />}
                    Generate & Download {filteredStaffForQr.length} QRs
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-lg flex items-start gap-3 mb-6">
                   <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                   <p className="text-sm text-blue-700 dark:text-blue-300">
                     Each generated QR code image will now include the <strong>staff member's name and team</strong> directly below the code for easier identification.
                   </p>
                </div>

                {isLoadingStaffForQr ? (
                   <div className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
                    Loading staff members...
                  </div>
                ) : filteredStaffForQr.length > 0 && appBaseUrl ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto p-2 border rounded-lg bg-muted/20">
                    {filteredStaffForQr.map(s => (
                      <Card key={s.id} className="overflow-hidden hover:ring-2 ring-primary/50 transition-all cursor-pointer group" onClick={() => handlePreview(s)}>
                        <div className="p-4 flex flex-col items-center text-center">
                          <div className="w-24 h-24 bg-white p-2 rounded border group-hover:scale-105 transition-transform">
                             <QrCodeIcon className="w-full h-full text-muted-foreground/30" />
                          </div>
                          <p className="mt-3 font-semibold truncate w-full">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate w-full">{s.team || s.role}</p>
                          <Button variant="ghost" size="sm" className="mt-2 h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="h-3 w-3 mr-1" /> Preview
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : filteredStaffForQr.length === 0 && !isLoadingStaffForQr ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <Users className="h-16 w-16 mx-auto mb-3 opacity-50" />
                        No staff members match your search and filter criteria, or no staff available.
                    </div>
                ) : !appBaseUrl && !isLoadingStaffForQr ? (
                  <p className="text-center text-orange-500 py-10">Initializing application base URL to generate QR links...</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code Preview</DialogTitle>
              <DialogDescription>
                Labels are automatically added during the batch download process.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border-2 border-dashed">
               {previewItem && appBaseUrl && (
                  <QRPreviewComponent
                    item={previewItem}
                    baseUrl={appBaseUrl}
                    logoUrl={eventLogoUrl}
                  />
               )}
            </div>
            <div className="flex justify-center gap-4">
               <Button onClick={() => setIsPreviewOpen(false)}>Close Preview</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-16">
          <Footer />
        </div>
      </main>
    </div>
  );
}

function QRPreviewComponent({ item, baseUrl, logoUrl }: { item: Participant | StaffMember, baseUrl: string, logoUrl?: string }) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;
    const generatePreview = async () => {
      const isParticipant = 'school' in item;
      const data = isParticipant
        ? `${baseUrl}/checkin?id=${item.id}`
        : `${baseUrl}/staff-checkin?id=${item.id}`;

      const qrOptions: QRCodeStylingOptions = {
        width: 300,
        height: 300,
        margin: 10,
        qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'H' },
        imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 5, crossOrigin: 'anonymous' },
        dotsOptions: { type: 'rounded', color: '#1a1a1a' },
        backgroundOptions: { color: '#ffffff' },
        cornersSquareOptions: { type: 'extra-rounded', color: '#000000' },
        cornersDotOptions: { type: 'dot', color: '#000000' },
        image: logoUrl,
      };
      const qrInstance = new QRCodeStyling(qrOptions);
      qrInstance.update({ data });
      const blob = await qrInstance.getRawData('png');
      if (blob) {
        currentUrl = URL.createObjectURL(blob as Blob);
        setQrSrc(currentUrl);
      }
    };
    generatePreview();
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [item, baseUrl, logoUrl]);

  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-lg shadow-sm">
      {qrSrc ? (
        <img src={qrSrc} alt="QR Code Preview" className="w-48 h-48" />
      ) : (
        <div className="w-48 h-48 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      )}
      <p className="mt-4 font-bold text-black uppercase">{item.name}</p>
      <p className="text-sm text-gray-500 font-medium">
        {'school' in item ? item.school : (item as StaffMember).team || (item as StaffMember).role}
      </p>
    </div>
  );
}
