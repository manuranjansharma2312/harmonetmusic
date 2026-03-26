
CREATE TABLE public.smart_link_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_url text,
  placeholder text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_link_platforms ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active platforms
CREATE POLICY "Anyone can view active platforms" ON public.smart_link_platforms
  FOR SELECT TO authenticated USING (is_active = true);

-- Admins full access
CREATE POLICY "Admins full access smart_link_platforms" ON public.smart_link_platforms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public (anon) can view for smart link pages
CREATE POLICY "Public can view active platforms" ON public.smart_link_platforms
  FOR SELECT TO anon USING (is_active = true);

-- Seed default platforms
INSERT INTO public.smart_link_platforms (name, placeholder, sort_order) VALUES
  ('Spotify', 'https://open.spotify.com/...', 1),
  ('Apple Music', 'https://music.apple.com/...', 2),
  ('YouTube Music', 'https://music.youtube.com/...', 3),
  ('JioSaavn', 'https://www.jiosaavn.com/...', 4),
  ('Gaana', 'https://gaana.com/...', 5),
  ('Amazon Music', 'https://music.amazon.com/...', 6),
  ('Wynk Music', 'https://wynk.in/...', 7),
  ('Instagram', 'https://www.instagram.com/...', 8),
  ('Hungama', 'https://www.hungama.com/...', 9),
  ('Resso', 'https://m.resso.com/...', 10);
