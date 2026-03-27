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
  auto_clear_cache_enabled: boolean;
  auto_clear_cache_interval: number;
  enable_error_reporting: boolean;
  enable_toast_notifications: boolean;
  toast_duration: number;
  enable_realtime: boolean;
  session_timeout: number;
  enable_prefetch: boolean;
  max_upload_size_mb: number;
  enable_console_logs: boolean;
  debounce_delay: number;
  enable_text_selection: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
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
  auto_clear_cache_enabled: false,
  auto_clear_cache_interval: 3600000,
  enable_error_reporting: true,
  enable_toast_notifications: true,
  toast_duration: 4000,
  enable_realtime: true,
  session_timeout: 0,
  enable_prefetch: true,
  max_upload_size_mb: 50,
  enable_console_logs: false,
  debounce_delay: 300,
  enable_text_selection: false,
  maintenance_mode: false,
  maintenance_message: 'We are currently performing maintenance. Please check back soon.',
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
      const settings = (data as unknown as SiteSettings) ?? DEFAULTS;
      try {
        localStorage.setItem('site_anti_inspection', String(settings.enable_anti_inspection));
        localStorage.setItem('site_maintenance', JSON.stringify({
          enabled: settings.maintenance_mode,
          message: settings.maintenance_message,
        }));
      } catch {}
      return settings;
    },
    staleTime: 120000,
    gcTime: 600000,
  });

  return { settings: data ?? DEFAULTS, isLoading };
}
