-- Allow authenticated admin users to upload branding assets to the posters bucket
CREATE POLICY "Admins can upload branding assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posters'
  AND (storage.foldername(name))[1] = 'branding'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow admins to update/overwrite branding assets
CREATE POLICY "Admins can update branding assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'posters'
  AND (storage.foldername(name))[1] = 'branding'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
