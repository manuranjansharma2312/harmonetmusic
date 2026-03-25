
-- Drop and recreate the user update policy for releases to allow pending AND rejected
DROP POLICY IF EXISTS "Users can update own pending releases" ON public.releases;
CREATE POLICY "Users can update own pending or rejected releases"
ON public.releases
FOR UPDATE
TO public
USING ((auth.uid() = user_id) AND (status IN ('pending', 'rejected')));

-- Drop and recreate the user update policy for tracks
DROP POLICY IF EXISTS "Users can update own tracks" ON public.tracks;
CREATE POLICY "Users can update own tracks"
ON public.tracks
FOR UPDATE
TO public
USING (
  (auth.uid() = user_id) AND EXISTS (
    SELECT 1 FROM public.releases r
    WHERE r.id = release_id AND r.status IN ('pending', 'rejected')
  )
);
