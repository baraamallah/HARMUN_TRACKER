'use client';

import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { SystemLog, LogLevel, LogCategory, UserRole } from '@/types';

const LOGS_COLLECTION = 'system_logs';

class LoggingService {
  private sessionId: string;
  private userInfo: {
    userId?: string;
    userEmail?: string;
    userRole?: UserRole;
  } = {};

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupBrowserInfo();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupBrowserInfo() {
    if (typeof window !== 'undefined') {
      // Setup error handling
      window.addEventListener('error', (event) => {
        this.logError('Global Error', event.error, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });

      // Setup unhandled promise rejection handling
      window.addEventListener('unhandledrejection', (event) => {
        this.logError('Unhandled Promise Rejection', event.reason);
      });
    }
  }

  setUserInfo(userId: string, userEmail: string, userRole: UserRole) {
    this.userInfo = { userId, userEmail, userRole };
  }

  clearUserInfo() {
    this.userInfo = {};
  }

  private async createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any,
    action?: string,
    resourceType?: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Clean up undefined values to prevent Firestore errors
      const cleanObject = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(cleanObject);
        
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = cleanObject(value);
          }
        });
        return cleaned;
      };

      const logEntry: Omit<SystemLog, 'id'> = {
        timestamp: serverTimestamp(),
        level,
        category,
        message,
        ...(details !== undefined && { details: cleanObject(details) }),
        ...(this.userInfo.userId && { userId: this.userInfo.userId }),
        ...(this.userInfo.userEmail && { userEmail: this.userInfo.userEmail }),
        ...(this.userInfo.userRole && { userRole: this.userInfo.userRole }),
        ...(action && { action }),
        ...(resourceType && { resourceType }),
        ...(resourceId && { resourceId }),
        ...(this.sessionId && { sessionId: this.sessionId }),
        ...(metadata && { metadata: cleanObject(metadata) }),
      };

      // Only add ipAddress and userAgent if they have values
      const ipAddress = await this.getClientIP();
      if (ipAddress && ipAddress !== 'unknown') {
        logEntry.ipAddress = ipAddress;
      }
      
      if (typeof window !== 'undefined' && window.navigator.userAgent) {
        logEntry.userAgent = window.navigator.userAgent;
      }

      await addDoc(collection(db, LOGS_COLLECTION), logEntry);
    } catch (error) {
      console.error('Failed to create log entry:', error);
      // Don't throw to prevent logging from breaking the application
    }
  }

  private async getClientIP(): Promise<string | undefined> {
    if (typeof window === 'undefined') return undefined;
    
    // Skip IP detection in development to avoid external API calls
    if (process.env.NODE_ENV === 'development') {
      return 'localhost';
    }
    
    try {
      // Use a more reliable IP detection service in production
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('IP API failed');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      console.debug('IP detection failed:', error);
      return 'unknown';
    }
  }

  // Public logging methods
  async logInfo(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    await this.createLogEntry('info', 'system_event', message, details, undefined, undefined, undefined, metadata);
  }

  async logWarning(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    await this.createLogEntry('warning', 'system_event', message, details, undefined, undefined, undefined, metadata);
  }

  async logError(message: string, error?: any, metadata?: Record<string, any>): Promise<void> {
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    
    await this.createLogEntry('error', 'error', message, errorDetails, undefined, undefined, undefined, metadata);
  }

  async logDebug(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      await this.createLogEntry('debug', 'system_event', message, details, undefined, undefined, undefined, metadata);
    }
  }

  async logAuthentication(action: string, success: boolean, details?: any): Promise<void> {
    await this.createLogEntry(
      success ? 'info' : 'warning',
      'authentication',
      `Authentication ${action}: ${success ? 'Success' : 'Failed'}`,
      details,
      action,
      'user',
      this.userInfo.userId
    );
  }

  async logUserAction(action: string, resourceType?: string, resourceId?: string, details?: any): Promise<void> {
    await this.createLogEntry(
      'info',
      'user_action',
      `User action: ${action}`,
      details,
      action,
      resourceType,
      resourceId
    );
  }

  async logDataChange(action: string, resourceType: string, resourceId: string, oldData?: any, newData?: any): Promise<void> {
    await this.createLogEntry(
      'info',
      'data_change',
      `Data change: ${action} ${resourceType}`,
      { oldData, newData, resourceId },
      action,
      resourceType,
      resourceId
    );
  }

  async logSecurityEvent(message: string, details?: any, severity: 'info' | 'warning' | 'error' = 'warning'): Promise<void> {
    await this.createLogEntry(severity, 'security', message, details);
  }

  // Query methods for the /log page
  async getLogs(filters?: {
    level?: LogLevel;
    category?: LogCategory;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SystemLog[]> {
    try {
      let q = collection(db, LOGS_COLLECTION);
      const queryConstraints = [];

      if (filters?.level) {
        queryConstraints.push(where('level', '==', filters.level));
      }
      if (filters?.category) {
        queryConstraints.push(where('category', '==', filters.category));
      }
      if (filters?.userId) {
        queryConstraints.push(where('userId', '==', filters.userId));
      }
      if (filters?.startDate) {
        queryConstraints.push(where('timestamp', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters?.endDate) {
        queryConstraints.push(where('timestamp', '<=', Timestamp.fromDate(filters.endDate)));
      }

      queryConstraints.push(orderBy('timestamp', 'desc'));
      queryConstraints.push(limit(filters?.limit || 100));

      const queryRef = query(q, ...queryConstraints);
      const snapshot = await getDocs(queryRef);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp instanceof Timestamp 
          ? doc.data().timestamp.toDate().toISOString()
          : doc.data().timestamp
      })) as SystemLog[];
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      return [];
    }
  }

  async getRecentErrors(limitCount: number = 50): Promise<SystemLog[]> {
    return this.getLogs({ level: 'error', limit: limitCount });
  }

  async getUserActivity(userId: string, limitCount: number = 50): Promise<SystemLog[]> {
    return this.getLogs({ userId, category: 'user_action', limit: limitCount });
  }

  async getSystemEvents(limitCount: number = 50): Promise<SystemLog[]> {
    return this.getLogs({ category: 'system_event', limit: limitCount });
  }
}

// Export singleton instance
export const logger = new LoggingService();

// Export convenience functions
export const logInfo = (message: string, details?: any, metadata?: Record<string, any>) => 
  logger.logInfo(message, details, metadata);

export const logWarning = (message: string, details?: any, metadata?: Record<string, any>) => 
  logger.logWarning(message, details, metadata);

export const logError = (message: string, error?: any, metadata?: Record<string, any>) => 
  logger.logError(message, error, metadata);

export const logDebug = (message: string, details?: any, metadata?: Record<string, any>) => 
  logger.logDebug(message, details, metadata);

export const logAuthentication = (action: string, success: boolean, details?: any) =>
  logger.logAuthentication(action, success, details);

export const logUserAction = (action: string, resourceType?: string, resourceId?: string, details?: any) =>
  logger.logUserAction(action, resourceType, resourceId, details);

export const logDataChange = (action: string, resourceType: string, resourceId: string, oldData?: any, newData?: any) =>
  logger.logDataChange(action, resourceType, resourceId, oldData, newData);

export const logSecurityEvent = (message: string, details?: any, severity: 'info' | 'warning' | 'error' = 'warning') =>
  logger.logSecurityEvent(message, details, severity);