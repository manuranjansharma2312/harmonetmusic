
CREATE TABLE public.email_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  template_label text,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by text
);

ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs"
  ON public.email_send_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert email logs"
  ON public.email_send_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE INDEX idx_email_send_logs_sent_at ON public.email_send_logs(sent_at DESC);
CREATE INDEX idx_email_send_logs_status ON public.email_send_logs(status);
