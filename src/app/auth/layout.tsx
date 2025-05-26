
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication - MUN Tracker',
  description: 'Login or manage your account.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
      {children}
    </div>
  );
}
