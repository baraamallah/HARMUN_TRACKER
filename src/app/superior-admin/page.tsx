
'use client';

import React, { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldAlert, LogOut, Settings, Users, DatabaseZap } from 'lucide-react'; // Added more icons

// IMPORTANT: THIS IS A HARDCODED PASSWORD FOR PROTOTYPING ONLY.
// For any real application, use a secure backend authentication system
// and store credentials safely (e.g., hashed passwords in a database, environment variables for secrets).
const SUPER_ADMIN_PASSWORD = 'superadmin123';

export default function SuperiorAdminPage() {
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginAttempt = (e: FormEvent) => {
    e.preventDefault();
    if (passwordInput === SUPER_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setErrorMessage('');
      setPasswordInput(''); // Clear password input after successful login
    } else {
      setErrorMessage('Incorrect password. Please try again.');
      setIsAuthenticated(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldAlert size={32} />
            </div>
            <CardTitle className="text-2xl font-bold">Superior Admin Access</CardTitle>
            <CardDescription>
              This area is restricted. Enter the password to proceed.
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                (Demo password: superadmin123)
              </p>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLoginAttempt} className="space-y-4">
              <div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="text-lg"
                  aria-label="Password for superior admin access"
                />
              </div>
              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
              <Button type="submit" className="w-full text-base py-3">
                Unlock Full Control
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
              Access to this panel is logged and monitored.
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background to-muted/50">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Superior Admin Dashboard
            </h1>
          </div>
          <Button variant="outline" onClick={handleLogout} size="lg">
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 p-6 bg-card border rounded-xl shadow-lg">
          <h2 className="text-3xl font-semibold mb-2 text-foreground">Welcome, Superior Administrator!</h2>
          <p className="text-lg text-muted-foreground">
            You have master control over the MUN Attendance Tracker system.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Global Data Management</CardTitle>
              <DatabaseZap className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View, edit, and manage all participant records, school lists, and committee structures.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary">Access Data Controls</Button>
            </CardFooter>
          </Card>

          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">System Settings</CardTitle>
              <Settings className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure application-wide settings, themes, and operational parameters.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary">Adjust System Settings</Button>
            </CardFooter>
          </Card>

          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Admin Account Management</CardTitle>
              <Users className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create, modify, and manage accounts for regular administrators.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary">Manage Admin Accounts</Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="mt-8 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
          <p className="font-medium text-destructive">
            Reminder: The current password protection is for demonstration only and is not secure for production use.
            Implement robust backend authentication before deployment.
          </p>
        </div>
      </main>

      <footer className="py-8 border-t mt-12 bg-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            MUN Tracker - Superior Administration Panel &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

