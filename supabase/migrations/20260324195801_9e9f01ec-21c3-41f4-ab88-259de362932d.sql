
-- Add transaction_id to content_requests
ALTER TABLE public.content_requests ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE public.content_requests ADD COLUMN IF NOT EXISTS payment_screenshot_url text;

-- Add transaction_id to promotion_orders  
ALTER TABLE public.promotion_orders ADD COLUMN IF NOT EXISTS transaction_id text;

-- Add takedown_payment_enabled to promotion_settings
ALTER TABLE public.promotion_settings ADD COLUMN IF NOT EXISTS takedown_payment_enabled boolean NOT NULL DEFAULT false;
