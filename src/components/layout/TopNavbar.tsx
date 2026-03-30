'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Eye,
  LogOut,
  ShieldCheck,
  LogIn,
  Users2,
  CalendarDays,
  QrCode,
  Clipboard,
  BarChart,
  User,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';
import { ThemeToggleButton } from '@/components/shared/theme-toggle-button';
import { useAuth } from '@/hooks/use-auth';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useRestroomAlerts } from '@/hooks/use-restroom-alerts';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { logUserAction, logAuthentication, logError } from '@/lib/logging';
import type { Participant } from '@/types';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  tooltip: string;
}

const baseNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard', tooltip: 'Participant Dashboard' },
  { href: '/in-session', icon: CalendarDays, label: 'In Session', tooltip: 'Committee Session Management' },
  { href: '/staff', icon: Users2, label: 'Staff', tooltip: 'Staff Management' },
  { href: '/checkin', icon: QrCode, label: 'Check-in', tooltip: 'Participant Check-in / Status Update' },
  { href: '/staff-checkin', icon: Clipboard, label: 'Staff Status', tooltip: 'Staff Status Update Page' },
];

const adminNavItems: NavItem[] = [
  { href: '/qr-management', icon: QrCode, label: 'QR Management', tooltip: 'Manage QR Codes' },
  { href: '/superior-admin/analytics', icon: BarChart, label: 'Analytics', tooltip: 'Analytics Dashboard' },
];

const ownerOnlyNavItems: NavItem[] = [
  { href: '/superior-admin', icon: ShieldCheck, label: 'Superior Admin', tooltip: 'Superior Admin Panel' },
];

export function TopNavbar() {
  const pathname = usePathname();
  const { toast } = useToast();
  const { loggedInUser, userAppRole, adminUser, permissions, authSessionLoading, sessionState, updateSessionActivity } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // ── Notification Center: fetch all restroom-break participants ──────────
  const [allParticipants, setAllParticipants] = React.useState<Participant[]>([]);
  const [alertThresholdMs, setAlertThresholdMs] = React.useState(10 * 60 * 1000);

  const showNotifications =
    userAppRole === 'owner' ||
    ((userAppRole === 'admin' || userAppRole === 'session_manager') && permissions?.canReceiveNotifications === true);

  React.useEffect(() => {
    if (!showNotifications) return;

    // Fetch threshold from system config
    import('@/lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, getDoc }) => {
        const configRef = doc(db, 'system_config', 'main_settings');
        getDoc(configRef).then(snap => {
          if (snap.exists() && snap.data().restroomAlertThresholdMinutes) {
            setAlertThresholdMs(snap.data().restroomAlertThresholdMinutes * 60 * 1000);
          }
        }).catch(console.error);
      });
    });

    // Real-time listener for all participants in Restroom Break
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, where('status', '==', 'Restroom Break'));
    const unsubscribe = onSnapshot(q, snapshot => {
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
      
      // Filter for session managers: only show their own committee
      if (userAppRole === 'session_manager' && adminUser?.defaultCommittee) {
        data = data.filter(p => p.committee === adminUser.defaultCommittee);
      }
      
      setAllParticipants(data);
    });
    return () => unsubscribe();
  }, [showNotifications]);

  const adminAlerts = useRestroomAlerts(allParticipants, alertThresholdMs);

  const handleMarkBack = async (participantId: string) => {
    try {
      // Update session activity for session managers
      if (userAppRole === 'session_manager') {
        await updateSessionActivity();
      }
      
      await updateDoc(doc(db, 'participants', participantId), {
        status: 'Present',
        restroomBreakStartTime: null,
        updatedAt: serverTimestamp(),
      });
      
      await logUserAction('mark_participant_back_from_notification', 'participant', participantId, {
        previousStatus: 'Restroom Break',
        newStatus: 'Present',
        source: 'notification_center'
      });
      
      toast({ title: 'Participant Returned', description: 'Status updated to Present.' });
    } catch (err) {
      console.error(err);
      await logError('Failed to mark participant back from notification', err, { participantId });
      toast({ title: 'Error', description: 'Could not update status.', variant: 'destructive' });
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  const getTimestamp = (val: any): number => {
    if (!val) return Date.now();
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    if (val && typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    return Date.now();
  };

  const handleLogout = async () => {
    try {
      await logUserAction('logout_initiated', 'authentication', loggedInUser?.uid);
      await signOut(auth);
      
      const lastActivityTime = getTimestamp(sessionState?.lastActivity);
      
      await logAuthentication('logout', true, { 
        userRole: userAppRole,
        sessionDuration: Date.now() - lastActivityTime
      });
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      console.error("Error signing out: ", error);
      await logError('Logout failed', error);
      await logAuthentication('logout', false, { error: String(error) });
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const getAvatarFallback = () => {
    if (loggedInUser?.displayName) return loggedInUser.displayName.substring(0, 2).toUpperCase();
    if (loggedInUser?.email) return loggedInUser.email.substring(0, 2).toUpperCase();
    return 'U';
  };

  const navItemsToRender = React.useMemo(() => {
    if (userAppRole === 'session_manager') return [baseNavItems[1]]; // Only "In Session"

    let items = [...baseNavItems];
    if (userAppRole === 'owner') {
      items.push(...adminNavItems);
      items.push(...ownerOnlyNavItems);
    } else if (userAppRole === 'admin') {
      if (permissions?.canManageQRCodes) items.push(adminNavItems[0]);
      if (permissions?.canAccessAnalytics) items.push(adminNavItems[1]);
    } else {
      items = items.filter(i => i.href === '/');
    }

    return items.filter((item, index, self) => index === self.findIndex(t => t.href === item.href));
  }, [userAppRole, permissions]);

  const NavLinks = ({ isMobile = false }) => (
    <nav className={cn('items-center space-x-1', isMobile ? 'flex flex-col space-y-2 space-x-0' : 'hidden md:flex')}>
      {navItemsToRender.map(item => {
        const content = (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-[1.02]',
              pathname === item.href
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            onClick={async () => {
              if (isMobile) setIsMobileMenuOpen(false);
              if (pathname !== item.href) {
                await logUserAction('navigate', 'page', item.href, {
                  from: pathname,
                  to: item.href,
                  label: item.label,
                  isMobile
                });
                
                // Update session activity for session managers
                if (userAppRole === 'session_manager') {
                  await updateSessionActivity();
                }
              }
            }}
          >
            <item.icon className={cn('h-5 w-5 mr-2', pathname === item.href ? 'text-primary' : '')} />
            <span>{item.label}</span>
          </Link>
        );
        if (isMobile) return content;
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="bottom"><p>{item.tooltip}</p></TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-6 lg:px-8">
        <div className="flex items-center"><Logo /></div>

        <div className="hidden md:flex items-center space-x-4"><NavLinks /></div>

        <div className="flex items-center space-x-2">
          <ThemeToggleButton />

          {/* Enhanced Notification Center */}
          {!authSessionLoading && loggedInUser && showNotifications && (
            <NotificationCenter 
              alerts={adminAlerts} 
              onMarkBack={handleMarkBack} 
              userRole={userAppRole}
              permissions={permissions}
              notificationPreferences={{
                restroomAlerts: true,
                systemNotifications: !!(userAppRole === 'owner' || (userAppRole === 'admin' && permissions?.canReceiveNotifications)),
                userActivityAlerts: userAppRole === 'owner',
                errorNotifications: !!(userAppRole === 'owner' || (userAppRole === 'admin' && permissions?.canReceiveNotifications)),
                securityAlerts: userAppRole === 'owner'
              }}
            />
          )}

          {authSessionLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : loggedInUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={loggedInUser.photoURL || undefined} alt={loggedInUser.displayName || loggedInUser.email || 'User Avatar'} />
                    <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{loggedInUser.displayName || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{loggedInUser.email}</p>
                  </div>
                </DropdownMenuLabel>
                {userAppRole && <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground -mt-1 capitalize">Role: {userAppRole}</DropdownMenuLabel>}
                <DropdownMenuSeparator />
                {userAppRole === 'owner' && (
                  <DropdownMenuItem asChild>
                    <Link href="/superior-admin/profile">
                      <User className="mr-2 h-4 w-4" /><span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/public">
                    <Eye className="mr-2 h-4 w-4" /><span>Public View</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /><span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/auth/login?redirect=${pathname}`}>
                <LogIn className="mr-2 h-4 w-4" /><span>Sign In</span>
              </Link>
            </Button>
          )}

          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="flex flex-col space-y-4 pt-6"><NavLinks isMobile /></div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}