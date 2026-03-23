
-- Create labels table
CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label_name text NOT NULL,
  b2b_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own labels" ON public.labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own labels" ON public.labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending labels" ON public.labels FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users can delete own pending labels" ON public.labels FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

-- Admin policies
CREATE POLICY "Admins can view all labels" ON public.labels FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update any label" ON public.labels FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete any label" ON public.labels FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER labels_updated_at BEFORE UPDATE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- B2B storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('b2b-documents', 'b2b-documents', false);

-- B2B storage policies
CREATE POLICY "Users can upload own b2b docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'b2b-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own b2b docs" ON storage.objects FOR SELECT USING (bucket_id = 'b2b-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can view all b2b docs" ON storage.objects FOR SELECT USING (bucket_id = 'b2b-documents' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete b2b docs" ON storage.objects FOR DELETE USING (bucket_id = 'b2b-documents' AND has_role(auth.uid(), 'admin'::app_role));
