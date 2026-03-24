import { useState } from 'react';
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
  Headset,
  ShieldAlert,
  Instagram,
  Merge,
  Youtube,
  Trash2,
  ChevronDown,
  MessageSquare,
  BarChart3,
  Music,
  MonitorPlay,
  Wallet,
  FileText,
  Receipt,
  Image as ImageIcon,
  Bell,
  BookOpen,
  FileSignature,
  Megaphone,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const userLinksTop = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/submit', label: 'New Release', icon: Upload },
  { to: '/my-releases', label: 'My Releases', icon: ListMusic },
  { to: '/my-labels', label: 'My Labels', icon: Tag },
];

const contentToolLinks = [
  { to: '/tools/copyright-claim', label: 'Copyright Claim Removal', icon: ShieldAlert },
  { to: '/tools/instagram-link', label: 'Instagram Link To Song', icon: Instagram },
  { to: '/tools/content-id-merge', label: 'Content ID Merge', icon: Merge },
  { to: '/tools/oac-apply', label: 'Official Artist Channel', icon: Youtube },
  { to: '/tools/takedown', label: 'Takedown', icon: Trash2 },
  { to: '/tools/custom-support', label: 'Custom Support', icon: MessageSquare },
];

const reportLinks = [
  { to: '/reports/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports/youtube', label: 'YouTube Reports', icon: Youtube },
  { to: '/reports/ott', label: 'OTT Reports', icon: MonitorPlay },
];

const adminReportLinks = [
  { to: '/admin/reports/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/reports/youtube', label: 'YouTube Reports', icon: Youtube },
  { to: '/admin/reports/ott', label: 'OTT Reports', icon: MonitorPlay },
];

const userLinksBottom = [
  { to: '/poster-generator', label: 'Out Now Poster', icon: ImageIcon },
  { to: '/help-tutorials', label: 'Help Tutorials', icon: BookOpen },
  { to: '/revenue', label: 'Revenue', icon: Wallet },
  { to: '/terms', label: 'Terms & Conditions', icon: FileText },
  { to: '/profile', label: 'My Profile', icon: UserCircle },
];

const adminLinksTop = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/submissions', label: 'All Submissions', icon: ListMusic },
  { to: '/admin/genres-languages', label: 'Genres & Languages', icon: Tags },
  { to: '/admin/labels', label: 'Labels', icon: Tag },
  { to: '/admin/content-requests', label: 'Content Requests', icon: Headset },
  { to: '/admin/revenue', label: 'Revenue', icon: Wallet },
  { to: '/admin/terms', label: 'Terms & Conditions', icon: FileText },
  { to: '/admin/invoices', label: 'Generate Invoice', icon: Receipt },
  { to: '/admin/poster-generator', label: 'Poster Generator', icon: ImageIcon },
  { to: '/admin/tutorials', label: 'Help Tutorials', icon: BookOpen },
  { to: '/admin/notices', label: 'Notice Updates', icon: Bell },
  { to: '/admin/agreements', label: 'Agreements', icon: FileSignature },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const { isImpersonating } = useImpersonate();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const showUserView = isImpersonating || role !== 'admin';
  const [toolsOpen, setToolsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderNavLink = (link: { to: string; label: string; icon: any }) => (
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
  );

  const renderCollapsibleGroup = (
    label: string,
    icon: any,
    links: { to: string; label: string; icon: any }[],
    open: boolean,
    setOpen: (v: boolean) => void,
  ) => {
    const Icon = icon;
    if (collapsed) {
      return links.map(renderNavLink);
    }
    return (
      <li>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu>
              {links.map((link) => (
                <SidebarMenuItem key={link.to}>
                  <SidebarMenuButton asChild tooltip={link.label}>
                    <NavLink
                      to={link.to}
                      onClick={handleNavClick}
                      className="flex items-center gap-3 px-3 py-2.5 pl-8 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                      activeClassName="bg-primary/10 text-foreground font-semibold"
                    >
                      <link.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{link.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      </li>
    );
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
              {showUserView ? (
                <>
                  {userLinksTop.map(renderNavLink)}
                  {renderCollapsibleGroup('Support', Headset, contentToolLinks, toolsOpen, setToolsOpen)}
                  {renderCollapsibleGroup('Reports & Analytics', BarChart3, reportLinks, reportsOpen, setReportsOpen)}
                  {userLinksBottom.map(renderNavLink)}
                </>
              ) : (
                <>
                  {adminLinksTop.map(renderNavLink)}
                  {renderCollapsibleGroup('Reports & Analytics', BarChart3, adminReportLinks, reportsOpen, setReportsOpen)}
                </>
              )}
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
