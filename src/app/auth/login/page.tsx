'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth'; // User type not directly needed here
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/shared/Logo';
import { AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function LoginPageInternal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorTitle, setErrorTitle] = React.useState<string>('Login Error'); // Made errorTitle a state variable
  const [isGenericError, setIsGenericError] = React.useState(false);

  const ownerContactInfo = "If the problem persists, please contact the owner: baraa.elmallah@gmail.com or +961 76 791 088.";

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsGenericError(false);
    let currentErrorTitle = 'Login Error'; // Local variable for this scope

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back! Redirecting to dashboard...',
      });
      router.push(redirect || '/');
    } catch (e: any) {
      let errorMessage = 'An unexpected error occurred during login. Please try again.';

      if (e && typeof e.code === 'string') { // Check if it's a Firebase-like error with a code
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-email', 'auth/user-disabled', 'auth/too-many-requests'].includes(e.code)) {
          console.warn(`Firebase Auth Rejected Login (${e.code}): ${e.message}. Email attempted: ${email}`);
        } else {
          console.error(`Firebase Auth Error (${e.code}): ${e.message}. Email attempted: ${email}`, e);
          setIsGenericError(true); // Mark as generic for other Firebase errors
        }

        switch (e.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential': 
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            currentErrorTitle = 'Login Error';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address you entered is not valid. Please check the format.';
            currentErrorTitle = 'Invalid Email';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This user account has been disabled. Please contact an administrator.';
            currentErrorTitle = 'Account Disabled';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Access to this account has been temporarily disabled due to many failed login attempts. You can try again later or reset your password.';
            currentErrorTitle = 'Too Many Attempts';
            break;
          default:
            errorMessage = `Login failed. Please try again. (Error code: ${e.code})`;
            currentErrorTitle = 'Login Error';
            setIsGenericError(true); // Also generic for unhandled codes
        }
      } else {
        console.error('An unexpected login error occurred:', e);
        currentErrorTitle = 'Unexpected Error';
        setIsGenericError(true);
      }

      setError(errorMessage); 
      setErrorTitle(currentErrorTitle); // Set the state for errorTitle
      toast({
        title: currentErrorTitle,
        description: isGenericError ? `${errorMessage} ${ownerContactInfo}` : errorMessage,
        variant: 'destructive',
        duration: isGenericError ? 10000 : 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl border-t-4 border-primary">
      <CardHeader className="text-center pt-8">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight">Admin Portal Access</CardTitle>
        <CardDescription className="text-md text-muted-foreground">
          Sign in to manage MUN attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-8">
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-destructive/10">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-semibold">{errorTitle}</AlertTitle>
              <AlertDescription>
                {error}
                {isGenericError && (
                  <p className="mt-2 text-xs">{ownerContactInfo}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="py-3 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="py-3 text-base"
            />
          </div>
          <Button type="submit" className="w-full py-3 text-base font-semibold" disabled={isLoading} size="lg">
            {isLoading ? (
              'Authenticating...'
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" /> Secure Login
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col items-center gap-3 pb-8 text-sm">
        <p className="text-muted-foreground">
          No admin account? Contact the superior administrator.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          View public attendance data <Link href="/public" className="font-medium text-primary hover:underline">here</Link> (no login required).
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageInternal />
    </Suspense>
  );
}