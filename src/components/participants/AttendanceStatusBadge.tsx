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
    'In Break': 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
    'Restroom Break': 'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
    'Technical Issue': 'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
    'Stepped Out': 'bg-gray-500/20 text-gray-700 border-gray-500/30 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-full capitalize',
        statusStyles[status] || 'bg-gray-500/20 text-gray-700 border-gray-500/30' // Fallback style
      )}
    >
      {status}
    </Badge>
  );
}
