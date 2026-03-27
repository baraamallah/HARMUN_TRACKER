'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ClientRedirect() {
  const { userAppRole, authSessionLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authSessionLoading) {
      if (userAppRole === 'session_manager') {
        router.push('/in-session');
      }
    }
  }, [userAppRole, authSessionLoading, router]);

  return null;
}
