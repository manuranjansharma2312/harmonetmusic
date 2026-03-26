
-- Fix 1: Tighten report_entries SELECT policy to include user_id check
DROP POLICY IF EXISTS "Users can view report entries matching their ISRCs" ON public.report_entries;

CREATE POLICY "Users can view own report entries"
ON public.report_entries
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (auth.uid() = user_id)
  OR (user_owns_isrc(auth.uid(), isrc) AND is_parent_label(user_id))
);

-- Fix 2: Tighten youtube_report_entries SELECT policy
DROP POLICY IF EXISTS "Users can view youtube report entries matching their ISRCs" ON public.youtube_report_entries;

CREATE POLICY "Users can view own youtube report entries"
ON public.youtube_report_entries
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (auth.uid() = user_id)
  OR (user_owns_isrc(auth.uid(), isrc) AND is_parent_label(user_id))
);

-- Fix 3: Prevent users from inserting ai_credit_transactions (only admin/server should)
DROP POLICY IF EXISTS "Users can insert own ai_credit_transactions" ON public.ai_credit_transactions;

-- Fix 4: Add rate-limit-friendly constraint on ai_generated_images (max per hour)
-- This prevents abuse even if someone bypasses the UI
CREATE OR REPLACE FUNCTION public.check_ai_generation_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.ai_generated_images
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';
  
  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 50 generations per hour';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ai_generation_rate ON public.ai_generated_images;
CREATE TRIGGER enforce_ai_generation_rate
  BEFORE INSERT ON public.ai_generated_images
  FOR EACH ROW
  EXECUTE FUNCTION public.check_ai_generation_rate();
