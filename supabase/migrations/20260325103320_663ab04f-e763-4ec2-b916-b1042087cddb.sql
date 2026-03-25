
-- Allow parent labels to view their sub-labels' withdrawal requests
CREATE POLICY "Parent labels can view sub-label withdrawals"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (is_parent_label(user_id));

-- Allow parent labels to update their sub-labels' withdrawal requests
CREATE POLICY "Parent labels can update sub-label withdrawals"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (is_parent_label(user_id));
