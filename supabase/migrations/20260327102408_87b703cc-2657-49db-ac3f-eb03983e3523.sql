
-- Create release_transfers log table
CREATE TABLE public.release_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  transferred_by uuid NOT NULL,
  transferred_at timestamp with time zone NOT NULL DEFAULT now(),
  release_name text NOT NULL DEFAULT '',
  isrcs text[] NOT NULL DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.release_transfers ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access release_transfers"
  ON public.release_transfers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view transfers involving them
CREATE POLICY "Users can view own transfers"
  ON public.release_transfers FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
