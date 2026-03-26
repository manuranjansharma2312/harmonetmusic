
ALTER TABLE public.report_entries
  ADD COLUMN IF NOT EXISTS cut_percent_snapshot numeric DEFAULT NULL;

ALTER TABLE public.youtube_report_entries
  ADD COLUMN IF NOT EXISTS cut_percent_snapshot numeric DEFAULT NULL;
