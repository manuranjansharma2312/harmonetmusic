
CREATE TABLE public.vevo_report_format (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL UNIQUE,
  csv_header text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vevo_report_format ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vevo report format"
ON public.vevo_report_format FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view vevo report format"
ON public.vevo_report_format FOR SELECT TO authenticated
USING (true);

-- Seed default columns
INSERT INTO public.vevo_report_format (column_key, csv_header, is_enabled, is_required, sort_order) VALUES
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
