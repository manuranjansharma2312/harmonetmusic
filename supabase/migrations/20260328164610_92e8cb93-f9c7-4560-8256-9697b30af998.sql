
ALTER TABLE public.vevo_report_entries ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.vevo_report_format ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
