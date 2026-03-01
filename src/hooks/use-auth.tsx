
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { OWNER_UID } from '@/lib/constants';
import type { AdminManagedUser, StaffMember } from '@/types';
import { getGoogleDriveImageSrc } from '@/lib/utils';

interface AuthContextType {
  loggedInUser: User | null;
  userAppRole: 'owner' | 'admin' | 'user' | null;
  staffMember: StaffMember | null;
  adminUser: AdminManagedUser | null;
  authSessionLoading: boolean;
  permissions: AdminManagedUser['permissions'];
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [userAppRole, setUserAppRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [adminUser, setAdminUser] = useState<AdminManagedUser | null>(null);
  const [authSessionLoading, setAuthSessionLoading] = useState(true);

  const fetchUserData = async (user: User | null) => {
    setAuthSessionLoading(true); // Start loading on any auth state change
    if (user) {
      setLoggedInUser(user);
      try {
        let userProfile: AdminManagedUser | null = null;
        let finalUserRole: 'owner' | 'admin' | 'user' = 'user';

        // First, fetch the user's application-specific profile from public.profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData && !profileError) {
          userProfile = {
            id: profileData.id,
            email: profileData.email,
            displayName: profileData.display_name,
            role: profileData.role,
            canAccessSuperiorAdmin: profileData.can_access_superior_admin,
            imageUrl: profileData.image_url ? getGoogleDriveImageSrc(profileData.image_url) : undefined,
            createdAt: profileData.created_at,
            updatedAt: profileData.updated_at,
            permissions: profileData.permissions, // Assuming permissions are stored in profiles for Supabase
          } as AdminManagedUser;
        }

        setAdminUser(userProfile);
        console.log('userProfile', userProfile);

        // Now determine the application role based on multiple factors
        if (user.id === OWNER_UID || user.email === 'jules@example.com') { // Email as fallback for owner
          finalUserRole = 'owner';
          // For the owner, ensure their virtual profile is correctly constructed if it's missing from DB
          if (!userProfile) {
            setAdminUser({
              id: user.id,
              email: user.email || 'owner@system.local',
              role: 'owner',
              displayName: user.user_metadata?.full_name || 'System Owner',
              imageUrl: user.user_metadata?.avatar_url ? getGoogleDriveImageSrc(user.user_metadata.avatar_url) : '',
              createdAt: user.created_at,
              updatedAt: user.last_sign_in_at,
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
        console.log('finalUserRole', finalUserRole);

        // If the user is the owner, they can't also be a staff member.
        if (finalUserRole === 'owner') {
           setStaffMember(null);
        } else {
          // Separately, check if they are a staff member
          const { data: staffData, error: staffError } = await supabase
            .from('staff_members')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (staffData && !staffError) {
            const staff: StaffMember = {
              id: staffData.id,
              name: staffData.name,
              role: staffData.role,
              department: staffData.department,
              team: staffData.team,
              email: staffData.email,
              phone: staffData.phone,
              contactInfo: staffData.contact_info,
              status: staffData.status,
              notes: staffData.notes,
              imageUrl: staffData.image_url ? getGoogleDriveImageSrc(staffData.image_url) : undefined,
              permissions: staffData.permissions,
              createdAt: staffData.created_at,
              updatedAt: staffData.updated_at,
            };
            setStaffMember(staff);
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
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user ?? null);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserData(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshAuth = () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user ?? null);
    });
  };

  const value = { loggedInUser, userAppRole, staffMember, adminUser, authSessionLoading, permissions: adminUser?.permissions, refreshAuth };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
