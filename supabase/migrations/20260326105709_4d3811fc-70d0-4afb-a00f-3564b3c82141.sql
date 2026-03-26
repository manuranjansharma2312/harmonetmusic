
ALTER TABLE public.ai_settings ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.ai_settings ADD COLUMN free_credits integer NOT NULL DEFAULT 0;

-- Allow authenticated users to read ai_settings (needed to check is_enabled)
CREATE POLICY "Users can view ai_settings" ON public.ai_settings FOR SELECT TO authenticated USING (true);
