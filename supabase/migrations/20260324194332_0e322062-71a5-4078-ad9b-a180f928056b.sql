-- Fix notice_reads INSERT policy to allow admins to insert on behalf of users
DROP POLICY IF EXISTS "Users can insert own reads" ON public.notice_reads;

CREATE POLICY "Users can insert own reads"
ON public.notice_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));