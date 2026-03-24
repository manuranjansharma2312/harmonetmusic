
-- Create notices table
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can do everything with notices"
  ON public.notices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view active notices
CREATE POLICY "Users can view active notices"
  ON public.notices FOR SELECT TO authenticated
  USING (is_active = true);

-- Create notice_reads table to track which users dismissed which notices
CREATE TABLE public.notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(notice_id, user_id)
);

ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reads"
  ON public.notice_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reads"
  ON public.notice_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reads"
  ON public.notice_reads FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for notice images
INSERT INTO storage.buckets (id, name, public) VALUES ('notice-images', 'notice-images', true);

CREATE POLICY "Admins can upload notice images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notice-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view notice images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notice-images');

CREATE POLICY "Admins can delete notice images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notice-images' AND has_role(auth.uid(), 'admin'::app_role));
