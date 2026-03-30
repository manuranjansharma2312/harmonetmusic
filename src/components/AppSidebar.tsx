import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Upload, ListMusic, LogOut, Shield, Users,
  UserCircle, Tags, Tag, Headset, ShieldAlert, Instagram,
  Merge, Youtube, Trash2, ChevronDown, MessageSquare,
  BarChart3, MonitorPlay, Wallet, FileText, Receipt,
  Image as ImageIcon, Bell, BookOpen, FileSignature,
  Megaphone, Landmark, CreditCard, UsersRound, Sparkles, Link2, ArrowRightLeft, Mail,
  Settings, Globe, Video, Tv, KeyRound, Clock, ShieldCheck,
} from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { NavLink } from '@/components/NavLink';

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarFooter, SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const AI_SETTINGS_CACHE_KEY = 'ai-settings-public-cache-v1';

function readCachedAiEnabled() {
  if (typeof window === 'undefined') return false;

  try {
    const cached = localStorage.getItem(AI_SETTINGS_CACHE_KEY);
    if (!cached) return false;

    return JSON.parse(cached)?.is_enabled === true;
  } catch {
    return false;
  }
}

const contentToolLinks = [
  { to: '/tools/copyright-claim', label: 'Copyright Claim Removal', icon: ShieldAlert },
  { to: '/tools/instagram-link', label: 'Instagram Link To Song', icon: Instagram },
  { to: '/tools/content-id-merge', label: 'Content ID Merge', icon: Merge },
  { to: '/tools/oac-apply', label: 'Official Artist Channel', icon: Youtube },
  { to: '/tools/takedown', label: 'Takedown', icon: Trash2 },
  { to: '/tools/playlist-pitching', label: 'Playlist Pitching', icon: ListMusic },
  { to: '/tools/custom-support', label: 'Custom Support', icon: MessageSquare },
];

const reportLinksBase = [
  { to: '/reports/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports/youtube', label: 'YouTube Reports', icon: Youtube },
  { to: '/reports/vevo', label: 'Vevo Reports', icon: Tv, vevoOnly: true },
  { to: '/reports/ott', label: 'OTT Reports', icon: MonitorPlay },
];

const adminReportLinksBase = [
  { to: '/admin/reports/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/reports/youtube', label: 'YouTube Reports', icon: Youtube },
  { to: '/admin/reports/vevo', label: 'Vevo Reports', icon: Tv, vevoOnly: true },
  { to: '/admin/reports/ott', label: 'OTT Reports', icon: MonitorPlay },
];

const adminSubLabelLinks = [
  { to: '/admin/sub-labels', label: 'All Sub Labels', icon: UsersRound },
  { to: '/admin/sub-label-withdrawals', label: 'Withdraw Requests', icon: Wallet },
];

const adminPosterLinks = [
  { to: '/admin/ai-image-system', label: 'AI Poster Generate', icon: Sparkles },
  { to: '/admin/poster-generator', label: 'Out Now Poster Generator', icon: ImageIcon },
];

const adminContactPoliciesLinks = [
  { to: '/admin/terms', label: 'Terms & Conditions', icon: FileText },
  { to: '/admin/contact-support', label: 'Contact Details', icon: Headset },
  { to: '/admin/tutorials', label: 'Manage Tutorials', icon: BookOpen },
];

const adminContractsLinks = [
  { to: '/admin/agreements', label: 'Agreements', icon: FileSignature },
  { to: '/admin/signatures', label: 'E-Signatures', icon: FileSignature },
];

const adminPromotionalLinks = [
  { to: '/admin/promotion-tools', label: 'Paid Promotions', icon: Megaphone },
  { to: '/admin/promotional-settings', label: 'Promotional Settings', icon: Settings },
];

const adminBillingLinks = [
  { to: '/admin/invoices', label: 'Generate Invoice', icon: Receipt },
];

const adminLinksTop = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/all-pending', label: 'All Pendings', icon: Clock },
  { to: '/admin/users', label: 'All Users', icon: Users },
  { to: '/admin/submissions', label: 'All Releases', icon: ListMusic },
  { to: '/admin/content-requests', label: 'Support Requests', icon: Headset },
  { to: '/admin/labels', label: 'Manage Labels', icon: Tag },
];

const adminLinksMiddle = [
  { to: '/admin/transfer-history', label: 'Release Transfers', icon: ArrowRightLeft },
  { to: '/admin/notices', label: 'Notice Updates', icon: Bell },
  { to: '/admin/smart-links', label: 'Smart Links', icon: Link2 },
  { to: '/admin/email-settings', label: 'Manage Emails', icon: Mail },
];

const adminGeneralSettingsLinks = [
  { to: '/admin/genres-languages', label: 'Genres & Languages', icon: Tags },
  { to: '/admin/payment-settings', label: 'Tax Settings', icon: CreditCard },
];

export function AppSidebar() {
  const { role, signOut, user, userType, isSubLabel } = useAuth();
  const { isImpersonating, impersonatedUserId } = useImpersonate();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { logoSrc, branding } = useBranding();
  const { settings } = useSiteSettings();
  const isTeam = role === 'team';
  const showUserView = isImpersonating || (role !== 'admin' && role !== 'team');
  const [teamAllowedPages, setTeamAllowedPages] = useState<string[]>([]);
  const [subLabelAllowedPages, setSubLabelAllowedPages] = useState<string[] | null>(null);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [adminSubLabelsOpen, setAdminSubLabelsOpen] = useState(false);
  const [userSubLabelsOpen, setUserSubLabelsOpen] = useState(false);
  const [impUserType, setImpUserType] = useState<string | null>(null);
  const [impIsSubLabel, setImpIsSubLabel] = useState(false);
  const [userVideoOpen, setUserVideoOpen] = useState(false);
  const [adminVideoOpen, setAdminVideoOpen] = useState(false);
  const [userCmsOpen, setUserCmsOpen] = useState(false);
  const [userPosterOpen, setUserPosterOpen] = useState(false);
  const [userContactPoliciesOpen, setUserContactPoliciesOpen] = useState(false);
  const [adminCmsOpen, setAdminCmsOpen] = useState(false);
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const [adminContactPoliciesOpen, setAdminContactPoliciesOpen] = useState(false);
  const [adminPosterOpen, setAdminPosterOpen] = useState(false);
  const [adminContractsOpen, setAdminContractsOpen] = useState(false);
  const [adminPromotionalOpen, setAdminPromotionalOpen] = useState(false);
  const [adminGeneralSettingsOpen, setAdminGeneralSettingsOpen] = useState(false);
  const [adminBillingOpen, setAdminBillingOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() => readCachedAiEnabled());

  // Fetch impersonated user's profile when impersonating
  useEffect(() => {
    if (isImpersonating && impersonatedUserId) {
      supabase.from('profiles').select('user_type').eq('user_id', impersonatedUserId).maybeSingle()
        .then(({ data }) => {
          setImpUserType(data?.user_type || null);
          setImpIsSubLabel(data?.user_type === 'sub_label');
        });
    } else {
      setImpUserType(null);
      setImpIsSubLabel(false);
    }
  }, [isImpersonating, impersonatedUserId]);

  // Check if AI Image system is enabled
  useEffect(() => {
    let active = true;

    supabase.rpc('get_ai_settings_public' as any)
      .then(({ data }: any) => { 
        const settings = Array.isArray(data) ? data[0] : data;
        const nextAiEnabled = settings?.is_enabled ?? false;

        try {
          localStorage.setItem(AI_SETTINGS_CACHE_KEY, JSON.stringify({ is_enabled: nextAiEnabled }));
        } catch {}

        if (active) {
          setAiEnabled((prev) => (prev === nextAiEnabled ? prev : nextAiEnabled));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch team member's allowed pages
  useEffect(() => {
    if (isTeam && user) {
      (supabase.from('team_members') as any).select('allowed_pages').eq('user_id', user.id).maybeSingle()
        .then(({ data }: any) => setTeamAllowedPages(data?.allowed_pages || []));
    }
  }, [isTeam, user]);

  // Fetch sub-label allowed pages
  useEffect(() => {
    const uid = isImpersonating ? impersonatedUserId : user?.id;
    const isSub = isImpersonating ? impIsSubLabel : isSubLabel;
    if (isSub && uid) {
      (supabase.from('sub_labels') as any).select('allowed_pages').eq('sub_user_id', uid).maybeSingle()
        .then(({ data }: any) => {
          const pages = data?.allowed_pages || [];
          setSubLabelAllowedPages(pages.length > 0 ? pages : null);
        });
    } else {
      setSubLabelAllowedPages(null);
    }
  }, [isImpersonating, impersonatedUserId, impIsSubLabel, isSubLabel, user]);

  // Helper to check if a team user has access to a page key
  const hasTeamAccess = (key: string) => !isTeam || teamAllowedPages.includes(key);

  // Helper to check if a sub-label user has access to a page key
  const hasSubLabelAccess = (key: string) => {
    if (!effectiveIsSubLabel || subLabelAllowedPages === null) return true; // no restrictions
    return subLabelAllowedPages.includes(key);
  };

  const effectiveUserType = isImpersonating ? impUserType : userType;
  const effectiveIsSubLabel = isImpersonating ? impIsSubLabel : isSubLabel;

  // Build user links dynamically based on user type
  const userLinksTop = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/submit', label: 'New Release', icon: Upload },
    { to: '/my-releases', label: 'My Releases', icon: ListMusic },
    { to: '/my-labels', label: 'My Labels', icon: Tag },
  ];

  // YouTube CMS collapsible links (hidden for sub-labels)
  const userCmsLinks = [
    { to: '/youtube-cms-link', label: 'CMS Link', icon: Youtube },
    { to: '/cms-reports', label: 'CMS Reports', icon: BarChart3 },
    { to: '/cms-analytics', label: 'CMS Analytics', icon: BarChart3 },
    { to: '/cms-balance', label: 'CMS Revenue', icon: Wallet },
  ];

  // Admin YouTube CMS collapsible links
  const adminCmsLinks = [
    { to: '/admin/youtube-cms-links', label: 'CMS Links', icon: Youtube },
    { to: '/admin/cms-reports', label: 'CMS Reports', icon: BarChart3 },
    { to: '/admin/cms-withdrawals', label: 'CMS Withdrawals', icon: Wallet },
    { to: '/admin/youtube-cms-settings', label: 'CMS Settings', icon: Settings },
  ];

  // Admin Settings collapsible links
  const adminSettingsLinks = [
    { to: '/admin/branding-settings', label: 'Site Settings', icon: Globe },
    { to: '/admin/site-settings', label: 'System Settings', icon: Settings },
    { to: '/admin/account-security', label: 'Admin Account Settings', icon: KeyRound },
  ];

  // Video Distribution collapsible links
  const userVideoLinks = [
    { to: '/video/upload?type=upload_video', label: 'Upload Video', icon: Upload },
    { to: '/video/vevo-channel?type=vevo_channel', label: 'Create Vevo Channel', icon: Tv },
    { to: '/my-videos', label: 'My Videos', icon: Video },
    { to: '/vevo-channels', label: 'Vevo Channels', icon: Tv },
    { to: '/video-guidelines', label: 'Guidelines', icon: FileText },
  ];

  const adminVideoLinks = [
    { to: '/admin/video-forms', label: 'Video Form Builder', icon: Video },
    { to: '/admin/video-submissions', label: 'Video Submissions', icon: Video },
    { to: '/admin/vevo-channels', label: 'Vevo Channels', icon: Tv },
    { to: '/admin/video-guidelines', label: 'Video Guidelines', icon: FileText },
    { to: '/admin/vevo-settings', label: 'Vevo Settings', icon: Settings },
  ];

  // Sub Labels collapsible links (only for record_label users who are NOT sub-labels)
  const userSubLabelLinks = [
    { to: '/sub-labels', label: 'All Sub Labels', icon: UsersRound },
    { to: '/sub-labels/withdrawals', label: 'Withdraw Requests', icon: Wallet },
  ];
  const showUserSubLabels = effectiveUserType === 'record_label' && !effectiveIsSubLabel;

  // Filter report links based on settings
  const reportLinks = reportLinksBase.filter(l => !l.vevoOnly || settings.enable_vevo);
  const adminReportLinks = adminReportLinksBase.filter(l => !l.vevoOnly || settings.enable_vevo);

  // User Poster Generator collapsible links
  const userPosterLinks = [
    ...(aiEnabled ? [{ to: '/ai-images', label: 'AI Poster Generate', icon: Sparkles }] : []),
    { to: '/poster-generator', label: 'Out Now Poster', icon: ImageIcon },
  ];

  // User Contact & Policies collapsible links
  const userContactPoliciesLinks = [
    { to: '/terms', label: 'Terms & Conditions', icon: FileText },
    ...(!effectiveIsSubLabel ? [{ to: '/contact-support', label: 'Contact Support', icon: Headset }] : []),
    { to: '/help-tutorials', label: 'Help Tutorials', icon: BookOpen },
  ];

  const userLinksMiddle = [
    { to: '/revenue', label: 'Revenue', icon: Wallet },
  ];

  const userLinksAfterGroups = [
    { to: '/smart-links', label: 'Smart Links', icon: Link2 },
  ];

  const userLinksBottom = [
    { to: '/profile', label: 'My Profile', icon: UserCircle },
  ];

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
          end={link.to === '/dashboard'}
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
      <SidebarHeader className="p-2 border-b border-border/50">
        <div className="flex items-center justify-center overflow-hidden">
          <img
            src={logoSrc}
            alt={branding.site_name}
            style={{ height: collapsed ? `${branding.sidebar_collapsed_logo_height}px` : `${branding.sidebar_logo_height}px` }}
            className="w-auto max-w-full object-contain transition-all duration-200"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {(role === 'admin' || isTeam) && !isImpersonating && !collapsed && (
            <SidebarGroupLabel className="flex items-center gap-2 text-primary">
              <Shield className="h-3.5 w-3.5" />
              {isTeam ? 'Team Panel' : 'Admin Panel'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {showUserView ? (
                <>
                  {hasSubLabelAccess('dashboard') && renderNavLink(userLinksTop[0])}
                  {hasSubLabelAccess('new-release') && renderNavLink(userLinksTop[1])}
                  {hasSubLabelAccess('my-releases') && renderNavLink(userLinksTop[2])}
                  {hasSubLabelAccess('my-labels') && renderNavLink(userLinksTop[3])}
                  {hasSubLabelAccess('video-distribution') && settings.enable_video_distribution && renderCollapsibleGroup('Video Distribution', Video, userVideoLinks, userVideoOpen, setUserVideoOpen)}
                  {showUserSubLabels && renderCollapsibleGroup('Sub Labels', UsersRound, userSubLabelLinks, userSubLabelsOpen, setUserSubLabelsOpen)}
                  {settings.enable_youtube_cms && !effectiveIsSubLabel && renderCollapsibleGroup('YouTube CMS', Youtube, userCmsLinks, userCmsOpen, setUserCmsOpen)}
                  {hasSubLabelAccess('reports') && renderCollapsibleGroup('Reports & Analytics', BarChart3, reportLinks, reportsOpen, setReportsOpen)}
                  {hasSubLabelAccess('revenue') && userLinksMiddle.map(renderNavLink)}
                  {hasSubLabelAccess('support') && renderCollapsibleGroup('Support', Headset, contentToolLinks, toolsOpen, setToolsOpen)}
                  {!effectiveIsSubLabel && renderNavLink({ to: '/promotion-tools', label: 'Paid Promotions', icon: Megaphone })}
                  {hasSubLabelAccess('poster') && renderCollapsibleGroup('Poster Generator', ImageIcon, userPosterLinks, userPosterOpen, setUserPosterOpen)}
                  {hasSubLabelAccess('smart-links') && userLinksAfterGroups.map(renderNavLink)}
                  {renderCollapsibleGroup('Contact & Policies', FileText, userContactPoliciesLinks, userContactPoliciesOpen, setUserContactPoliciesOpen)}
                  {hasSubLabelAccess('profile') && userLinksBottom.map(renderNavLink)}
                </>
              ) : (
                <>
                  {hasTeamAccess('dashboard') && renderNavLink(adminLinksTop[0])}
                  {/* All Pendings is always visible for team — filtered inside the page */}
                  {renderNavLink(adminLinksTop[1])}
                  {hasTeamAccess('users') && renderNavLink(adminLinksTop[2])}
                  {hasTeamAccess('submissions') && renderNavLink(adminLinksTop[3])}
                  {hasTeamAccess('content-requests') && renderNavLink(adminLinksTop[4])}
                  {hasTeamAccess('labels') && renderNavLink(adminLinksTop[5])}
                  {hasTeamAccess('video-distribution') && settings.enable_video_distribution && renderCollapsibleGroup('Video Distribution', Video, isTeam ? adminVideoLinks.filter(l => !l.to.includes('settings') && !l.to.includes('guidelines')) : adminVideoLinks, adminVideoOpen, setAdminVideoOpen)}
                  {hasTeamAccess('sub-labels') && renderCollapsibleGroup('Sub Labels', UsersRound, adminSubLabelLinks, adminSubLabelsOpen, setAdminSubLabelsOpen)}
                  {hasTeamAccess('youtube-cms') && settings.enable_youtube_cms && renderCollapsibleGroup('YouTube CMS', Youtube, isTeam ? adminCmsLinks.filter(l => !l.to.includes('settings')) : adminCmsLinks, adminCmsOpen, setAdminCmsOpen)}
                  {hasTeamAccess('revenue') && renderNavLink({ to: '/admin/revenue', label: 'Revenue & Withdrawals', icon: Wallet })}
                  {hasTeamAccess('reports') && renderCollapsibleGroup('Reports & Analytics', BarChart3, adminReportLinks, reportsOpen, setReportsOpen)}
                  {hasTeamAccess('invoices') && renderNavLink({ to: '/admin/invoices', label: 'Billing & Invoices', icon: Receipt })}
                  {hasTeamAccess('contracts') && renderCollapsibleGroup('Contracts & E-Sign', FileSignature, adminContractsLinks, adminContractsOpen, setAdminContractsOpen)}
                  {hasTeamAccess('promotions') && renderCollapsibleGroup('Promotional Tools', Megaphone, isTeam ? adminPromotionalLinks.filter(l => !l.to.includes('settings')) : adminPromotionalLinks, adminPromotionalOpen, setAdminPromotionalOpen)}
                  {hasTeamAccess('poster') && renderCollapsibleGroup('Poster Generator', ImageIcon, adminPosterLinks, adminPosterOpen, setAdminPosterOpen)}
                  {hasTeamAccess('transfer-history') && adminLinksMiddle.filter(l => l.to === '/admin/transfer-history').map(renderNavLink)}
                  {hasTeamAccess('notices') && adminLinksMiddle.filter(l => l.to === '/admin/notices').map(renderNavLink)}
                  {hasTeamAccess('smart-links') && adminLinksMiddle.filter(l => l.to === '/admin/smart-links').map(renderNavLink)}
                  {hasTeamAccess('email-settings') && adminLinksMiddle.filter(l => l.to === '/admin/email-settings').map(renderNavLink)}
                  {!isTeam && hasTeamAccess('general-settings') && renderCollapsibleGroup('General Settings', Settings, adminGeneralSettingsLinks, adminGeneralSettingsOpen, setAdminGeneralSettingsOpen)}
                  {!isTeam && hasTeamAccess('contact-policies') && renderCollapsibleGroup('Contact & Policies', FileText, adminContactPoliciesLinks, adminContactPoliciesOpen, setAdminContactPoliciesOpen)}
                  {!isTeam && hasTeamAccess('settings') && renderCollapsibleGroup('Settings', Settings, adminSettingsLinks, adminSettingsOpen, setAdminSettingsOpen)}
                  {!isTeam && renderNavLink({ to: '/admin/team-management', label: 'Team Management', icon: ShieldCheck })}
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
