
ALTER TABLE public.signature_settings 
ADD COLUMN IF NOT EXISTS issued_by_name text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS issued_by_address text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS issued_by_email text NOT NULL DEFAULT '';
