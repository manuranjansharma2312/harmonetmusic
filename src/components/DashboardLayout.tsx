import { ReactNode, useState, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
import { BackgroundBlobs } from './BackgroundBlobs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const SIDEBAR_STORAGE_KEY = 'sidebar-open';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = document.cookie.match(/sidebar:state=([^;]+)/)?.[1];
      return stored === 'true';
    }
    return true;
  });

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen relative flex w-full">
        <BackgroundBlobs />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/50 px-4 sticky top-0 z-20 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </header>
          <main className="flex-1 relative z-10 p-3 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
