ALTER TABLE public.cms_report_entries ADD COLUMN revenue_frozen boolean NOT NULL DEFAULT false;

CREATE INDEX idx_cms_report_entries_frozen ON public.cms_report_entries (channel_name, revenue_frozen);