
CREATE TABLE public.report_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reporting_month text NOT NULL,
  store text,
  sales_type text,
  country text,
  label text,
  c_line text,
  p_line text,
  track text,
  artist text,
  isrc text,
  upc text,
  currency text,
  streams bigint DEFAULT 0,
  downloads bigint DEFAULT 0,
  net_generated_revenue numeric(12,4) DEFAULT 0,
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.report_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own report entries" ON public.report_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all report entries" ON public.report_entries
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert report entries" ON public.report_entries
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete report entries" ON public.report_entries
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update report entries" ON public.report_entries
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
