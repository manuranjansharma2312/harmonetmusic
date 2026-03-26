
ALTER TABLE public.ai_settings 
ADD COLUMN lifetime_free_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN lifetime_free_all_users boolean NOT NULL DEFAULT true,
ADD COLUMN lifetime_free_user_ids uuid[] NOT NULL DEFAULT '{}';
