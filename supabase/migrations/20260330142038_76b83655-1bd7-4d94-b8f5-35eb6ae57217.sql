
-- ============================================================
-- 1. Fix signature-documents: replace blanket anon SELECT with
--    a policy that requires a valid signing token
-- ============================================================
DROP POLICY IF EXISTS "Anon can view signature docs for signing" ON storage.objects;

CREATE POLICY "Anon can view signature docs via valid token"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'signature-documents'
  AND EXISTS (
    SELECT 1 FROM public.signature_recipients sr
    JOIN public.signature_documents sd ON sd.id = sr.document_id
    WHERE (sd.document_url LIKE '%' || storage.objects.name OR sd.signed_pdf_url LIKE '%' || storage.objects.name OR sd.certificate_url LIKE '%' || storage.objects.name)
      AND sr.signing_token IS NOT NULL
      AND sr.token_expires_at > now()
  )
);

-- ============================================================
-- 2. Fix audio bucket INSERT: enforce path ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can upload audio" ON storage.objects;
CREATE POLICY "Users can upload audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 3. Fix covers bucket INSERT: enforce path ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can upload covers" ON storage.objects;
CREATE POLICY "Users can upload covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 4. Fix posters bucket INSERT: enforce path ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can upload posters" ON storage.objects;
CREATE POLICY "Users can upload posters"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posters'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 5. Fix video-uploads bucket INSERT: enforce path ownership
-- ============================================================
DROP POLICY IF EXISTS "Users can upload video files" ON storage.objects;
CREATE POLICY "Users can upload video files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'video-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 6. Add user-scoped DELETE policies for audio/covers/posters
-- ============================================================
CREATE POLICY "Users can delete own audio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own covers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own posters"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'posters'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own video uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'video-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
