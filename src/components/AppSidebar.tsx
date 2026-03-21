import {
  LayoutDashboard,
  Upload,
  ListMusic,
  LogOut,
  Shield,
  Users,
  UserCircle,
} from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const userLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/submit', label: 'Submit Song', icon: Upload },
  { to: '/my-songs', label: 'My Songs', icon: ListMusic },
  { to: '/profile', label: 'My Profile', icon: UserCircle },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/submissions', label: 'All Submissions', icon: ListMusic },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const links = role === 'admin' ? adminLinks : userLinks;

  return (
    <aside className="glass-strong w-64 min-h-screen flex flex-col fixed left-0 top-0 z-30">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <img src={logoWhite} alt="Harmonet Music" className="h-10 w-auto" />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {role === 'admin' && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Admin Panel</span>
          </div>
        )}
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300',
                isActive
                  ? 'sidebar-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )
            }
          >
            <link.icon className="h-5 w-5" />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3 truncate px-2">{user?.email}</p>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 w-full"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
