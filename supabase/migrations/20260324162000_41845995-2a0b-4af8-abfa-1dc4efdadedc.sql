
CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with tutorials"
  ON public.tutorials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view tutorials"
  ON public.tutorials FOR SELECT TO authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('tutorial-images', 'tutorial-images', true);

CREATE POLICY "Admins can upload tutorial images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tutorial-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view tutorial images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tutorial-images');

CREATE POLICY "Admins can delete tutorial images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tutorial-images' AND has_role(auth.uid(), 'admin'::app_role));
