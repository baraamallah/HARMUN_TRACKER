'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { logger, logUserAction } from '@/lib/logging';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  Info, 
  Shield, 
  User, 
  Database, 
  Activity,
  Download,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  Eye,
  Settings,
  Trash2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemLog, LogLevel, LogCategory } from '@/types';

interface LogFilters {
  level?: LogLevel;
  category?: LogCategory;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
}

export default function LogPage() {
  const { userAppRole, permissions, authSessionLoading } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFilters>({ limit: 100 });
  const [activeTab, setActiveTab] = useState('recent');
  const [isLive, setIsLive] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearTimeframe, setClearTimeframe] = useState<string>('24h');
  
  // Check if user has permission to access logs
  const canAccessLogs = React.useMemo(() => {
    if (authSessionLoading) return false;
    if (userAppRole === 'owner') return true;
    if (userAppRole === 'admin' && permissions?.canAccessLogs) return true;
    return false;
  }, [userAppRole, permissions, authSessionLoading]);

  const fetchLogs = async (filterOverride?: LogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const currentFilters = { ...filters, ...filterOverride };
      const logData = await logger.getLogs(currentFilters);
      setLogs(logData);
      await logUserAction('view_system_logs', 'log_page', undefined, currentFilters);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError('Failed to fetch logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecializedLogs = async (type: 'errors' | 'user_activity' | 'system_events', userId?: string) => {
    setLoading(true);
    try {
      let logData: SystemLog[];
      switch (type) {
        case 'errors':
          logData = await logger.getRecentErrors();
          break;
        case 'user_activity':
          if (!userId) throw new Error('User ID required for user activity logs');
          logData = await logger.getUserActivity(userId);
          break;
        case 'system_events':
          logData = await logger.getSystemEvents();
          break;
      }
      setLogs(logData);
      await logUserAction(`view_${type}_logs`, 'log_page', undefined, { userId });
    } catch (err) {
      console.error(`Failed to fetch ${type} logs:`, err);
      setError(`Failed to fetch ${type} logs. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const currentLogs = logs.length > 0 ? logs : await logger.getLogs(filters);
      const csvContent = convertLogsToCSV(currentLogs);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      await logUserAction('export_system_logs', 'log_page', undefined, { count: currentLogs.length });
    } catch (err) {
      console.error('Failed to export logs:', err);
      setError('Failed to export logs. Please try again.');
    }
  };

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      let beforeDate: Date | undefined;
      const now = new Date();
      
      switch (clearTimeframe) {
        case '24h':
          beforeDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          beforeDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          beforeDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          beforeDate = undefined;
          break;
      }
      
      const result = await logger.clearLogs(beforeDate);
      
      if (result.success) {
        toast({ 
          title: 'Logs Cleared', 
          description: `Successfully deleted ${result.deletedCount} log entries.` 
        });
        fetchLogs();
        setIsClearDialogOpen(false);
      } else {
        throw new Error('Deletion process failed');
      }
    } catch (err) {
      toast({ 
        title: 'Clear Logs Failed', 
        description: err instanceof Error ? err.message : 'An error occurred while clearing logs.', 
        variant: 'destructive' 
      });
    } finally {
      setIsClearing(false);
    }
  };

  const convertLogsToCSV = (logs: SystemLog[]): string => {
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'User ID', 'User Email', 'User Role', 'Action', 'Resource Type', 'Resource ID', 'Session ID'];
    const rows = logs.map(log => [
      log.timestamp,
      log.level,
      log.category,
      `"${log.message.replace(/"/g, '""')}"`,
      log.userId || '',
      log.userEmail || '',
      log.userRole || '',
      log.action || '',
      log.resourceType || '',
      log.resourceId || '',
      log.sessionId || ''
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const getLogLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-red-500 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
      case 'warning': return 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
      case 'info': return 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
      case 'debug': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getLogTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      // Handle Firestore ServerTimestamp object
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
      }
      // Handle string/number date
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (e) {
      return 'Timestamp Error';
    }
  };

  const getLogLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      case 'debug': return <Settings className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: LogCategory) => {
    switch (category) {
      case 'authentication': return <User className="h-4 w-4" />;
      case 'data_change': return <Database className="h-4 w-4" />;
      case 'user_action': return <Activity className="h-4 w-4" />;
      case 'system_event': return <Settings className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    if (canAccessLogs) {
      fetchLogs();
    }
  }, [canAccessLogs]);

  // Live Watch Effect
  useEffect(() => {
    if (!isLive || !canAccessLogs) return;
    
    const interval = setInterval(() => {
      fetchLogs();
      setLastRefreshed(new Date());
    }, 10000); // 10 seconds
    
    return () => clearInterval(interval);
  }, [isLive, canAccessLogs, filters]);

  // Redirect or show access denied if user doesn't have permission
  if (authSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canAccessLogs) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access system logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page is restricted to system owners and administrators with log access permissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchTerm) ||
        log.userEmail?.toLowerCase().includes(searchTerm) ||
        log.action?.toLowerCase().includes(searchTerm) ||
        log.resourceType?.toLowerCase().includes(searchTerm)
      );
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Logs</h1>
          <p className="text-muted-foreground">
            Comprehensive system monitoring and audit trail
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2 text-right">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn("w-2 h-2 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isLive ? 'Live Sync Active' : 'Manual Mode'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              Last Check: {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border border-border mr-2">
            <Button
              variant={isLive ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsLive(true)}
              className={cn("rounded-full px-4 h-8 text-[10px] font-bold uppercase tracking-wider transition-all", isLive && "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20")}
            >
              Live
            </Button>
            <Button
              variant={!isLive ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsLive(false)}
              className={cn("rounded-full px-4 h-8 text-[10px] font-bold uppercase tracking-wider transition-all", !isLive && "bg-slate-600 hover:bg-slate-700 shadow-lg shadow-slate-600/20")}
            >
              Manual
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => fetchLogs()}
            disabled={loading}
            size="sm"
            className="rounded-xl h-10 border-2"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportLogs}
            disabled={loading || logs.length === 0}
            size="sm"
            className="rounded-xl h-10 border-2"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {userAppRole === 'owner' && (
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10 border-2 border-red-200 hover:bg-red-50 text-red-600 transition-all hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Logs
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="h-5 w-5" />
                    Clear System Logs
                  </DialogTitle>
                  <DialogDescription>
                    This will permanently delete log entries from the database. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Timeframe</Label>
                    <Select value={clearTimeframe} onValueChange={setClearTimeframe}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Older than 24 Hours</SelectItem>
                        <SelectItem value="7d">Older than 7 Days</SelectItem>
                        <SelectItem value="30d">Older than 30 Days</SelectItem>
                        <SelectItem value="all">Clear All Logs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-3 bg-red-50 rounded-lg border border-red-100 space-y-2">
                    <div className="flex items-center gap-2 text-red-800 text-xs font-bold">
                      <AlertTriangle className="h-3 w-3" />
                      WARNING
                    </div>
                    <p className="text-[11px] text-red-700 leading-relaxed">
                      You are about to delete logs starting from {clearTimeframe === 'all' ? 'the beginning of time' : `older than ${clearTimeframe}`}. 
                      The "Clear Logs" action itself will be recorded in the audit trail.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsClearDialogOpen(false)} disabled={isClearing}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleClearLogs} 
                    disabled={isClearing}
                    className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
                  >
                    {isClearing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      'Confirm Deletion'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Log Level</Label>
              <Select
                value={filters.level || 'all'}
                onValueChange={(value) => setFilters({ ...filters, level: value === 'all' ? undefined : value as LogLevel })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) => setFilters({ ...filters, category: value === 'all' ? undefined : value as LogCategory })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                  <SelectItem value="data_change">Data Changes</SelectItem>
                  <SelectItem value="user_action">User Actions</SelectItem>
                  <SelectItem value="system_event">System Events</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Limit</Label>
              <Select
                value={filters.limit?.toString() || '100'}
                onValueChange={(value) => setFilters({ ...filters, limit: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 entries</SelectItem>
                  <SelectItem value="100">100 entries</SelectItem>
                  <SelectItem value="250">250 entries</SelectItem>
                  <SelectItem value="500">500 entries</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => fetchLogs()} size="sm">
              Apply Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ limit: 100 });
                fetchLogs({ limit: 100 });
              }}
              size="sm"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Access Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent" onClick={() => fetchLogs()}>
            Recent Logs
          </TabsTrigger>
          <TabsTrigger value="errors" onClick={() => fetchSpecializedLogs('errors')}>
            Errors
          </TabsTrigger>
          <TabsTrigger value="system" onClick={() => fetchSpecializedLogs('system_events')}>
            System Events
          </TabsTrigger>
          <TabsTrigger value="security">
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          {/* Recent logs content will be handled by the main log display */}
        </TabsContent>
        
        <TabsContent value="errors" className="space-y-4">
          {/* Error logs content will be handled by the main log display */}
        </TabsContent>
        
        <TabsContent value="system" className="space-y-4">
          {/* System events content will be handled by the main log display */}
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Events
              </CardTitle>
              <CardDescription>
                Security-related events and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => fetchLogs({ category: 'security' })}
                variant="outline"
                className="w-full"
              >
                Load Security Logs
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                {filteredLogs.length} of {logs.length} logs
                {filters.searchTerm && ` matching "${filters.searchTerm}"`}
              </CardDescription>
            </div>
            <Badge variant="outline">
              {loading ? 'Loading...' : `${filteredLogs.length} entries`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2">Loading logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Eye className="h-5 w-5 mr-2" />
              No logs found matching the current filters
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full border",
                        getLogLevelColor(log.level)
                      )}>
                        {getLogLevelIcon(log.level)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryIcon(log.category)}
                          <span className="ml-1">{log.category}</span>
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-bold px-1.5 py-0", getLogLevelColor(log.level))}>
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                          {getLogTimestamp(log.timestamp)}
                        </span>
                      </div>
                      
                      <p className="font-medium text-sm mb-1">{log.message}</p>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        {log.userEmail && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{log.userEmail} ({log.userRole})</span>
                          </div>
                        )}
                        {log.action && (
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            <span>Action: {log.action}</span>
                            {log.resourceType && (
                              <span>on {log.resourceType} {log.resourceId && `(${log.resourceId})`}</span>
                            )}
                          </div>
                        )}
                        {log.sessionId && (
                          <div className="flex items-center gap-1">
                            <span>Session: {log.sessionId.split('_')[1]}</span>
                          </div>
                        )}
                      </div>
                      
                      {log.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            View Details
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details, null, 2) 
                              : log.details
                            }
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}