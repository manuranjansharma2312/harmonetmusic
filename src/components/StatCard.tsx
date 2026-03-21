import { GlassCard } from './GlassCard';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: string;
}

export function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <GlassCard glow className="animate-fade-in">
      <div className="flex items-start justify-between gap-4 sm:items-center">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold font-display mt-1 break-words">{value}</p>
        </div>
        <div
          className="rounded-xl p-2.5 sm:p-3 shrink-0"
          style={{ background: color || 'hsla(0, 67%, 25%, 0.3)' }}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
        </div>
      </div>
    </GlassCard>
  );
}
