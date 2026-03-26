CREATE OR REPLACE FUNCTION public.cleanup_old_ai_images()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_generated_images
  WHERE created_at < NOW() - INTERVAL '12 hours';
END;
$$;