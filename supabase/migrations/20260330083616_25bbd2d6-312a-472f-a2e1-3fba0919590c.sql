
CREATE OR REPLACE FUNCTION public.cleanup_old_email_logs()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  DELETE FROM public.email_send_logs
  WHERE sent_at < now() - interval '14 days';
$$;
