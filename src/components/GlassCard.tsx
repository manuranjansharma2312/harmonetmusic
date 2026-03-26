import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { children, className, glow, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(glow ? 'glass-card-glow' : 'glass-card', 'p-4 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
});
