
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS phone_country_code text DEFAULT '',
ADD COLUMN IF NOT EXISTS phone_number text DEFAULT '';
