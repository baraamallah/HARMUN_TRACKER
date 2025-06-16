
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Eye,
  LogOut,
  UserCog, 
  SettingsIcon, 
  ShieldCheck, 
  LogIn,
  Users2, 
  QrCode, 
  Clipboard,
  ScanLine // Added ScanLine icon
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarMenuSkeleton
} from '@/components/ui/sidebar';
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
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged, signOut, User } from 'firebase/auth'; 
import { doc, getDoc } from 'firebase/firestore';
import { OWNER_UID } from '@/lib/constants'; 
import { useToast } from '@/hooks/use-toast';
import type { AdminManagedUser } from '@/types';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  tooltip: string;
  adminOrOwnerOnly?: boolean;
  ownerOnly?: boolean; 
}

const baseNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard', tooltip: 'Participant Dashboard' },
  { href: '/staff', icon: Users2, label: 'Staff', tooltip: 'Staff Management' },
  { href: '/checkin', icon: QrCode, label: 'Check-in', tooltip: 'Participant Check-in / Status Update' },
  { href: '/staff-checkin', icon: Clipboard, label: 'Staff Status', tooltip: 'Staff Status Update Page' },
  { href: '/scan', icon: ScanLine, label: 'Scan QR', tooltip: 'Scan Participant/Staff QR Code' },
];

const adminAndOwnerNavItems: NavItem[] = [
   { href: '/qr-management', icon: QrCode, label: 'QR Management', tooltip: 'Manage QR Codes', adminOrOwnerOnly: true },
];

const ownerOnlyNavItems: NavItem[] = [
  { href: '/superior-admin', icon: ShieldCheck, label: 'Superior Admin', tooltip: 'Superior Admin Panel', ownerOnly: true },
];

const publicNavItems: NavItem[] = [
 { href: '/public', icon: Eye, label: 'Public View', tooltip: 'Public Participant View' },
];


export function AppLayoutClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [loggedInUser, setLoggedInUser] = React.useState<User | null>(null);
  const [userAppRole, setUserAppRole] = React.useState<'owner' | 'admin' | 'user' | null>(null);
  const [authSessionLoading, setAuthSessionLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoggedInUser(user);
      if (user) {
        if (user.uid === OWNER_UID) {
          setUserAppRole('owner');
        } else {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data() as AdminManagedUser;
              if (userData.role === 'admin') {
                setUserAppRole('admin');
              } else {
                setUserAppRole('user');
              }
            } else {
              setUserAppRole('user'); // Not in users collection, treat as regular user
            }
          } catch (error) {
            console.error("Error fetching user role for sidebar:", error);
            setUserAppRole('user'); // Default on error
          }
        }
      } else {
        setUserAppRole(null);
      }
      setAuthSessionLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: 'Logout Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  };

  const getAvatarFallback = () => {
    if (loggedInUser?.email) {
      return loggedInUser.email.substring(0, 2).toUpperCase();
    }
    if (loggedInUser?.displayName) {
      return loggedInUser.displayName.substring(0, 2).toUpperCase();
    }
    return "U";
  }

  const navItemsToRender = React.useMemo(() => {
    let items = [...baseNavItems];
    if (userAppRole === 'owner' || userAppRole === 'admin') {
      items.push(...adminAndOwnerNavItems);
    }
    if (userAppRole === 'owner') {
      items.push(...ownerOnlyNavItems);
    }
    items.push(...publicNavItems); 
    
    const uniqueItems = items.filter((item, index, self) =>
      index === self.findIndex((t) => t.href === item.href)
    );
    return uniqueItems;
  }, [userAppRole]);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {authSessionLoading ? (
              <>
                {[...Array(6)].map((_, i) => <SidebarMenuSkeleton key={`skel-nav-${i}`} showIcon />)}
              </>
            ) : navItemsToRender.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                    tooltip={item.tooltip}
                    className={cn(
                      "justify-start",
                      (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          {authSessionLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : loggedInUser ? (
            <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-sidebar-accent/50" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          ) : (
            <Link href="/auth/login" legacyBehavior passHref>
              <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-sidebar-accent/50">
                <LogIn className="h-5 w-5" />
                <span>Login</span>
              </Button>
            </Link>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
          <div className="flex-1">
            {/* Breadcrumbs or page title could go here */}
          </div>
          <ThemeToggleButton />
          {authSessionLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : loggedInUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={loggedInUser.photoURL || `https://placehold.co/40x40.png?text=${getAvatarFallback()}`} alt={loggedInUser.displayName || loggedInUser.email || "User Avatar"} data-ai-hint="user avatar"/>
                    <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {loggedInUser.displayName || loggedInUser.email || "My Account"}
                </DropdownMenuLabel>
                {userAppRole && <DropdownMenuLabel className="text-xs text-muted-foreground -mt-2 capitalize">Role: {userAppRole}</DropdownMenuLabel> }
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
             <Link href="/auth/login" legacyBehavior passHref>
                <Button variant="outline">
                  <LogIn className="mr-2 h-4 w-4" /> Sign In
                </Button>
             </Link>
          )}
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
