'use client';

import * as React from 'react';
import { differenceInSeconds, format } from 'date-fns';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RestroomTimerProps {
  startTime: string | null | undefined;
  thresholdMinutes?: number;
}

export function RestroomTimer({ startTime, thresholdMinutes = 10 }: RestroomTimerProps) {
  const [elapsed, setElapsed] = React.useState<number>(0);

  React.useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const seconds = differenceInSeconds(now, start);
      setElapsed(isNaN(seconds) ? 0 : Math.max(0, seconds));
    };

    // Initial update
    updateElapsed();

    // Set up interval
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return null;

  const formatDuration = (totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  // Turn red after the threshold (converted to seconds) as a warning
  const isWarning = elapsed >= thresholdMinutes * 60;

  return (
    <div className={cn(
      "flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-0.5 rounded-full border transition-colors",
      isWarning 
        ? "bg-red-50 text-red-600 border-red-200 animate-pulse dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" 
        : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
    )}>
      <Timer className="h-3 w-3" />
      <span>{formatDuration(elapsed)}</span>
    </div>
  );
}
