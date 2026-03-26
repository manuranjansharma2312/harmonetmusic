
-- Fix: Remove user INSERT policy on ai_credits - credits should only be managed server-side
DROP POLICY IF EXISTS "Users can insert own ai_credits" ON public.ai_credits;

-- Create a security definer function to initialize credits for new users
CREATE OR REPLACE FUNCTION public.init_ai_credits(_user_id uuid, _free_credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow initializing for the calling user
  IF _user_id != auth.uid() THEN
    RETURN;
  END IF;
  
  -- Only insert if no row exists yet
  INSERT INTO public.ai_credits (user_id, total_credits, used_credits)
  VALUES (_user_id, _free_credits, 0)
  ON CONFLICT DO NOTHING;
END;
$$;
