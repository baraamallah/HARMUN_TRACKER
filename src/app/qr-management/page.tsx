
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
import { ShieldAlert, ArrowLeft, Loader2, TriangleAlert, Home, LogOut, QrCode as QrCodeIcon, Search, Users, Download, FileArchive, FileText } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { OWNER_UID } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import type { Participant, StaffMember, AdminManagedUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getSystemLogoUrlSetting } from '@/lib/actions';
import QRCodeStyling, { type Options as QRCodeStylingOptions } from 'qr-code-styling';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const PARTICIPANTS_COLLECTION = 'participants';
const STAFF_MEMBERS_COLLECTION = 'staff_members';
const USERS_COLLECTION = 'users';

export default function QrManagementPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const { toast } = useToast();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');
  const debouncedParticipantSearchTerm = useDebounce(participantSearchTerm, 300);
  const [isZippingParticipants, setIsZippingParticipants] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [staffForQr, setStaffForQr] = useState<StaffMember[]>([]);
  const [isLoadingStaffForQr, setIsLoadingStaffForQr] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const debouncedStaffSearchTerm = useDebounce(staffSearchTerm, 300);
  const [isZippingStaff, setIsZippingStaff] = useState(false);

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
          team: data.team,
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
    p.name.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase()) ||
    p.school.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase()) ||
    p.committee.toLowerCase().includes(debouncedParticipantSearchTerm.toLowerCase())
  );

  const filteredStaffForQr = staffForQr.filter(s =>
    s.name.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase()) ||
    (s.role && s.role.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase())) ||
    (s.team && s.team.toLowerCase().includes(debouncedStaffSearchTerm.toLowerCase()))
  );

  const generateAndDownloadZip = async (items: Array<Participant | StaffMember>, type: 'participant' | 'staff') => {
    if (!appBaseUrl) {
      toast({ title: 'Error', description: 'Application base URL not available. Cannot generate QR links.', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'No Data', description: `No ${type}s match the current filters to generate QRs for.`, variant: 'default' });
      return;
    }

    if (type === 'participant') setIsZippingParticipants(true);
    if (type === 'staff') setIsZippingStaff(true);

    toast({ title: 'Processing QR Codes', description: `Generating QR codes for ${items.length} ${type}(s). This may take a moment...` });

    const zip = new JSZip();
    const qrOptionsBase: Omit<QRCodeStylingOptions, 'data'> = {
      width: 300,
      height: 300,
      margin: 10,
      qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'H' },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.35, margin: 8, crossOrigin: 'anonymous' },
      dotsOptions: { type: 'rounded', color: '#2E7D32' },
      backgroundOptions: { color: '#ffffff' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#1976D2' },
      cornersDotOptions: { type: 'dot', color: '#388E3C' },
      image: eventLogoUrl || undefined,
    };

    try {
      for (const item of items) {
        const qrData = type === 'participant'
          ? `${appBaseUrl}/checkin?id=${item.id}`
          : `${appBaseUrl}/staff-checkin?id=${item.id}`;
        
        const qrInstance = new QRCodeStyling({ ...qrOptionsBase, data: qrData });
        const blob = await qrInstance.getRawData('png');
        if (blob) {
          const fileName = `${type === 'participant' ? 'Participant' : 'Staff'}_${item.name.replace(/\s+/g, '_')}_${item.id}.png`;
          zip.file(fileName, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `HARMUN_${type}_qrcodes.zip`);
      toast({ title: 'Download Started', description: `ZIP file with ${type} QR codes is being downloaded.` });

    } catch (error: any) {
      console.error(`Error generating ZIP for ${type}s:`, error);
      toast({ title: 'ZIP Generation Failed', description: error.message || `Could not create ZIP file for ${type} QR codes.`, variant: 'destructive' });
    } finally {
      if (type === 'participant') setIsZippingParticipants(false);
      if (type === 'staff') setIsZippingStaff(false);
    }
  };

  const generateAndDownloadPdf = async (items: Participant[]) => {
    if (!appBaseUrl) {
      toast({ title: 'Error', description: 'Application base URL not available.', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'No Data', description: 'No participants match the current filters.', variant: 'default' });
      return;
    }

    setIsGeneratingPdf(true);
    toast({ title: 'Processing PDF', description: `Generating PDF for ${items.length} participant(s)...` });

    const doc = new jsPDF();
    const qrOptionsBase: Omit<QRCodeStylingOptions, 'data'> = {
      width: 150,
      height: 150,
      margin: 5,
      qrOptions: { errorCorrectionLevel: 'H' },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 4, crossOrigin: 'anonymous' },
      dotsOptions: { type: 'rounded', color: '#000' },
      backgroundOptions: { color: '#fff' },
      image: eventLogoUrl,
    };

    let x = 10, y = 10;
    const qrSize = 50;
    const pageHeight = doc.internal.pageSize.height;

    for (const item of items) {
      const qrData = `${appBaseUrl}/checkin?id=${item.id}`;
      const qrInstance = new QRCodeStyling({ ...qrOptionsBase, data: qrData });
      const qrImage = await qrInstance.getRawData('png');

      if (y + qrSize + 20 > pageHeight) {
        doc.addPage();
        y = 10;
      }
      
      if (qrImage) {
        doc.addImage(qrImage, 'PNG', x, y, qrSize, qrSize);
      }
      doc.text(item.name, x + qrSize / 2, y + qrSize + 5, { align: 'center' });
      doc.text(item.school, x + qrSize / 2, y + qrSize + 10, { align: 'center' });

      x += qrSize + 10;
      if (x + qrSize > doc.internal.pageSize.width) {
        x = 10;
        y += qrSize + 20;
      }
    }

    doc.save('participants-qrcodes.pdf');
    toast({ title: 'PDF Download Started' });
    setIsGeneratingPdf(false);
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
            <TabsTrigger value="participants" className="data-[state=active]:shadow-md transition-all">Participant QRs</TabsTrigger>
            <TabsTrigger value="staff" className="data-[state=active]:shadow-md transition-all">Staff QRs</TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold flex items-center gap-2">Participant Check-in QR Codes</CardTitle>
                <CardDescription>
                  Manage and download QR codes for participant check-in.
                  {isLoadingLogo && <span className="ml-2 text-xs text-muted-foreground">(Loading event logo settings...)</span>}
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
                      disabled={isZippingParticipants || isGeneratingPdf}
                    />
                  </div>
                  <Button 
                    onClick={() => generateAndDownloadZip(filteredParticipantsForQr, 'participant')}
                    disabled={isLoadingParticipants || isZippingParticipants || filteredParticipantsForQr.length === 0 || isGeneratingPdf}
                    className="w-full sm:w-auto"
                  >
                    {isZippingParticipants ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileArchive className="mr-2 h-5 w-5" />}
                    Download All QRs ({filteredParticipantsForQr.length})
                  </Button>
                  <Button
                    onClick={() => generateAndDownloadPdf(filteredParticipantsForQr)}
                    disabled={isLoadingParticipants || isGeneratingPdf || filteredParticipantsForQr.length === 0 || isZippingParticipants}
                    className="w-full sm:w-auto"
                  >
                    {isGeneratingPdf ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />}
                    Download as PDF ({filteredParticipantsForQr.length})
                  </Button>
                </div>
                
                {isLoadingParticipants ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
                    Loading participants...
                  </div>
                ) : filteredParticipantsForQr.length > 0 && appBaseUrl ? (
                  <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
                    <QrCodeIcon className="h-16 w-16 mx-auto mb-4 opacity-60" />
                    <p className="text-lg">
                      {filteredParticipantsForQr.length} participant(s) found matching your criteria.
                    </p>
                    <p className="text-sm">
                      Click "Download All QRs" to generate a ZIP file or "Download as PDF" for a printable sheet.
                    </p>
                  </div>
                ) : filteredParticipantsForQr.length === 0 && !isLoadingParticipants ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Users className="h-16 w-16 mx-auto mb-3 opacity-50" />
                    No participants match your search, or no participants available.
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
                  {isLoadingLogo && <span className="ml-2 text-xs text-muted-foreground">(Loading event logo settings...)</span>}
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
                      disabled={isZippingStaff}
                    />
                  </div>
                  <Button 
                    onClick={() => generateAndDownloadZip(filteredStaffForQr, 'staff')}
                    disabled={isLoadingStaffForQr || isZippingStaff || filteredStaffForQr.length === 0}
                    className="w-full sm:w-auto"
                  >
                    {isZippingStaff ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileArchive className="mr-2 h-5 w-5" />}
                    Download All QRs ({filteredStaffForQr.length})
                  </Button>
                </div>

                {isLoadingStaffForQr ? (
                   <div className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
                    Loading staff members...
                  </div>
                ) : filteredStaffForQr.length > 0 && appBaseUrl ? (
                  <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
                    <QrCodeIcon className="h-16 w-16 mx-auto mb-4 opacity-60" />
                    <p className="text-lg">
                      {filteredStaffForQr.length} staff member(s) found matching your criteria.
                    </p>
                    <p className="text-sm">
                      Click "Download All QRs" to generate a ZIP file.
                    </p>
                  </div>
                ) : filteredStaffForQr.length === 0 && !isLoadingStaffForQr ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <Users className="h-16 w-16 mx-auto mb-3 opacity-50" />
                        No staff members match your search, or no staff available.
                    </div>
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
                {userRole === 'owner' ? `Owner UID: ${OWNER_UID}` : `Admin: ${currentUser.email}`}
              </p>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
