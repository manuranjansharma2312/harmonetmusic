
ALTER TABLE public.smart_link_settings
  ADD COLUMN IF NOT EXISTS auto_fetch_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS search_enabled boolean NOT NULL DEFAULT false;
