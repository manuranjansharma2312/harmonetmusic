import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
        status === 'approved' && 'bg-green-500/20 text-green-400',
        status === 'rejected' && 'bg-red-500/20 text-red-400'
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
