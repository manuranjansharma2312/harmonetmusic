import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useTeamPermissions() {
  const { user, role } = useAuth();
  const isTeam = role === 'team';
  const isAdmin = role === 'admin';
  const [allowedPages, setAllowedPages] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isTeam && user) {
      (supabase.from('team_members') as any)
        .select('allowed_pages')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }: any) => {
          setAllowedPages(data?.allowed_pages || []);
          setLoaded(true);
        });
    } else {
      setLoaded(true);
    }
  }, [isTeam, user]);

  /** Team members cannot delete anything */
  const canDelete = !isTeam;

  /** Team members cannot change system settings */
  const canChangeSettings = !isTeam;

  /** Check if a pending category should be visible to this team member */
  const canViewPendingCategory = (pendingKey: string) => {
    if (!isTeam) return true; // admins see all
    // Map pending category keys → admin page keys
    const pendingToPageMap: Record<string, string[]> = {
      users: ['users'],
      releases: ['submissions'],
      labels: ['labels'],
      support: ['content-requests'],
      videos: ['video-distribution'],
      withdrawals: ['revenue'],
      cms_withdrawals: ['youtube-cms'],
      promotions: ['promotions'],
      sub_labels: ['sub-labels'],
      cms_links: ['youtube-cms'],
      ai_orders: ['promotions'],
      smart_links: ['smart-links'],
      signatures: ['contracts'],
      vevo_channels: ['vevo'],
    };
    const requiredPages = pendingToPageMap[pendingKey] || [];
    return requiredPages.some(p => allowedPages.includes(p));
  };

  return { isTeam, isAdmin, allowedPages, loaded, canDelete, canChangeSettings, canViewPendingCategory };
}
