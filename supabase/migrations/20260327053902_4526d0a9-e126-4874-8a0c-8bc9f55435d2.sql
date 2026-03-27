
-- Add status column to smart_links (pending by default, admin must approve)
ALTER TABLE public.smart_links ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Update existing smart links to approved (backwards compat)
UPDATE public.smart_links SET status = 'approved' WHERE status = 'pending';

-- Update RLS: public/anon can only view approved smart links
DROP POLICY IF EXISTS "Public can view smart_links with links" ON public.smart_links;
CREATE POLICY "Public can view approved smart_links with links"
ON public.smart_links FOR SELECT TO anon
USING (status = 'approved' AND platform_links <> '{}'::jsonb);
