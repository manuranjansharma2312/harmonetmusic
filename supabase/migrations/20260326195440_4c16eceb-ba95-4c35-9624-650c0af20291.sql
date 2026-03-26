
-- Add columns
ALTER TABLE public.releases 
  ADD COLUMN IF NOT EXISTS platform_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS slug text;

-- Set all slugs to full UUID (guaranteed unique)
UPDATE public.releases SET slug = id::text;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS releases_slug_unique ON public.releases (slug) WHERE slug IS NOT NULL;

-- Auto-generate readable slug on insert
CREATE OR REPLACE FUNCTION public.generate_release_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  base_slug text; final_slug text; counter integer := 0;
BEGIN
  base_slug := COALESCE(NULLIF(NEW.album_name, ''), NULLIF(NEW.ep_name, ''));
  IF base_slug IS NULL THEN base_slug := substring(NEW.id::text from 1 for 8); END IF;
  base_slug := trim(both '-' from lower(regexp_replace(trim(base_slug), '[^a-z0-9]+', '-', 'gi')));
  IF base_slug = '' THEN base_slug := substring(NEW.id::text from 1 for 8); END IF;
  final_slug := base_slug;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.releases WHERE slug = final_slug AND id != NEW.id);
    counter := counter + 1; final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_generate_release_slug ON public.releases;
CREATE TRIGGER trigger_generate_release_slug BEFORE INSERT ON public.releases
  FOR EACH ROW WHEN (NEW.slug IS NULL) EXECUTE FUNCTION public.generate_release_slug();

-- Public RLS for smart link pages
CREATE POLICY "Public can view approved releases for smart links"
ON public.releases FOR SELECT TO anon
USING (status = 'approved' AND platform_links != '{}'::jsonb);
