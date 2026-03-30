import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  processing: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  takedown: 'bg-orange-500/20 text-orange-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  sent: 'bg-blue-500/20 text-blue-400',
};

export const StatusBadge = forwardRef<HTMLSpanElement, { status: string }>(
  function StatusBadge({ status }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
          statusStyles[status] || 'bg-muted text-muted-foreground'
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }
);
