
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { OWNER_UID } from '@/lib/constants';
import type { AdminManagedUser, StaffMember } from '@/types';
import { getGoogleDriveImageSrc } from '@/lib/utils';

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
      setAuthSessionLoading(true); // Start loading on any auth state change
      if (user) {
        setLoggedInUser(user);
        try {
          let userProfile: AdminManagedUser | null = null;
          let finalUserRole: 'owner' | 'admin' | 'user' = 'user';

          // First, fetch the user's application-specific profile from Firestore
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            userProfile = userDocSnap.data() as AdminManagedUser;
            if (userProfile.avatarUrl) {
              userProfile.avatarUrl = getGoogleDriveImageSrc(userProfile.avatarUrl);
            }
          }
          setAdminUser(userProfile);

          // Now determine the application role based on multiple factors
          if (user.uid === OWNER_UID) {
            finalUserRole = 'owner';
            // For the owner, ensure their virtual profile is correctly constructed if it's missing from DB
            if (!userProfile) {
              setAdminUser({
                id: user.uid,
                email: user.email || 'owner@system.local',
                role: 'owner',
                displayName: user.displayName || 'System Owner',
                avatarUrl: user.photoURL ? getGoogleDriveImageSrc(user.photoURL) : '',
                createdAt: user.metadata.creationTime,
                updatedAt: user.metadata.lastSignInTime,
                canAccessSuperiorAdmin: true,
              });
            }
          } else if (userProfile?.role === 'admin') {
            finalUserRole = 'admin';
            // An admin can be elevated to 'owner' role if they have the flag
            if (userProfile.canAccessSuperiorAdmin) {
              finalUserRole = 'owner';
            }
          }
          
          setUserAppRole(finalUserRole);

          // If the user is the owner, they can't also be a staff member.
          if (finalUserRole === 'owner') {
             setStaffMember(null);
          } else {
            // Separately, check if they are a staff member
            const staffDocRef = doc(db, 'staff_members', user.uid);
            const staffDocSnap = await getDoc(staffDocRef);
            if (staffDocSnap.exists()) {
              const staffData = staffDocSnap.data() as StaffMember;
              if (staffData.imageUrl) {
                staffData.imageUrl = getGoogleDriveImageSrc(staffData.imageUrl);
              }
              setStaffMember(staffData);
            } else {
              setStaffMember(null);
            }
          }
        } catch (error) {
          console.error("Critical error during user data fetch:", error);
          // Reset to a known safe state on error
          setUserAppRole('user');
          setAdminUser(null);
          setStaffMember(null);
        } finally {
          setAuthSessionLoading(false);
        }
      } else {
        // User is logged out
        setLoggedInUser(null);
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
