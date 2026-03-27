'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Participant } from '@/types';

export interface RestroomAlert {
  participantId: string;
  participantName: string;
  committee: string;
  school: string;
  startTime: Date;
  elapsedMs: number;
  elapsedLabel: string;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Hook that watches a list of participants and returns those who have been
 * in "Restroom Break" longer than `thresholdMs` milliseconds.
 * Updates every 30 seconds.
 */
export function useRestroomAlerts(
  participants: Participant[],
  thresholdMs: number
): RestroomAlert[] {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const alerts = useMemo<RestroomAlert[]>(() => {
    if (!participants.length) return [];
    return participants
      .filter(p => {
        if (p.status !== 'Restroom Break') return false;
        if (!p.restroomBreakStartTime) return false;
        const start = new Date(p.restroomBreakStartTime).getTime();
        if (isNaN(start)) return false;
        return now - start >= thresholdMs;
      })
      .map(p => {
        const start = new Date(p.restroomBreakStartTime!).getTime();
        const elapsedMs = now - start;
        return {
          participantId: p.id,
          participantName: p.name,
          committee: p.committee,
          school: p.school,
          startTime: new Date(p.restroomBreakStartTime!),
          elapsedMs,
          elapsedLabel: formatElapsed(elapsedMs),
        };
      })
      .sort((a, b) => b.elapsedMs - a.elapsedMs);
  }, [participants, thresholdMs, now]);

  return alerts;
}

export { formatElapsed };
