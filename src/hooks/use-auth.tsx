
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { OWNER_UID } from '@/lib/constants';
import type { AdminManagedUser, StaffMember } from '@/types';

interface AuthContextType {
  loggedInUser: User | null;
  userAppRole: 'owner' | 'admin' | 'user' | null;
  staffMember: StaffMember | null;
  adminUser: AdminManagedUser | null;
  authSessionLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [userAppRole, setUserAppRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [adminUser, setAdminUser] = useState<AdminManagedUser | null>(null);
  const [authSessionLoading, setAuthSessionLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoggedInUser(user);
      if (user) {
        if (user.uid === OWNER_UID) {
          setUserAppRole('owner');
          setAuthSessionLoading(false);
        } else {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data() as AdminManagedUser;
              setAdminUser(userData);
              if (userData.role === 'admin') {
                setUserAppRole('admin');
              } else {
                setUserAppRole('user');
              }
            } else {
              setUserAppRole('user');
              setAdminUser(null);
            }

            const staffDocRef = doc(db, 'staff_members', user.uid);
            const staffDocSnap = await getDoc(staffDocRef);
            if (staffDocSnap.exists()) {
              setStaffMember(staffDocSnap.data() as StaffMember);
            }

          } catch (error) {
            console.error("Error fetching user role and data:", error);
            setUserAppRole('user');
          } finally {
            setAuthSessionLoading(false);
          }
        }
      } else {
        setUserAppRole(null);
        setStaffMember(null);
        setAdminUser(null);
        setAuthSessionLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = { loggedInUser, userAppRole, staffMember, adminUser, authSessionLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
