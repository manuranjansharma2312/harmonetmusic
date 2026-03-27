
ALTER TABLE public.smart_links ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL;

-- Function to auto-delete rejected smart links older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_rejected_smart_links()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.smart_links
  WHERE status = 'rejected'
    AND updated_at < NOW() - INTERVAL '1 hour';
END;
$$;
