CREATE TABLE public.signature_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_expiry_days integer NOT NULL DEFAULT 30,
  auto_send_completion boolean NOT NULL DEFAULT false,
  signing_email_subject text NOT NULL DEFAULT 'Please sign: {{document_title}}',
  signing_email_body text NOT NULL DEFAULT 'You have been requested to sign the following document.',
  completion_email_subject text NOT NULL DEFAULT 'Completed: {{document_title}} - Signed Document & Certificate',
  completion_email_body text NOT NULL DEFAULT 'The following document has been successfully signed by all parties.',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.signature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access signature_settings"
  ON public.signature_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view signature_settings"
  ON public.signature_settings FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.signature_settings (id) VALUES (gen_random_uuid());