
CREATE TABLE public.terms_and_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.terms_and_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view terms"
ON public.terms_and_conditions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can update terms"
ON public.terms_and_conditions FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert terms"
ON public.terms_and_conditions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial row
INSERT INTO public.terms_and_conditions (content) VALUES ('');
