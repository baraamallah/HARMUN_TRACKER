import type { AttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const statusStyles: Record<AttendanceStatus, string> = {
    Present: 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
    Absent: 'bg-red-500/20 text-red-700 border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    'Present On Account': 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-full capitalize',
        statusStyles[status]
      )}
    >
      {status}
    </Badge>
  );
}
