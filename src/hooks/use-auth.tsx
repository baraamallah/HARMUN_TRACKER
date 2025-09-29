
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
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
          if (user.uid === OWNER_UID) {
            setUserAppRole('owner');
            // For the owner, we create a virtual adminUser object, but also try to load their profile from the DB.
            let ownerProfile: AdminManagedUser | null = null;
            try {
              const userDocSnap = await getDoc(doc(db, 'users', user.uid));
              if (userDocSnap.exists()) {
                ownerProfile = userDocSnap.data() as AdminManagedUser;
              }
            } catch (e) {
              console.error("Could not fetch owner's user document, will proceed without it.", e);
            }
            
            // Construct the definitive owner user object for the app to use.
            setAdminUser({
              id: user.uid,
              email: user.email || 'owner@system.local',
              role: 'owner',
              // Use displayName from DB if it exists, otherwise from Firebase Auth, else a default.
              displayName: ownerProfile?.displayName || user.displayName || 'System Owner',
              // Use avatarUrl from DB if it exists, otherwise from Firebase Auth, else empty.
              avatarUrl: ownerProfile?.avatarUrl ? getGoogleDriveImageSrc(ownerProfile.avatarUrl) : (user.photoURL ? getGoogleDriveImageSrc(user.photoURL) : ''),
              createdAt: ownerProfile?.createdAt || user.metadata.creationTime,
              updatedAt: ownerProfile?.updatedAt || user.metadata.lastSignInTime,
            });

            // Owner cannot be a staff member.
            setStaffMember(null);

          } else {
            // This is a regular user (could be admin, staff, or just user)
            let finalUserRole: 'admin' | 'user' = 'user';
            
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              const userData = userDocSnap.data() as AdminManagedUser;
              if (userData.avatarUrl) {
                userData.avatarUrl = getGoogleDriveImageSrc(userData.avatarUrl);
              }
              setAdminUser(userData); // Set their application user profile
              if (userData.role === 'admin') {
                finalUserRole = 'admin';
              }
            } else {
              setAdminUser(null); // No specific app profile for this user
            }
            setUserAppRole(finalUserRole);

            // Separately, check if they are also a staff member
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
