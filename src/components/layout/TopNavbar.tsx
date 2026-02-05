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
  QrCode,
  Clipboard,
  BarChart,
  User,
  Menu,
  Info
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
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  tooltip: string;
}

const baseNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard', tooltip: 'Participant Dashboard' },
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

const publicNavItems: NavItem[] = [
  { href: '/public', icon: Eye, label: 'Public View', tooltip: 'Public Participant View' },
  { href: '/about', icon: Info, label: 'About', tooltip: 'About HARMUN' },
];

export function TopNavbar() {
  const pathname = usePathname();
  const { toast } = useToast();
  const { loggedInUser, userAppRole, permissions, authSessionLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
    if (loggedInUser?.displayName) {
      return loggedInUser.displayName.substring(0, 2).toUpperCase();
    }
    if (loggedInUser?.email) {
      return loggedInUser.email.substring(0, 2).toUpperCase();
    }
    return "U";
  }

  const navItemsToRender = React.useMemo(() => {
    let items = [...baseNavItems];
    if (userAppRole === 'owner') {
      items.push(...adminNavItems);
      items.push(...ownerOnlyNavItems);
    } else if (userAppRole === 'admin') {
      if (permissions?.canManageQRCodes) {
        items.push(adminNavItems[0]);
      }
      if (permissions?.canAccessAnalytics) {
        items.push(adminNavItems[1]);
      }
    }
    items.push(...publicNavItems);

    const uniqueItems = items.filter((item, index, self) =>
      index === self.findIndex((t) => t.href === item.href)
    );
    return uniqueItems;
  }, [userAppRole, permissions]);

  const NavLinks = ({ isMobile = false }) => (
    <nav className={cn('items-center space-x-4', isMobile ? 'flex flex-col space-y-2 space-x-0' : 'hidden md:flex')}>
      {navItemsToRender.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center px-3 py-2 rounded-md text-sm font-medium',
            pathname === item.href
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          onClick={() => isMobile && setIsMobileMenuOpen(false)}
        >
          <item.icon className="h-5 w-5 mr-2" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Logo />
        </div>

        <div className="hidden md:flex items-center space-x-4">
          <NavLinks />
        </div>

        <div className="flex items-center space-x-2">
          <ThemeToggleButton />

          {authSessionLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : loggedInUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={loggedInUser.photoURL || undefined} alt={loggedInUser.displayName || loggedInUser.email || "User Avatar"} />
                    <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {loggedInUser.displayName || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {loggedInUser.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                {userAppRole && <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground -mt-1 capitalize">Role: {userAppRole}</DropdownMenuLabel>}
                <DropdownMenuSeparator />
                {userAppRole === 'owner' && (
                  <DropdownMenuItem asChild>
                    <Link href="/superior-admin/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/auth/login?redirect=${pathname}`}>
                <LogIn className="mr-2 h-4 w-4" />
                <span>Sign In</span>
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
                <div className="flex flex-col space-y-4 pt-6">
                  <NavLinks isMobile />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}