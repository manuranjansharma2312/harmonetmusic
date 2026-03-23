-- Create youtube_report_entries table (same schema as report_entries)
CREATE TABLE public.youtube_report_entries (
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
  net_generated_revenue numeric DEFAULT 0,
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_report_entries ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can insert youtube report entries"
ON public.youtube_report_entries FOR INSERT TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update youtube report entries"
ON public.youtube_report_entries FOR UPDATE TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete youtube report entries"
ON public.youtube_report_entries FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- ISRC-based user SELECT (same pattern as report_entries)
CREATE POLICY "Users can view youtube report entries matching their ISRCs"
ON public.youtube_report_entries FOR SELECT TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.user_owns_isrc(auth.uid(), isrc)
);
