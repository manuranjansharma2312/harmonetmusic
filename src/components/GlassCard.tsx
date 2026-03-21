import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className, glow }: GlassCardProps) {
  return (
    <div className={cn(glow ? 'glass-card-glow' : 'glass-card', 'p-6', className)}>
      {children}
    </div>
  );
}
