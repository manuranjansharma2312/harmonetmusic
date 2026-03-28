
-- Create youtube_cms_links table
CREATE TABLE public.youtube_cms_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_name text NOT NULL,
  channel_url text NOT NULL,
  is_monetized boolean NOT NULL DEFAULT false,
  noc_file_url text,
  status text NOT NULL DEFAULT 'pending_review',
  rejection_reason text,
  cms_linked_date date,
  cms_company text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_cms_links ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access youtube_cms_links"
  ON public.youtube_cms_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert own
CREATE POLICY "Users can insert own youtube_cms_links"
  ON public.youtube_cms_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view own
CREATE POLICY "Users can view own youtube_cms_links"
  ON public.youtube_cms_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own pending
CREATE POLICY "Users can delete own pending youtube_cms_links"
  ON public.youtube_cms_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending_review');

-- Storage bucket for NOC files
INSERT INTO storage.buckets (id, name, public) VALUES ('cms-noc-files', 'cms-noc-files', false);

-- Storage policies for cms-noc-files
CREATE POLICY "Users can upload own NOC files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cms-noc-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own NOC files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cms-noc-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all NOC files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cms-noc-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete NOC files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cms-noc-files' AND has_role(auth.uid(), 'admin'::app_role));
