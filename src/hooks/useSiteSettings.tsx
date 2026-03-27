import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SiteSettings {
  id: string;
  enable_background_animations: boolean;
  enable_anti_inspection: boolean;
  query_stale_time: number;
  query_cache_time: number;
  query_retry_count: number;
  enable_lazy_loading: boolean;
  image_quality: number;
  enable_image_lazy_load: boolean;
  enable_page_transitions: boolean;
  max_table_rows: number;
  updated_at: string;
  updated_by: string | null;
}

const DEFAULTS: SiteSettings = {
  id: '',
  enable_background_animations: true,
  enable_anti_inspection: true,
  query_stale_time: 60000,
  query_cache_time: 300000,
  query_retry_count: 1,
  enable_lazy_loading: true,
  image_quality: 80,
  enable_image_lazy_load: true,
  enable_page_transitions: true,
  max_table_rows: 50,
  updated_at: '',
  updated_by: null,
};

export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SiteSettings) ?? DEFAULTS;
    },
    staleTime: 120000,
    gcTime: 600000,
  });

  return { settings: data ?? DEFAULTS, isLoading };
}
