
-- Video/Vevo transfer logs
CREATE TABLE public.video_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  submission_type text NOT NULL DEFAULT 'upload_video',
  submission_name text NOT NULL DEFAULT '',
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  transferred_by uuid NOT NULL,
  transferred_at timestamptz NOT NULL DEFAULT now(),
  linked_video_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.video_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access video_transfers" ON public.video_transfers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own video_transfers" ON public.video_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- CMS link transfer logs
CREATE TABLE public.cms_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_link_id uuid NOT NULL,
  channel_name text NOT NULL DEFAULT '',
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  transferred_by uuid NOT NULL,
  transferred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access cms_transfers" ON public.cms_transfers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own cms_transfers" ON public.cms_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
