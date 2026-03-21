import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { BackgroundBlobs } from './BackgroundBlobs';
import { Menu, X } from 'lucide-react';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen relative">
      <BackgroundBlobs />
      
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-strong px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground">MusicDist</h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/80" />
          <div onClick={(e) => e.stopPropagation()}>
            <AppSidebar />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      <main className="lg:ml-64 relative z-10 p-6 pt-20 lg:pt-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}
