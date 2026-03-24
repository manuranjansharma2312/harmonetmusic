
CREATE TABLE public.company_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  registration_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with company_details"
ON public.company_details FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view company_details"
ON public.company_details FOR SELECT TO authenticated
USING (true);
