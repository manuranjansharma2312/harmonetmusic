
-- Create sub_labels table
CREATE TABLE public.sub_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  sub_user_id uuid,
  parent_label_name text NOT NULL,
  sub_label_name text NOT NULL,
  agreement_start_date date NOT NULL,
  agreement_end_date date NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  percentage_cut numeric NOT NULL DEFAULT 0,
  b2b_url text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_labels ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access sub_labels" ON public.sub_labels FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Parent can view their sub-labels
CREATE POLICY "Parent view sub_labels" ON public.sub_labels FOR SELECT TO authenticated
USING (auth.uid() = parent_user_id);

-- Parent can insert sub-labels
CREATE POLICY "Parent insert sub_labels" ON public.sub_labels FOR INSERT TO authenticated
WITH CHECK (auth.uid() = parent_user_id);

-- Parent can update own sub-labels
CREATE POLICY "Parent update sub_labels" ON public.sub_labels FOR UPDATE TO authenticated
USING (auth.uid() = parent_user_id);

-- Sub-user can view own record
CREATE POLICY "Sub user view own record" ON public.sub_labels FOR SELECT TO authenticated
USING (auth.uid() = sub_user_id);

-- Updated at trigger
CREATE TRIGGER update_sub_labels_updated_at BEFORE UPDATE ON public.sub_labels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update user_owns_isrc to include sub-label ISRCs for parent labels
CREATE OR REPLACE FUNCTION public.user_owns_isrc(_user_id uuid, _isrc text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
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
$$;
