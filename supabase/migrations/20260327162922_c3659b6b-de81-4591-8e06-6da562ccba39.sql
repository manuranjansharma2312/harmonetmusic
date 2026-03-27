
-- Signature Documents
CREATE TABLE public.signature_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  document_url text NOT NULL,
  document_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  signed_pdf_url text,
  certificate_url text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access signature_documents" ON public.signature_documents
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Signature Recipients
CREATE TABLE public.signature_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  signing_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  signing_token text UNIQUE,
  token_expires_at timestamp with time zone,
  signed_at timestamp with time zone,
  signature_data text,
  signature_type text,
  ip_address text,
  user_agent text,
  geolocation text,
  otp_verified boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access signature_recipients" ON public.signature_recipients
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can view by token" ON public.signature_recipients
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update by token" ON public.signature_recipients
  FOR UPDATE TO anon USING (true);

-- Signature Fields (positions on PDF)
CREATE TABLE public.signature_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.signature_recipients(id) ON DELETE CASCADE,
  page_number integer NOT NULL DEFAULT 1,
  x_position numeric NOT NULL,
  y_position numeric NOT NULL,
  width numeric NOT NULL DEFAULT 200,
  height numeric NOT NULL DEFAULT 80,
  signed boolean NOT NULL DEFAULT false,
  signature_image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access signature_fields" ON public.signature_fields
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can view signature_fields" ON public.signature_fields
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update signature_fields" ON public.signature_fields
  FOR UPDATE TO anon USING (true);

-- Signature Audit Logs
CREATE TABLE public.signature_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.signature_documents(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.signature_recipients(id) ON DELETE SET NULL,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access signature_audit_logs" ON public.signature_audit_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can insert audit logs" ON public.signature_audit_logs
  FOR INSERT TO anon WITH CHECK (true);

-- Signature OTP Logs
CREATE TABLE public.signature_otp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.signature_recipients(id) ON DELETE CASCADE,
  otp_code text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_otp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access signature_otp_logs" ON public.signature_otp_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can manage otp_logs" ON public.signature_otp_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Storage bucket for signature documents
INSERT INTO storage.buckets (id, name, public) VALUES ('signature-documents', 'signature-documents', false);

-- Storage policies
CREATE POLICY "Admins can upload signature docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signature-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view signature docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'signature-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete signature docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'signature-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can view signature docs for signing" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'signature-documents');

-- Trigger for updated_at
CREATE TRIGGER update_signature_documents_updated_at BEFORE UPDATE ON public.signature_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signature_recipients_updated_at BEFORE UPDATE ON public.signature_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
