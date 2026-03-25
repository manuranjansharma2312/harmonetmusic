
-- Drop existing policies first to avoid conflicts
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Private bucket: b2b-documents
CREATE POLICY "Users can upload own b2b docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'b2b-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own b2b docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'b2b-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can read all b2b docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'b2b-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete b2b docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'b2b-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Private bucket: id-proofs
CREATE POLICY "Users can upload own id proofs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'id-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own id proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'id-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can read all id proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'id-proofs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete id proofs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'id-proofs' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Private bucket: promotion-screenshots
CREATE POLICY "Users can upload own promo screenshots" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'promotion-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own promo screenshots" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'promotion-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can read all promo screenshots" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'promotion-screenshots' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete promo screenshots" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'promotion-screenshots' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public buckets: audio, posters, covers (authenticated uploads)
CREATE POLICY "Users can upload audio" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Users can upload posters" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'posters');

CREATE POLICY "Users can upload covers" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'covers');

CREATE POLICY "Admins can delete audio" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete posters" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'posters' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete covers" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin-only buckets: notice-images, tutorial-images, promotion-qr
CREATE POLICY "Admins can upload notice images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notice-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete notice images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'notice-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can upload tutorial images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutorial-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete tutorial images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutorial-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can upload promotion qr" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'promotion-qr' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete promotion qr" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'promotion-qr' AND public.has_role(auth.uid(), 'admin'::public.app_role));
