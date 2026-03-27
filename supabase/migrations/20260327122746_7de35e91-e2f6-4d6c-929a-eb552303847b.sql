
-- Create email_accounts table for multiple SMTP accounts
CREATE TABLE public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_username text NOT NULL DEFAULT '',
  smtp_password text NOT NULL DEFAULT '',
  smtp_encryption text NOT NULL DEFAULT 'tls',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  reply_to_email text DEFAULT '',
  provider text NOT NULL DEFAULT 'smtp',
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with email_accounts"
  ON public.email_accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add email_account_id to email_templates to assign specific account per template
ALTER TABLE public.email_templates ADD COLUMN email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL;
