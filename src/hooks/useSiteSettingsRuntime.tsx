import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSiteSettings } from './useSiteSettings';

/**
 * Applies site-settings-driven runtime behaviors:
 * - Auto cache clear at configured interval
 * - Session timeout (auto-logout)
 * - Text selection control
 */
export function useSiteSettingsRuntime() {
  const { settings } = useSiteSettings();
  const queryClient = useQueryClient();
  const cacheTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityRef = useRef(Date.now());

  // Auto clear cache
  useEffect(() => {
    if (cacheTimerRef.current) {
      clearInterval(cacheTimerRef.current);
      cacheTimerRef.current = null;
    }
    if (settings.auto_clear_cache_enabled && settings.auto_clear_cache_interval > 0) {
      cacheTimerRef.current = setInterval(() => {
        queryClient.clear();
        console.log('[SiteSettings] Auto-cleared cache');
      }, settings.auto_clear_cache_interval);
    }
    return () => {
      if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
    };
  }, [settings.auto_clear_cache_enabled, settings.auto_clear_cache_interval, queryClient]);

  // Session timeout
  useEffect(() => {
    if (settings.session_timeout <= 0) return;
    const timeoutMs = settings.session_timeout * 60 * 1000;

    const resetTimer = () => {
      activityRef.current = Date.now();
    };

    const checkTimeout = () => {
      if (Date.now() - activityRef.current > timeoutMs) {
        // Import dynamically to avoid circular deps
        import('@/integrations/supabase/client').then(({ supabase }) => {
          supabase.auth.signOut();
          window.location.href = '/auth';
        });
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    sessionTimerRef.current = setInterval(checkTimeout, 60000);

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [settings.session_timeout]);

  // Text selection control
  useEffect(() => {
    if (settings.enable_text_selection) {
      document.body.style.userSelect = '';
    } else {
      document.body.style.userSelect = 'none';
    }
    return () => { document.body.style.userSelect = ''; };
  }, [settings.enable_text_selection]);
}
