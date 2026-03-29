
-- Add cut_percent to youtube_cms_links for the % set during approval
ALTER TABLE public.youtube_cms_links ADD COLUMN IF NOT EXISTS cut_percent numeric NOT NULL DEFAULT 0;

-- CMS Report Format table (dynamic column template like youtube_report_format)
CREATE TABLE public.cms_report_format (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL,
  csv_header text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cms_report_format ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access cms_report_format" ON public.cms_report_format FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view cms_report_format" ON public.cms_report_format FOR SELECT TO authenticated USING (true);

-- Insert default columns
INSERT INTO public.cms_report_format (column_key, csv_header, is_required, sort_order) VALUES
  ('reporting_month', 'Reporting Month', true, 0),
  ('channel_name', 'Channel Name', true, 1),
  ('label', 'Label', false, 2),
  ('track', 'Track', false, 3),
  ('artist', 'Artist', false, 4),
  ('currency', 'Currency', false, 5),
  ('streams', 'Streams', false, 6),
  ('downloads', 'Downloads', false, 7),
  ('net_generated_revenue', 'Net Generated Revenue', true, 8);

-- CMS Report Entries table
CREATE TABLE public.cms_report_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL,
  reporting_month text NOT NULL,
  label text,
  track text,
  artist text,
  currency text,
  streams bigint DEFAULT 0,
  downloads bigint DEFAULT 0,
  net_generated_revenue numeric DEFAULT 0,
  extra_data jsonb DEFAULT '{}'::jsonb,
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cms_report_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access cms_report_entries" ON public.cms_report_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view cms_report_entries by channel" ON public.cms_report_entries FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.youtube_cms_links
    WHERE youtube_cms_links.user_id = auth.uid()
      AND youtube_cms_links.status = 'linked'
      AND youtube_cms_links.channel_name = cms_report_entries.channel_name
  )
);

-- CMS Settings table (threshold etc)
CREATE TABLE public.cms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_threshold numeric NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access cms_settings" ON public.cms_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view cms_settings" ON public.cms_settings FOR SELECT TO authenticated USING (true);

-- Insert default settings
INSERT INTO public.cms_settings (withdrawal_threshold) VALUES (1000);

-- CMS Withdrawal Requests
CREATE TABLE public.cms_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cms_withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access cms_withdrawal_requests" ON public.cms_withdrawal_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own cms_withdrawal_requests" ON public.cms_withdrawal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own cms_withdrawal_requests" ON public.cms_withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
