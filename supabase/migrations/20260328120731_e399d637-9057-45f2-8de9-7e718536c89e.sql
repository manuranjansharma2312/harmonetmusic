
-- Video Forms (admin-created form templates)
CREATE TABLE public.video_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  form_type text NOT NULL DEFAULT 'upload_video', -- 'upload_video' | 'vevo_channel'
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Video Form Fields (dynamic fields for each form)
CREATE TABLE public.video_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.video_forms(id) ON DELETE CASCADE,
  field_type text NOT NULL DEFAULT 'text', 
  label text NOT NULL,
  placeholder text DEFAULT '',
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb DEFAULT '[]'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Video Submissions (user submissions)
CREATE TABLE public.video_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.video_forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  submission_type text NOT NULL DEFAULT 'upload_video', -- 'upload_video' | 'vevo_channel'
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Video Submission Values (field values for each submission)
CREATE TABLE public.video_submission_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.video_submissions(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.video_form_fields(id) ON DELETE CASCADE,
  text_value text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_submission_values ENABLE ROW LEVEL SECURITY;

-- RLS for video_forms
CREATE POLICY "Admins full access video_forms" ON public.video_forms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view active video_forms" ON public.video_forms FOR SELECT TO authenticated
  USING (is_active = true);

-- RLS for video_form_fields
CREATE POLICY "Admins full access video_form_fields" ON public.video_form_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view fields of active forms" ON public.video_form_fields FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.video_forms WHERE id = form_id AND is_active = true));

-- RLS for video_submissions
CREATE POLICY "Admins full access video_submissions" ON public.video_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own video_submissions" ON public.video_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own video_submissions" ON public.video_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS for video_submission_values
CREATE POLICY "Admins full access video_submission_values" ON public.video_submission_values FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own submission values" ON public.video_submission_values FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.video_submissions WHERE id = submission_id AND user_id = auth.uid()));
CREATE POLICY "Users can view own submission values" ON public.video_submission_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.video_submissions WHERE id = submission_id AND user_id = auth.uid()));

-- Create storage bucket for video uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('video-uploads', 'video-uploads', true);

-- Storage policies for video-uploads bucket
CREATE POLICY "Authenticated users can upload video files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'video-uploads');
CREATE POLICY "Anyone can view video files" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'video-uploads');
CREATE POLICY "Admins can delete video files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'video-uploads' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_video_forms_updated_at BEFORE UPDATE ON public.video_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_submissions_updated_at BEFORE UPDATE ON public.video_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
