
-- Add revenue_frozen column to report_entries
ALTER TABLE public.report_entries ADD COLUMN revenue_frozen boolean NOT NULL DEFAULT false;

-- Add revenue_frozen column to youtube_report_entries
ALTER TABLE public.youtube_report_entries ADD COLUMN revenue_frozen boolean NOT NULL DEFAULT false;
