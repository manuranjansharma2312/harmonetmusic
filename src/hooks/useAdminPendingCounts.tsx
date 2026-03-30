import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminPendingCounts {
  releases: number;
  contentRequests: number;
  labels: number;
  promotionOrders: number;
  cmsWithdrawals: number;
  subLabelWithdrawals: number;
  videoSubmissions: number;
  vevoChannels: number;
  ytCmsLinks: number;
}

const empty: AdminPendingCounts = {
  releases: 0,
  contentRequests: 0,
  labels: 0,
  promotionOrders: 0,
  cmsWithdrawals: 0,
  subLabelWithdrawals: 0,
  videoSubmissions: 0,
  vevoChannels: 0,
  ytCmsLinks: 0,
};

export function useAdminPendingCounts(enabled: boolean) {
  const [counts, setCounts] = useState<AdminPendingCounts>(empty);

  useEffect(() => {
    if (!enabled) return;

    const fetchCounts = async () => {
      const [
        { count: releases },
        { count: contentRequests },
        { count: labels },
        { count: promotionOrders },
        { count: cmsWithdrawals },
        { count: subLabelWithdrawals },
        { count: videoSubmissions },
        { count: vevoChannels },
        { count: ytCmsLinks },
      ] = await Promise.all([
        supabase.from('releases').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('content_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('labels').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('promotion_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('cms_withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('sub_label_withdrawal_requests' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('video_submissions' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('vevo_channel_requests' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('youtube_cms_links' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setCounts({
        releases: releases || 0,
        contentRequests: contentRequests || 0,
        labels: labels || 0,
        promotionOrders: promotionOrders || 0,
        cmsWithdrawals: cmsWithdrawals || 0,
        subLabelWithdrawals: subLabelWithdrawals || 0,
        videoSubmissions: videoSubmissions || 0,
        vevoChannels: vevoChannels || 0,
        ytCmsLinks: ytCmsLinks || 0,
      });
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [enabled]);

  return counts;
}
