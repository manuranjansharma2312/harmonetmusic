
ALTER TABLE public.labels ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS rejection_reason text;
