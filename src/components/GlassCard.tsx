import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className, glow, ...props }: GlassCardProps) {
  return (
    <div className={cn(glow ? 'glass-card-glow' : 'glass-card', 'p-4 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}
