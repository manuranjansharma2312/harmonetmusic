
-- Create a security definer function to check if a user owns a track with a given ISRC
CREATE OR REPLACE FUNCTION public.user_owns_isrc(_user_id uuid, _isrc text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tracks WHERE user_id = _user_id AND upper(isrc) = upper(_isrc)
    UNION ALL
    SELECT 1 FROM public.songs WHERE user_id = _user_id AND upper(isrc) = upper(_isrc)
  )
$$;

-- Drop the old user SELECT policy
DROP POLICY IF EXISTS "Users can view own report entries" ON public.report_entries;

-- Create new ISRC-based user SELECT policy
CREATE POLICY "Users can view report entries matching their ISRCs"
ON public.report_entries
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.user_owns_isrc(auth.uid(), isrc)
);

-- Drop the old admin SELECT policy since we combined it
DROP POLICY IF EXISTS "Admins can view all report entries" ON public.report_entries;
