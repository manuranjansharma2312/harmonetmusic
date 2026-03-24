
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_name text NOT NULL,
  user_display_id integer NOT NULL,
  invoice_date date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric NOT NULL,
  harmonet_share_percent numeric NOT NULL DEFAULT 0,
  taxes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with invoices"
ON public.invoices FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
