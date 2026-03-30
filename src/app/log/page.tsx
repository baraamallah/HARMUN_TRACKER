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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Settings
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
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFilters>({ limit: 100 });
  const [activeTab, setActiveTab] = useState('recent');
  
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
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'debug': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchLogs()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportLogs}
            disabled={loading || logs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
                value={filters.level || ''}
                onValueChange={(value) => setFilters({ ...filters, level: value as LogLevel || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All levels</SelectItem>
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
                value={filters.category || ''}
                onValueChange={(value) => setFilters({ ...filters, category: value as LogCategory || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
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
                        <Badge variant="outline" className={cn("text-xs", getLogLevelColor(log.level))}>
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
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