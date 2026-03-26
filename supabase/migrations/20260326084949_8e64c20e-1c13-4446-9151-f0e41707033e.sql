
CREATE TABLE public.contact_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.contact_support ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with contact_support"
  ON public.contact_support FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view contact_support"
  ON public.contact_support FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.contact_support (content) VALUES ('');
