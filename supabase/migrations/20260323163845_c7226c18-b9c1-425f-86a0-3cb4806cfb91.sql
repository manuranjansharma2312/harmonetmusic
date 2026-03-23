
CREATE TABLE public.content_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  song_title text,
  copyright_company text,
  video_link text,
  isrc text,
  instagram_audio_link text,
  instagram_profile_link text,
  official_artist_channel_link text,
  release_topic_video_link text,
  artist_name text,
  channel_link text,
  topic_channel_link text,
  release_link_1 text,
  release_link_2 text,
  release_link_3 text,
  reason_for_takedown text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content requests" ON public.content_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content requests" ON public.content_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all content requests" ON public.content_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update any content request" ON public.content_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete any content request" ON public.content_requests FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
