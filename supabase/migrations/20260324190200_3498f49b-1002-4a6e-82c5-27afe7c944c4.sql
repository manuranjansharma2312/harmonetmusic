
-- Promotion products table
CREATE TABLE public.promotion_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price_per_unit numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with promotion_products" ON public.promotion_products FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view active promotion_products" ON public.promotion_products FOR SELECT TO authenticated USING (is_active = true);

-- Promotion settings table (enabled/disabled, QR code)
CREATE TABLE public.promotion_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  qr_code_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.promotion_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with promotion_settings" ON public.promotion_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view promotion_settings" ON public.promotion_settings FOR SELECT TO authenticated USING (true);

-- Promotion orders table
CREATE TABLE public.promotion_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.promotion_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  total_amount numeric NOT NULL DEFAULT 0,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  starts_from text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own promotion_orders" ON public.promotion_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own promotion_orders" ON public.promotion_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can do everything with promotion_orders" ON public.promotion_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings row
INSERT INTO public.promotion_settings (is_enabled, qr_code_url) VALUES (false, null);

-- Storage bucket for promotion screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('promotion-screenshots', 'promotion-screenshots', false);

CREATE POLICY "Users can upload promotion screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'promotion-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own promotion screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'promotion-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can view all promotion screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'promotion-screenshots' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for QR code
INSERT INTO storage.buckets (id, name, public) VALUES ('promotion-qr', 'promotion-qr', true);
CREATE POLICY "Admins can manage promotion QR" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'promotion-qr' AND has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (bucket_id = 'promotion-qr' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view promotion QR" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'promotion-qr');
