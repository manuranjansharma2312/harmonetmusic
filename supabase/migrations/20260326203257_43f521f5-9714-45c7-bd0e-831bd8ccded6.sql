
CREATE TABLE public.smart_link_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  api_key text DEFAULT '',
  api_url text DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_link_api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access smart_link_api_configs" ON public.smart_link_api_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with Songlink/Odesli as default option
INSERT INTO public.smart_link_api_configs (api_name, api_url, notes) VALUES
  ('Songlink / Odesli', 'https://api.song.link/v1-alpha.1/links', 'Auto-fetch platform links from a single URL. Get API key from https://odesli.co');
