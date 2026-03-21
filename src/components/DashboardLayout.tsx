import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { BackgroundBlobs } from './BackgroundBlobs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen relative flex w-full">
        <BackgroundBlobs />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/50 px-4 sticky top-0 z-20 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </header>
          <main className="flex-1 relative z-10 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
