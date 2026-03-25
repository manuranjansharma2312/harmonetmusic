import { cn } from '@/lib/utils';
import { forwardRef, ReactNode } from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className, glow, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(glow ? 'glass-card-glow' : 'glass-card', 'p-4 sm:p-6', className)} {...props}>
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
