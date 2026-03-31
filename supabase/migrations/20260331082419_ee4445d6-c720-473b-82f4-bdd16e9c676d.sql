CREATE OR REPLACE FUNCTION public.label_name_exists(_name text, _exclude_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.labels
    WHERE lower(trim(label_name)) = lower(trim(_name))
    AND (_exclude_id IS NULL OR id != _exclude_id)
  )
$$;