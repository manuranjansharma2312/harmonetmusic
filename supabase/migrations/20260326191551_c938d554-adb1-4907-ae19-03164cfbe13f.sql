
-- Drop the security definer view (it was flagged as a security issue)
DROP VIEW IF EXISTS public.ai_settings_public;

-- Use column-level privilege revocation instead
-- Revoke SELECT on custom_api_key from anon and authenticated roles
REVOKE SELECT (custom_api_key) ON public.ai_settings FROM anon;
REVOKE SELECT (custom_api_key) ON public.ai_settings FROM authenticated;

-- Grant SELECT on all other columns explicitly
GRANT SELECT (id, api_provider, credits_per_image, free_credits, image_sizes, is_enabled, 
  lifetime_free_all_users, lifetime_free_enabled, lifetime_free_user_ids, updated_at, updated_by) 
ON public.ai_settings TO authenticated;
