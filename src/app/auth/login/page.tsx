
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
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


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back! Redirecting to dashboard...',
      });
      router.push('/'); 
    } catch (e: any) {
      console.error('Login error:', e);
      let errorMessage = 'Failed to log in. Please check your credentials.';
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      setError(errorMessage);
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
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
              <AlertTitle className="font-semibold">Login Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
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
