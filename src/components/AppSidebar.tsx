import {
  LayoutDashboard,
  Upload,
  ListMusic,
  LogOut,
  Shield,
  Users,
  UserCircle,
  Tags,
  Tag,
} from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const userLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/submit', label: 'New Release', icon: Upload },
  { to: '/my-releases', label: 'My Releases', icon: ListMusic },
  { to: '/my-labels', label: 'My Labels', icon: Tag },
  { to: '/profile', label: 'My Profile', icon: UserCircle },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/submissions', label: 'All Submissions', icon: ListMusic },
  { to: '/admin/genres-languages', label: 'Genres & Languages', icon: Tags },
  { to: '/admin/labels', label: 'Labels', icon: Tag },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const { isImpersonating } = useImpersonate();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const showUserView = isImpersonating || role !== 'admin';
  const links = showUserView ? userLinks : adminLinks;

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4 border-b border-border/50">
        <div className="flex items-center justify-center">
          <img src={logoWhite} alt="Harmonet Music" className={collapsed ? 'h-7 w-auto' : 'h-14 w-auto'} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {role === 'admin' && !isImpersonating && !collapsed && (
            <SidebarGroupLabel className="flex items-center gap-2 text-primary">
              <Shield className="h-3.5 w-3.5" />
              Admin Panel
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((link) => (
                <SidebarMenuItem key={link.to}>
                  <SidebarMenuButton asChild tooltip={link.label}>
                    <NavLink
                      to={link.to}
                      end={link.to === '/admin'}
                      onClick={handleNavClick}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                      activeClassName="bg-primary/10 text-foreground font-semibold"
                    >
                      <link.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{link.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/50">
        {!collapsed && (
          <p className="text-xs text-muted-foreground mb-2 truncate px-2">{user?.email}</p>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign Out">
              <button
                onClick={() => { handleNavClick(); signOut(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all w-full"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
