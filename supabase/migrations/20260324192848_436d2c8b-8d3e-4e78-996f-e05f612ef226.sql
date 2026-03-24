
-- Bank details table
CREATE TABLE public.bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  account_holder_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text,
  branch_name text,
  iban text,
  swift_bic text,
  bank_address text,
  country text,
  is_locked boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Audit log for admin changes
CREATE TABLE public.bank_detail_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_detail_id uuid REFERENCES public.bank_details(id) ON DELETE CASCADE NOT NULL,
  changed_by uuid NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS on bank_details
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank details" ON public.bank_details
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank details" ON public.bank_details
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all bank details" ON public.bank_details
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all bank details" ON public.bank_details
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bank details" ON public.bank_details
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS on audit logs
ALTER TABLE public.bank_detail_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON public.bank_detail_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs" ON public.bank_detail_audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger for bank_details
CREATE TRIGGER update_bank_details_updated_at
  BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
