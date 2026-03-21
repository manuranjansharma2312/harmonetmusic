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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold font-display mt-1">{value}</p>
        </div>
        <div
          className="p-3 rounded-xl"
          style={{ background: color || 'hsla(0, 67%, 25%, 0.3)' }}
        >
          <Icon className="h-6 w-6 text-foreground" />
        </div>
      </div>
    </GlassCard>
  );
}
