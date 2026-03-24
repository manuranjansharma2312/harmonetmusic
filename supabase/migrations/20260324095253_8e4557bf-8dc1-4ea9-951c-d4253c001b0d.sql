
DROP POLICY IF EXISTS "Users can insert own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can insert own withdrawals"
ON public.withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
