import { useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';

/** Dynamically sets the document title and favicon from branding_settings */
export function BrandingHead() {
  const { branding } = useBranding();

  useEffect(() => {
    // Update page title
    document.title = branding.tagline
      ? `${branding.site_name} - ${branding.tagline}`
      : branding.site_name;

    // Update favicon if set
    if (branding.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding.site_name, branding.tagline, branding.favicon_url]);

  return null;
}
