
-- Remove user-level DELETE policies — only admins can delete files
DROP POLICY IF EXISTS "Users can delete own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own posters" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own video uploads" ON storage.objects;

-- Remove user-level DELETE from database tables (RLS policies)
-- Prevent users from deleting releases
DROP POLICY IF EXISTS "Users can delete own pending releases" ON public.releases;
CREATE POLICY "Only admins can delete releases" ON public.releases
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Prevent users from deleting labels
DROP POLICY IF EXISTS "Users can delete own labels" ON public.labels;
CREATE POLICY "Only admins can delete labels" ON public.labels
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Prevent users from deleting smart_links
DROP POLICY IF EXISTS "Users can delete own smart links" ON public.smart_links;
CREATE POLICY "Only admins can delete smart_links" ON public.smart_links
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Prevent users from deleting tracks
DROP POLICY IF EXISTS "Users can delete own tracks" ON public.tracks;
CREATE POLICY "Only admins can delete tracks" ON public.tracks
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
