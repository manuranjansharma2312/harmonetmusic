
-- Create OTT report format table
CREATE TABLE public.ott_report_format (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL,
  csv_header text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ott_report_format ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access ott_report_format" ON public.ott_report_format FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view ott_report_format" ON public.ott_report_format FOR SELECT TO authenticated USING (true);

-- Create YouTube report format table
CREATE TABLE public.youtube_report_format (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL,
  csv_header text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_report_format ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access youtube_report_format" ON public.youtube_report_format FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view youtube_report_format" ON public.youtube_report_format FOR SELECT TO authenticated USING (true);

-- Add extra_data to report_entries and youtube_report_entries
ALTER TABLE public.report_entries ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.youtube_report_entries ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT '{}'::jsonb;

-- Seed default columns for OTT
INSERT INTO public.ott_report_format (column_key, csv_header, is_enabled, is_required, sort_order) VALUES
('reporting_month', 'Reporting Month', true, true, 0),
('store', 'Store', true, false, 1),
('sales_type', 'Sales Type', true, false, 2),
('country', 'Country', true, false, 3),
('label', 'Label', true, false, 4),
('c_line', 'C Line', true, false, 5),
('p_line', 'P Line', true, false, 6),
('track', 'Track', true, false, 7),
('artist', 'Artist', true, false, 8),
('isrc', 'ISRC', true, true, 9),
('upc', 'UPC', true, false, 10),
('currency', 'Currency', true, false, 11),
('streams', 'Streams', true, false, 12),
('downloads', 'Downloads', true, false, 13),
('net_generated_revenue', 'Net Generated Revenue', true, true, 14);

-- Seed default columns for YouTube
INSERT INTO public.youtube_report_format (column_key, csv_header, is_enabled, is_required, sort_order) VALUES
('reporting_month', 'Reporting Month', true, true, 0),
('store', 'Store', true, false, 1),
('sales_type', 'Sales Type', true, false, 2),
('country', 'Country', true, false, 3),
('label', 'Label', true, false, 4),
('c_line', 'C Line', true, false, 5),
('p_line', 'P Line', true, false, 6),
('track', 'Track', true, false, 7),
('artist', 'Artist', true, false, 8),
('isrc', 'ISRC', true, true, 9),
('upc', 'UPC', true, false, 10),
('currency', 'Currency', true, false, 11),
('streams', 'Streams', true, false, 12),
('downloads', 'Downloads', true, false, 13),
('net_generated_revenue', 'Net Generated Revenue', true, true, 14);
