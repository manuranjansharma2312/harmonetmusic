
-- AI Plans table
CREATE TABLE public.ai_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  description text DEFAULT '',
  tag text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access ai_plans" ON public.ai_plans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view active ai_plans" ON public.ai_plans FOR SELECT TO authenticated USING (is_active = true);

-- AI Plan Orders table
CREATE TABLE public.ai_plan_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.ai_plans(id) ON DELETE CASCADE,
  screenshot_url text DEFAULT NULL,
  transaction_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text DEFAULT NULL,
  payment_note text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_plan_orders_transaction_id_unique UNIQUE (transaction_id)
);
ALTER TABLE public.ai_plan_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access ai_plan_orders" ON public.ai_plan_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own ai_plan_orders" ON public.ai_plan_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own ai_plan_orders" ON public.ai_plan_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- AI Credits table (per user balance)
CREATE TABLE public.ai_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_credits integer NOT NULL DEFAULT 0,
  used_credits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access ai_credits" ON public.ai_credits FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own ai_credits" ON public.ai_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_credits" ON public.ai_credits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_credits" ON public.ai_credits FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- AI Credit Transactions log
CREATE TABLE public.ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credits integer NOT NULL,
  type text NOT NULL DEFAULT 'addition',
  note text DEFAULT NULL,
  order_id uuid DEFAULT NULL REFERENCES public.ai_plan_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access ai_credit_transactions" ON public.ai_credit_transactions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own ai_credit_transactions" ON public.ai_credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- AI Generated Images log
CREATE TABLE public.ai_generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  image_url text DEFAULT NULL,
  credits_used integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_generated_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access ai_generated_images" ON public.ai_generated_images FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own ai_generated_images" ON public.ai_generated_images FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_generated_images" ON public.ai_generated_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- AI Settings (for API key config etc)
CREATE TABLE public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider text NOT NULL DEFAULT 'openai',
  credits_per_image integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL
);
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access ai_settings" ON public.ai_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.ai_settings (api_provider, credits_per_image) VALUES ('openai', 1);
