
-- Revenue settings (admin-managed threshold)
CREATE TABLE public.revenue_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_threshold numeric NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.revenue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view revenue settings"
  ON public.revenue_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert revenue settings"
  ON public.revenue_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update revenue settings"
  ON public.revenue_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.revenue_settings (withdrawal_threshold) VALUES (1000);

-- Withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawals"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update withdrawals"
  ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete withdrawals"
  ON public.withdrawal_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
