
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Eye,
  LogOut,
  UserCircle,
  LogIn,
  SettingsIcon, 
  UserCog, 
  ShieldCheck, 
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
import { auth } from '@/lib/firebase'; 
import { onAuthStateChanged, signOut, User } from 'firebase/auth'; 
import { OWNER_UID } from '@/lib/constants'; 

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  tooltip: string;
  ownerOnly?: boolean; 
}

const baseNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard', tooltip: 'Dashboard' },
  { href: '/public', icon: Eye, label: 'Public View', tooltip: 'Public View' },
];

const superiorAdminNavItem: NavItem = {
  href: '/superior-admin',
  icon: ShieldCheck,
  label: 'Superior Admin',
  tooltip: 'Superior Admin Panel',
  ownerOnly: true,
};

export function AppLayoutClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loggedInUser, setLoggedInUser] = React.useState<User | null>(null);
  const [authSessionLoading, setAuthSessionLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoggedInUser(user);
      setAuthSessionLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // User state will be updated by onAuthStateChanged, which will trigger re-renders
      // Potentially redirect to login page after logout
      // router.push('/auth/login'); // if using useRouter
    } catch (error) {
      console.error("Error signing out: ", error);
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
    if (loggedInUser && loggedInUser.uid === OWNER_UID) {
      items.push(superiorAdminNavItem);
    }
    return items;
  }, [loggedInUser]);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItemsToRender.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.tooltip}
                    className={cn(
                      "justify-start",
                      pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground"
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
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          ) : (
            <Link href="/auth/login" legacyBehavior passHref>
              <Button variant="ghost" className="w-full justify-start gap-2">
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
            {/* Search bar can be re-added here if needed */}
          </div>
          <ThemeToggleButton />
          {authSessionLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : loggedInUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarImage src={loggedInUser.photoURL || `https://placehold.co/40x40.png?text=${getAvatarFallback()}`} alt={loggedInUser.displayName || loggedInUser.email || "User Avatar"} data-ai-hint="user avatar" />
                    <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {loggedInUser.displayName || loggedInUser.email || "My Account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled> 
                  <UserCog className="mr-2 h-4 w-4" /> Profile (Not Implemented)
                </DropdownMenuItem>
                <DropdownMenuItem disabled> 
                  <SettingsIcon className="mr-2 h-4 w-4" /> Settings (Not Implemented)
                </DropdownMenuItem>
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
