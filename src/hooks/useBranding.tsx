import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import logoWhite from '@/assets/logo-white.png';

const BRANDING_CACHE_KEY = 'branding-settings-cache-v1';

export interface BrandingSettings {
  site_name: string;
  tagline: string;
  favicon_url: string | null;
  logo_url: string | null;
  login_logo_height: number;
  sidebar_logo_height: number;
  sidebar_collapsed_logo_height: number;
  mobile_header_logo_height: number;
}

const DEFAULTS: BrandingSettings = {
  site_name: 'Harmonet Music',
  tagline: 'Harmony On Networks',
  favicon_url: null,
  logo_url: null,
  login_logo_height: 48,
  sidebar_logo_height: 40,
  sidebar_collapsed_logo_height: 28,
  mobile_header_logo_height: 32,
};

function readCachedBranding(): BrandingSettings | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(BRANDING_CACHE_KEY);
    if (!cached) return null;

    return {
      ...DEFAULTS,
      ...JSON.parse(cached),
    } as BrandingSettings;
  } catch {
    return null;
  }
}

export function useBranding() {
  const { data, isLoading } = useQuery({
    queryKey: ['branding-settings'],
    initialData: () => readCachedBranding() ?? DEFAULTS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error || !data) return DEFAULTS;
      const branding = {
        site_name: (data as any).site_name ?? DEFAULTS.site_name,
        tagline: (data as any).tagline ?? DEFAULTS.tagline,
        favicon_url: (data as any).favicon_url ?? null,
        logo_url: (data as any).logo_url ?? null,
        login_logo_height: (data as any).login_logo_height ?? DEFAULTS.login_logo_height,
        sidebar_logo_height: (data as any).sidebar_logo_height ?? DEFAULTS.sidebar_logo_height,
        sidebar_collapsed_logo_height: (data as any).sidebar_collapsed_logo_height ?? DEFAULTS.sidebar_collapsed_logo_height,
        mobile_header_logo_height: (data as any).mobile_header_logo_height ?? DEFAULTS.mobile_header_logo_height,
      } as BrandingSettings;

      try {
        localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
      } catch {}

      return branding;
    },
    staleTime: 5 * 60 * 1000,
  });

  const logoSrc = data?.logo_url || logoWhite;

  return {
    branding: data || DEFAULTS,
    logoSrc,
    isLoading,
  };
}
