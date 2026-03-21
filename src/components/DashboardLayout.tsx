import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { BackgroundBlobs } from './BackgroundBlobs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import logoWhite from '@/assets/logo-white.png';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative flex w-full">
      <BackgroundBlobs />
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border/50 bg-background/80 px-3 backdrop-blur-sm sm:px-4 lg:px-6">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <img src={logoWhite} alt="Harmonet Music" className="ml-3 h-8 w-auto sm:h-9 md:hidden" />
        </header>
        <main className="relative z-10 flex-1 overflow-x-hidden px-3 py-3 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
