
CREATE TABLE public.smart_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  artist_name text NOT NULL DEFAULT '',
  poster_url text,
  slug text UNIQUE,
  platform_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_links ENABLE ROW LEVEL SECURITY;

-- Users can manage their own smart links
CREATE POLICY "Users can view own smart_links" ON public.smart_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own smart_links" ON public.smart_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smart_links" ON public.smart_links
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own smart_links" ON public.smart_links
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins full access smart_links" ON public.smart_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public can view smart links with platform_links for the public page
CREATE POLICY "Public can view smart_links with links" ON public.smart_links
  FOR SELECT TO anon USING (platform_links <> '{}'::jsonb);

-- Slug generation trigger for smart_links
CREATE OR REPLACE FUNCTION public.generate_smart_link_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug text; final_slug text; counter integer := 0;
BEGIN
  base_slug := COALESCE(NULLIF(trim(NEW.title), ''), substring(NEW.id::text from 1 for 8));
  base_slug := trim(both '-' from lower(regexp_replace(trim(base_slug), '[^a-z0-9]+', '-', 'gi')));
  IF base_slug = '' THEN base_slug := substring(NEW.id::text from 1 for 8); END IF;
  final_slug := base_slug;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.smart_links WHERE slug = final_slug AND id != NEW.id);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.releases WHERE slug = final_slug);
    counter := counter + 1; final_slug := base_slug || '-' || counter;
  END LOOP;
  -- Also check against releases slugs to avoid collision
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.releases WHERE slug = final_slug);
    counter := counter + 1; final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_smart_link_slug_trigger
  BEFORE INSERT OR UPDATE OF title ON public.smart_links
  FOR EACH ROW EXECUTE FUNCTION public.generate_smart_link_slug();
