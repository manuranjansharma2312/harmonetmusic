
ALTER TABLE public.promotion_settings ADD COLUMN taxes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.promotion_products ADD COLUMN platform text DEFAULT '';
