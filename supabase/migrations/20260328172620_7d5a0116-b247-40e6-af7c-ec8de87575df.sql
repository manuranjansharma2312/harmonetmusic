ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS enable_vevo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_video_distribution boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_reports boolean NOT NULL DEFAULT true;