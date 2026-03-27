
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS auto_clear_cache_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_clear_cache_interval integer NOT NULL DEFAULT 3600000,
  ADD COLUMN IF NOT EXISTS enable_error_reporting boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_toast_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS toast_duration integer NOT NULL DEFAULT 4000,
  ADD COLUMN IF NOT EXISTS enable_realtime boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS session_timeout integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enable_prefetch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_upload_size_mb integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS enable_console_logs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS debounce_delay integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS enable_text_selection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT 'We are currently performing maintenance. Please check back soon.';
