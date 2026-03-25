
-- Create a helper function to check if current user is parent of a given user
CREATE OR REPLACE FUNCTION public.is_parent_label(_child_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sub_labels
    WHERE parent_user_id = auth.uid()
      AND sub_user_id = _child_user_id
      AND status = 'active'
  )
$$;

-- Allow parent labels to view sub-label releases
CREATE POLICY "Parent labels can view sub-label releases"
ON public.releases FOR SELECT TO authenticated
USING (public.is_parent_label(user_id));

-- Allow parent labels to view sub-label tracks
CREATE POLICY "Parent labels can view sub-label tracks"
ON public.tracks FOR SELECT TO authenticated
USING (public.is_parent_label(user_id));

-- Allow parent labels to view sub-label songs
CREATE POLICY "Parent labels can view sub-label songs"
ON public.songs FOR SELECT TO authenticated
USING (public.is_parent_label(user_id));
