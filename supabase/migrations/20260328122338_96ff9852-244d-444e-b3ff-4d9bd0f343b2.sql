
CREATE TABLE public.video_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.video_guidelines ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can read video guidelines"
  ON public.video_guidelines FOR SELECT TO authenticated USING (true);

-- Only admins can update
CREATE POLICY "Admins can update video guidelines"
  ON public.video_guidelines FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Only admins can insert
CREATE POLICY "Admins can insert video guidelines"
  ON public.video_guidelines FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Seed one row
INSERT INTO public.video_guidelines (content) VALUES ('');
