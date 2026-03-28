
CREATE TABLE public.branding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'Harmonet Music',
  tagline text NOT NULL DEFAULT 'Harmony On Networks',
  favicon_url text DEFAULT NULL,
  logo_url text DEFAULT NULL,
  login_logo_height integer NOT NULL DEFAULT 64,
  sidebar_logo_height integer NOT NULL DEFAULT 56,
  sidebar_collapsed_logo_height integer NOT NULL DEFAULT 28,
  mobile_header_logo_height integer NOT NULL DEFAULT 36,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL
);

ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access branding_settings"
  ON public.branding_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view branding_settings"
  ON public.branding_settings FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.branding_settings (site_name, tagline) VALUES ('Harmonet Music', 'Harmony On Networks');
