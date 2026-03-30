
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { OWNER_UID } from '@/lib/constants';
import { logger, logAuthentication, logError, logUserAction } from '@/lib/logging';
import type { AdminManagedUser, StaffMember, UserRole } from '@/types';
import { getGoogleDriveImageSrc } from '@/lib/utils';

interface AuthContextType {
  loggedInUser: User | null;
  userAppRole: UserRole | null;
  staffMember: StaffMember | null;
  adminUser: AdminManagedUser | null;
  authSessionLoading: boolean;
  permissions: AdminManagedUser['permissions'];
  sessionState: AdminManagedUser['sessionState'];
  refreshAuth: () => void;
  updateSessionActivity: () => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [userAppRole, setUserAppRole] = useState<UserRole | null>(null);
  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [adminUser, setAdminUser] = useState<AdminManagedUser | null>(null);
  const [authSessionLoading, setAuthSessionLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const updateSessionActivity = async () => {
    if (!loggedInUser || !adminUser) return;
    
    try {
      const userDocRef = doc(db, 'users', loggedInUser.uid);
      await updateDoc(userDocRef, {
        'sessionState.lastActivity': serverTimestamp(),
        'sessionState.isActive': true,
        updatedAt: serverTimestamp()
      });
      await logUserAction('session_activity_update', 'session', sessionId || undefined);
    } catch (error) {
      await logError('Failed to update session activity', error);
    }
  };

  const clearSession = async () => {
    if (!loggedInUser) return;
    
    try {
      const userDocRef = doc(db, 'users', loggedInUser.uid);
      await updateDoc(userDocRef, {
        'sessionState.isActive': false,
        'sessionState.currentSession': null,
        updatedAt: serverTimestamp()
      });
      setSessionId(null);
      await logUserAction('session_cleared', 'session');
    } catch (error) {
      await logError('Failed to clear session', error);
    }
  };

  const fetchUserData = async (user: User | null) => {
    setAuthSessionLoading(true); // Start loading on any auth state change
    if (user) {
      setLoggedInUser(user);
      
      // Initialize logging for this user
      logger.setUserInfo(user.uid, user.email || 'unknown', 'user');
      
      try {
        let userProfile: AdminManagedUser | null = null;
        let finalUserRole: UserRole = 'user';
        const currentSessionId = generateSessionId();
        setSessionId(currentSessionId);

        // First, fetch the user's application-specific profile from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          userProfile = { ...userDocSnap.data(), id: userDocSnap.id } as AdminManagedUser;
          if (userProfile.imageUrl) {
            userProfile.imageUrl = getGoogleDriveImageSrc(userProfile.imageUrl);
          }
          
          // Initialize or update session state
          if (!userProfile.sessionState) {
            userProfile.sessionState = {
              lastActivity: serverTimestamp(),
              currentSession: currentSessionId,
              isActive: true,
              preferences: {}
            };
          } else {
            userProfile.sessionState.lastActivity = serverTimestamp();
            userProfile.sessionState.currentSession = currentSessionId;
            userProfile.sessionState.isActive = true;
          }
          
          // Update session state in database
          await updateDoc(userDocRef, {
            sessionState: userProfile.sessionState,
            updatedAt: serverTimestamp()
          });
        }
        setAdminUser(userProfile);
        console.log('userProfile', userProfile);

        // Now determine the application role based on multiple factors
        if (user.uid === OWNER_UID) {
          finalUserRole = 'owner';
          // For the owner, ensure their virtual profile is correctly constructed if it's missing from DB
          if (!userProfile) {
            const ownerProfile: AdminManagedUser = {
              id: user.uid,
              email: user.email || 'owner@system.local',
              role: 'owner',
              displayName: user.displayName || 'System Owner',
              imageUrl: user.photoURL ? getGoogleDriveImageSrc(user.photoURL) : '',
              createdAt: user.metadata.creationTime,
              updatedAt: user.metadata.lastSignInTime,
              canAccessSuperiorAdmin: true,
              sessionState: {
                lastActivity: serverTimestamp(),
                currentSession: currentSessionId,
                isActive: true,
                preferences: {}
              },
              permissions: {
                canEditParticipants: true,
                canDeleteParticipants: true,
                canCreateStaff: true,
                canEditStaff: true,
                canDeleteStaff: true,
                canAccessAnalytics: true,
                canManageQRCodes: true,
                canReceiveNotifications: true,
                canAccessLogs: true,
                canExportData: true,
                canManageSessions: true,
                canViewSystemStatus: true,
              }
            };
            setAdminUser(ownerProfile);
          }
        } else if (userProfile?.role === 'admin') {
          finalUserRole = 'admin';
          // An admin can be elevated to 'owner' role if they have the flag
          if (userProfile.canAccessSuperiorAdmin) {
            finalUserRole = 'owner';
          }
          // Ensure admin has default permissions if not set
          if (!userProfile.permissions) {
            userProfile.permissions = {
              canEditParticipants: true,
              canDeleteParticipants: false,
              canCreateStaff: true,
              canEditStaff: true,
              canDeleteStaff: false,
              canAccessAnalytics: true,
              canManageQRCodes: true,
              canReceiveNotifications: true,
              canAccessLogs: false,
              canExportData: true,
              canManageSessions: false,
              canViewSystemStatus: true,
            };
          }
        } else if (userProfile?.role === 'session_manager') {
          finalUserRole = 'session_manager';
          // Ensure session manager has appropriate permissions and stability
          if (!userProfile.permissions) {
            userProfile.permissions = {
              canEditParticipants: true,
              canDeleteParticipants: false,
              canCreateStaff: false,
              canEditStaff: false,
              canDeleteStaff: false,
              canAccessAnalytics: false,
              canManageQRCodes: false,
              canReceiveNotifications: true,
              canAccessLogs: false,
              canExportData: false,
              canManageSessions: true,
              canViewSystemStatus: false,
            };
          }
          // Ensure session manager has proper session management capabilities
          if (!userProfile.sessionState) {
            userProfile.sessionState = {
              lastActivity: serverTimestamp(),
              currentSession: currentSessionId,
              isActive: true,
              preferences: {
                autoRefresh: true,
                sessionTimeout: 30 * 60 * 1000, // 30 minutes
                enableNotifications: true
              }
            };
          }
        }
        
        // Update logging with correct role
        logger.setUserInfo(user.uid, user.email || 'unknown', finalUserRole);
        setUserAppRole(finalUserRole);
        console.log('finalUserRole', finalUserRole);
        
        // Log successful authentication
        await logAuthentication('login', true, { 
          role: finalUserRole, 
          hasProfile: !!userProfile,
          sessionId: currentSessionId 
        });

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
        await logError('Critical error during user authentication', error, { userId: user?.uid });
        await logAuthentication('login', false, { error: String(error) });
        
        // Reset to a known safe state on error
        setUserAppRole('user');
        setAdminUser(null);
        setStaffMember(null);
        logger.clearUserInfo();
      } finally {
        setAuthSessionLoading(false);
      }
    } else {
      // User is logged out
      if (loggedInUser) {
        await logAuthentication('logout', true);
        await clearSession();
      }
      
      setLoggedInUser(null);
      setUserAppRole(null);
      setStaffMember(null);
      setAdminUser(null);
      setSessionId(null);
      setAuthSessionLoading(false);
      logger.clearUserInfo();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, fetchUserData);
    return () => unsubscribe();
  }, []);

  const refreshAuth = () => {
    const user = auth.currentUser;
    fetchUserData(user);
  };

  // Set up session activity monitoring for session managers
  React.useEffect(() => {
    if (userAppRole === 'session_manager' && adminUser?.sessionState?.isActive) {
      const interval = setInterval(() => {
        updateSessionActivity();
      }, 5 * 60 * 1000); // Update every 5 minutes
      
      return () => clearInterval(interval);
    }
  }, [userAppRole, adminUser?.sessionState?.isActive]);

  const value = { 
    loggedInUser, 
    userAppRole, 
    staffMember, 
    adminUser, 
    authSessionLoading, 
    permissions: adminUser?.permissions, 
    sessionState: adminUser?.sessionState,
    refreshAuth,
    updateSessionActivity,
    clearSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
