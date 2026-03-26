
-- Create a secure function to log credit transactions (replaces direct insert)
CREATE OR REPLACE FUNCTION public.log_ai_credit_transaction(
  _user_id uuid,
  _credits integer,
  _type text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the user themselves or admin
  IF _user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Validate type
  IF _type NOT IN ('usage', 'free_credits', 'addition', 'purchase', 'manual') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;
  
  -- Truncate note to prevent abuse
  INSERT INTO public.ai_credit_transactions (user_id, credits, type, note)
  VALUES (_user_id, _credits, _type, left(_note, 200));
END;
$$;

-- Add withdrawal request rate limiting (max 3 per day per user)
CREATE OR REPLACE FUNCTION public.check_withdrawal_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.withdrawal_requests
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';
  
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit: maximum 3 withdrawal requests per 24 hours';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_withdrawal_rate ON public.withdrawal_requests;
CREATE TRIGGER enforce_withdrawal_rate
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_withdrawal_rate();

-- Add content request rate limiting (max 10 per day)
CREATE OR REPLACE FUNCTION public.check_content_request_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.content_requests
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';
  
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit: maximum 10 content requests per 24 hours';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_content_request_rate ON public.content_requests;
CREATE TRIGGER enforce_content_request_rate
  BEFORE INSERT ON public.content_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_content_request_rate();
