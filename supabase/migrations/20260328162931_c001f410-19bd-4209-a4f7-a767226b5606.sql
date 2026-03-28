
-- Create vevo_report_entries table (mirrors youtube_report_entries structure)
CREATE TABLE public.vevo_report_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  net_generated_revenue numeric DEFAULT 0,
  imported_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  cut_percent_snapshot numeric,
  revenue_frozen boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.vevo_report_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies (same as report_entries)
CREATE POLICY "Admins can insert vevo report entries"
  ON public.vevo_report_entries FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vevo report entries"
  ON public.vevo_report_entries FOR UPDATE TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vevo report entries"
  ON public.vevo_report_entries FOR DELETE TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own vevo report entries"
  ON public.vevo_report_entries FOR SELECT TO public
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = user_id)
    OR (user_owns_isrc(auth.uid(), isrc) AND is_parent_label(user_id))
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vevo_report_entries;
