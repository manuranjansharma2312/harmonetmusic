ALTER TABLE public.promotion_settings 
ADD COLUMN IF NOT EXISTS takedown_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS takedown_tax_enabled boolean NOT NULL DEFAULT false;