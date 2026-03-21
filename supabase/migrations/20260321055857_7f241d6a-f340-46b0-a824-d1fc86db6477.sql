CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete songs of any user" ON public.songs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));