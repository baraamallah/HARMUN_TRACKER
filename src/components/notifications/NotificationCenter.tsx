'use client';

import * as React from 'react';
import { Bell, X, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RestroomAlert } from '@/hooks/use-restroom-alerts';

interface NotificationCenterProps {
  alerts: RestroomAlert[];
  onMarkBack: (participantId: string) => void;
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

export function NotificationCenter({ alerts, onMarkBack }: NotificationCenterProps) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = React.useState(false);

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.participantId));
  const count = visibleAlerts.length;

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const handleClearAll = () => {
    setDismissed(new Set(alerts.map(a => a.participantId)));
  };

  // Re-show if a previously dismissed alert gets more severe or if new ones appear
  React.useEffect(() => {
    setDismissed(prev => {
      const currentIds = new Set(alerts.map(a => a.participantId));
      // Remove dismissed entries that are no longer in alerts (they returned)
      const cleaned = new Set([...prev].filter(id => currentIds.has(id)));
      return cleaned;
    });
  }, [alerts]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 sm:h-9 sm:w-9"
          aria-label={`Notifications${count > 0 ? ` (${count} overdue)` : ''}`}
        >
          <Bell className="h-6 w-6 sm:h-5 sm:w-5" />
          {count > 0 && (
            <span className="absolute top-0 right-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse ring-2 ring-background">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1rem)] sm:w-80 p-0 shadow-2xl border-2">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <RestroomIcon className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Restroom Alerts</span>
            {count > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {count}
              </Badge>
            )}
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleClearAll}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        {/* Body */}
        {visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No overdue restroom breaks</p>
            <p className="text-xs text-muted-foreground/60 mt-1">All participants are accounted for</p>
          </div>
        ) : (
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
                      onClick={() => {
                        onMarkBack(alert.participantId);
                        handleDismiss(alert.participantId);
                      }}
                    >
                      ✓ Mark as Back
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground -mt-0.5 -mr-1"
                    onClick={() => handleDismiss(alert.participantId)}
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
