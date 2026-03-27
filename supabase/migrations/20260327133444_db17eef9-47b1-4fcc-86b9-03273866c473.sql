
CREATE TABLE public.email_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL UNIQUE,
  default_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access email_categories"
  ON public.email_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing categories
INSERT INTO public.email_categories (name, key, sort_order) VALUES
  ('Authentication', 'authentication', 1),
  ('Releases', 'releases', 2),
  ('Revenue & Payouts', 'revenue', 3),
  ('Labels', 'labels', 4),
  ('Content Requests', 'content_requests', 5),
  ('Sub Labels', 'sub_labels', 6),
  ('Smart Links', 'smart_links', 7),
  ('Promotions', 'promotions', 8),
  ('General', 'general', 9);
