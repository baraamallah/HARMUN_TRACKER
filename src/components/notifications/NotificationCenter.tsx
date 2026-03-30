'use client';

import * as React from 'react';
import { Bell, X, Trash2, Clock, AlertTriangle, Info, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { logUserAction } from '@/lib/logging';
import type { RestroomAlert } from '@/hooks/use-restroom-alerts';
import type { UserRole, NotificationPreferences } from '@/types';

interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'security';
  title: string;
  message: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  alerts: RestroomAlert[];
  systemNotifications?: SystemNotification[];
  onMarkBack: (participantId: string) => void;
  userRole?: UserRole;
  permissions?: {
    canReceiveNotifications?: boolean;
    canAccessLogs?: boolean;
    canViewSystemStatus?: boolean;
  };
  notificationPreferences?: NotificationPreferences;
}

// Restroom icon as SVG since Lucide doesn't have one
function RestroomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      <path d="M7 8h4l-1 6H8l-1-6Z" />
      <path d="M13 8h2l2 4-1 2" />
      <path d="M16 10h2" />
      <path d="M9 14v6" />
      <path d="M11 14v6" />
    </svg>
  );
}

export function NotificationCenter({ 
  alerts, 
  systemNotifications = [], 
  onMarkBack, 
  userRole,
  permissions,
  notificationPreferences 
}: NotificationCenterProps) {
  const { userAppRole, permissions: authPermissions } = useAuth();
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [systemDismissed, setSystemDismissed] = React.useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('restroom');

  // Use auth context if props are not provided
  const effectiveRole = userRole || userAppRole;
  const effectivePermissions = permissions || authPermissions;
  
  // Check if user can access notifications
  const canAccessNotifications = React.useMemo(() => {
    if (effectiveRole === 'owner') return true;
    if (effectiveRole === 'admin' && effectivePermissions?.canReceiveNotifications) return true;
    if (effectiveRole === 'session_manager' && effectivePermissions?.canReceiveNotifications) return true;
    return false;
  }, [effectiveRole, effectivePermissions]);

  // Filter notifications based on user preferences
  const visibleAlerts = React.useMemo(() => {
    if (!canAccessNotifications) return [];
    const filtered = alerts.filter(a => !dismissed.has(a.participantId));
    if (notificationPreferences?.restroomAlerts === false) return [];
    return filtered;
  }, [alerts, dismissed, canAccessNotifications, notificationPreferences]);

  const visibleSystemNotifications = React.useMemo(() => {
    if (!canAccessNotifications) return [];
    return systemNotifications.filter(n => {
      if (systemDismissed.has(n.id)) return false;
      if (notificationPreferences) {
        if (n.type === 'info' && !notificationPreferences.systemNotifications) return false;
        if (n.type === 'error' && !notificationPreferences.errorNotifications) return false;
        if (n.type === 'security' && !notificationPreferences.securityAlerts) return false;
      }
      return true;
    });
  }, [systemNotifications, systemDismissed, canAccessNotifications, notificationPreferences]);

  const totalCount = visibleAlerts.length + visibleSystemNotifications.length;
  const urgentCount = visibleSystemNotifications.filter(n => n.type === 'error' || n.type === 'security').length;

  const handleDismiss = React.useCallback(async (id: string, type: 'restroom' | 'system' = 'restroom') => {
    if (type === 'restroom') {
      setDismissed(prev => new Set([...prev, id]));
      await logUserAction('dismiss_restroom_alert', 'notification', id);
    } else {
      setSystemDismissed(prev => new Set([...prev, id]));
      await logUserAction('dismiss_system_notification', 'notification', id);
    }
  }, []);

  const handleClearAll = React.useCallback(async (type: 'restroom' | 'system' | 'all' = 'all') => {
    if (type === 'restroom' || type === 'all') {
      setDismissed(new Set(alerts.map(a => a.participantId)));
      await logUserAction('clear_all_restroom_alerts', 'notification');
    }
    if (type === 'system' || type === 'all') {
      setSystemDismissed(new Set(systemNotifications.map(n => n.id)));
      await logUserAction('clear_all_system_notifications', 'notification');
    }
  }, [alerts, systemNotifications]);

  // Re-show if a previously dismissed alert gets more severe or if new ones appear
  React.useEffect(() => {
    setDismissed(prev => {
      const currentIds = new Set(alerts.map(a => a.participantId));
      // Remove dismissed entries that are no longer in alerts (they returned)
      const cleaned = new Set([...prev].filter(id => currentIds.has(id)));
      return cleaned;
    });
  }, [alerts]);

  // Don't render if user doesn't have permission
  if (!canAccessNotifications) {
    return null;
  }

  const handleMarkBack = async (participantId: string) => {
    await onMarkBack(participantId);
    await logUserAction('mark_participant_back', 'participant', participantId);
    handleDismiss(participantId, 'restroom');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 sm:h-9 sm:w-9"
          aria-label={`Notifications${totalCount > 0 ? ` (${totalCount} total)` : ''}`}
        >
          <Bell className="h-6 w-6 sm:h-5 sm:w-5" />
          {totalCount > 0 && (
            <span className={cn(
              "absolute top-0 right-0 flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background",
              urgentCount > 0 ? "bg-red-500 animate-pulse" : "bg-amber-500"
            )}>
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1rem)] sm:w-96 p-0 shadow-2xl border-2">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Notifications</span>
            {totalCount > 0 && (
              <Badge variant={urgentCount > 0 ? "destructive" : "secondary"} className="h-5 px-1.5 text-[10px]">
                {totalCount}
              </Badge>
            )}
            {effectiveRole === 'owner' && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                <Shield className="h-2 w-2 mr-0.5" />Owner
              </Badge>
            )}
          </div>
          {totalCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => handleClearAll('all')}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        {/* Tabbed Content */}
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/60 mt-1">All systems are running normally</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
              {visibleAlerts.length > 0 && (
                <TabsTrigger 
                  value="restroom" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-3 py-2"
                >
                  <RestroomIcon className="h-3 w-3 mr-1" />
                  Restroom ({visibleAlerts.length})
                </TabsTrigger>
              )}
              {visibleSystemNotifications.length > 0 && (
                <TabsTrigger 
                  value="system" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-3 py-2"
                >
                  {urgentCount > 0 ? (
                    <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
                  ) : (
                    <Info className="h-3 w-3 mr-1" />
                  )}
                  System ({visibleSystemNotifications.length})
                </TabsTrigger>
              )}
            </TabsList>
            
            {visibleAlerts.length > 0 && (
              <TabsContent value="restroom" className="mt-0">
                <ScrollArea className="max-h-80">
                  <div className="divide-y">
                    {visibleAlerts.map(alert => (
                      <div
                        key={alert.participantId}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <RestroomIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{alert.participantName}</p>
                          <p className="text-xs text-muted-foreground truncate">{alert.committee}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-red-500" />
                            <span className="text-xs font-medium text-red-500">{alert.elapsedLabel}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs w-full border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-500/10"
                            onClick={() => handleMarkBack(alert.participantId)}
                          >
                            ✓ Mark as Back
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground -mt-0.5 -mr-1"
                          onClick={() => handleDismiss(alert.participantId, 'restroom')}
                          title="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
            
            {visibleSystemNotifications.length > 0 && (
              <TabsContent value="system" className="mt-0">
                <ScrollArea className="max-h-80">
                  <div className="divide-y">
                    {visibleSystemNotifications.map(notification => {
                      const getNotificationIcon = () => {
                        switch (notification.type) {
                          case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
                          case 'security': return <Shield className="h-4 w-4 text-red-600" />;
                          case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
                          default: return <Info className="h-4 w-4 text-blue-500" />;
                        }
                      };
                      
                      const getBgColor = () => {
                        switch (notification.type) {
                          case 'error': return 'bg-red-100 dark:bg-red-900/30';
                          case 'security': return 'bg-red-100 dark:bg-red-900/30';
                          case 'warning': return 'bg-amber-100 dark:bg-amber-900/30';
                          default: return 'bg-blue-100 dark:bg-blue-900/30';
                        }
                      };
                      
                      return (
                        <div
                          key={notification.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`h-8 w-8 rounded-full ${getBgColor()} flex items-center justify-center`}>
                              {getNotificationIcon()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{notification.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {notification.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground -mt-0.5 -mr-1"
                            onClick={() => handleDismiss(notification.id, 'system')}
                            title="Dismiss"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}
