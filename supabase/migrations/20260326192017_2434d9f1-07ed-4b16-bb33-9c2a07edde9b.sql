
-- Fix: Guard user_owns_isrc against empty/null ISRC values
CREATE OR REPLACE FUNCTION public.user_owns_isrc(_user_id uuid, _isrc text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN _isrc IS NULL OR trim(_isrc) = '' THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.tracks WHERE user_id = _user_id AND upper(isrc) = upper(_isrc)
      UNION ALL
      SELECT 1 FROM public.songs WHERE user_id = _user_id AND upper(isrc) = upper(_isrc)
      UNION ALL
      SELECT 1 FROM public.tracks t
      INNER JOIN public.sub_labels sl ON sl.sub_user_id = t.user_id AND sl.status = 'active'
      WHERE sl.parent_user_id = _user_id AND upper(t.isrc) = upper(_isrc)
      UNION ALL
      SELECT 1 FROM public.songs s
      INNER JOIN public.sub_labels sl ON sl.sub_user_id = s.user_id AND sl.status = 'active'
      WHERE sl.parent_user_id = _user_id AND upper(s.isrc) = upper(_isrc)
    )
  END
$$;
