
CREATE TABLE public.smart_link_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL
);

ALTER TABLE public.smart_link_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access smart_link_settings" ON public.smart_link_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view smart_link_settings" ON public.smart_link_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.smart_link_settings (is_enabled) VALUES (true);
