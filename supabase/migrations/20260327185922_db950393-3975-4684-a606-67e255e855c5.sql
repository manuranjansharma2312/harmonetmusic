
ALTER TABLE public.signature_settings 
ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL DEFAULT NULL;
