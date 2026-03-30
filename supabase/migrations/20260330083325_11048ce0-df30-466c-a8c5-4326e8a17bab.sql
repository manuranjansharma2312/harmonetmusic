
-- Allow admins to delete email logs
CREATE POLICY "Admins can delete email logs"
ON public.email_send_logs
FOR DELETE
TO authenticated
USING (is_admin());

-- Create a function to auto-delete logs older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_email_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.email_send_logs
  WHERE sent_at < now() - interval '7 days';
$$;
