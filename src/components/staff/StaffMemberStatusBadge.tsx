
import type { StaffAttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StaffMemberStatusBadgeProps {
  status: StaffAttendanceStatus;
}

export function StaffMemberStatusBadge({ status }: StaffMemberStatusBadgeProps) {
  const statusStyles: Record<StaffAttendanceStatus, string> = {
    'On Duty': 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
    'Off Duty': 'bg-gray-500/20 text-gray-700 border-gray-500/30 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20',
    'On Break': 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
    'Away': 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-full capitalize',
        statusStyles[status] || 'bg-muted text-muted-foreground border-border' // Fallback style
      )}
    >
      {status}
    </Badge>
  );
}
