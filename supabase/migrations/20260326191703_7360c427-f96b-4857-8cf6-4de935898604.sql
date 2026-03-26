
-- Fix 1: Replace the broad SELECT policy with admin-only + specific columns for regular users
-- Drop the current broad policy
DROP POLICY IF EXISTS "Authenticated users can view ai_settings without api key" ON public.ai_settings;

-- Create separate policies: admins see everything, regular users see limited columns
-- Since RLS can't filter columns, we restrict non-admin to only see via specific column grants

-- Policy: Only admins can select from ai_settings table directly
CREATE POLICY "Only admins can fully read ai_settings"
ON public.ai_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Create a security definer function for non-admin users to get settings without api key
CREATE OR REPLACE FUNCTION public.get_ai_settings_public()
RETURNS TABLE(
  id uuid,
  credits_per_image integer,
  is_enabled boolean,
  free_credits integer,
  image_sizes jsonb,
  lifetime_free_enabled boolean,
  lifetime_free_all_users boolean,
  lifetime_free_user_ids text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, credits_per_image, is_enabled, free_credits, 
    image_sizes::jsonb, lifetime_free_enabled, lifetime_free_all_users, lifetime_free_user_ids
  FROM public.ai_settings
  LIMIT 1
$$;

-- Fix 2: Remove user-facing UPDATE policy on ai_credits
DROP POLICY IF EXISTS "Users can update own ai_credits" ON public.ai_credits;

-- Create a security definer function to deduct credits (controlled)
CREATE OR REPLACE FUNCTION public.deduct_ai_credit(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  -- Only allow deducting for the calling user
  IF _user_id != auth.uid() THEN
    RETURN false;
  END IF;
  
  UPDATE public.ai_credits 
  SET used_credits = used_credits + _amount, updated_at = now()
  WHERE user_id = _user_id 
    AND (total_credits - used_credits) >= _amount
  RETURNING (total_credits - used_credits) INTO remaining;
  
  RETURN FOUND;
END;
$$;
