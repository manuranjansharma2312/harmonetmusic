-- Create a function to delete AI generated images older than 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_ai_images()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.ai_generated_images
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;