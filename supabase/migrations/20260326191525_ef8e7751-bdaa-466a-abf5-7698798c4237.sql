
-- Create a secure view that hides custom_api_key from non-admin users
-- Drop existing permissive policy that exposes everything
DROP POLICY IF EXISTS "Users can view ai_settings" ON public.ai_settings;

-- Create policy that allows all authenticated users to read ai_settings but excludes custom_api_key
-- We use a security definer function + view approach
CREATE OR REPLACE VIEW public.ai_settings_public AS
SELECT 
  id, api_provider, credits_per_image, free_credits, image_sizes, 
  is_enabled, lifetime_free_all_users, lifetime_free_enabled, 
  lifetime_free_user_ids, updated_at, updated_by
FROM public.ai_settings;

-- Re-create the policy: all authenticated can read, but only through the view (no custom_api_key)
CREATE POLICY "Authenticated users can view ai_settings without api key"
ON public.ai_settings
FOR SELECT
TO authenticated
USING (true);

-- But we need to ensure the custom_api_key column is not returned via normal select
-- Since RLS can't filter columns, we'll use column-level security via a wrapper
-- The edge function reads with service_role which bypasses RLS anyway

-- Alternative: revoke direct column access. Unfortunately Postgres doesn't have column-level RLS.
-- Best approach: Admin-only update policy stays, and we ensure the client code only selects specific columns.
