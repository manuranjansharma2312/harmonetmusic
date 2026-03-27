
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Performance
  enable_background_animations boolean NOT NULL DEFAULT true,
  enable_anti_inspection boolean NOT NULL DEFAULT true,
  query_stale_time integer NOT NULL DEFAULT 60000,
  query_cache_time integer NOT NULL DEFAULT 300000,
  query_retry_count integer NOT NULL DEFAULT 1,
  enable_lazy_loading boolean NOT NULL DEFAULT true,
  -- Image optimization
  image_quality integer NOT NULL DEFAULT 80,
  enable_image_lazy_load boolean NOT NULL DEFAULT true,
  -- UI
  enable_page_transitions boolean NOT NULL DEFAULT true,
  max_table_rows integer NOT NULL DEFAULT 50,
  -- Meta
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update site_settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert site_settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.site_settings (id) VALUES (gen_random_uuid());
