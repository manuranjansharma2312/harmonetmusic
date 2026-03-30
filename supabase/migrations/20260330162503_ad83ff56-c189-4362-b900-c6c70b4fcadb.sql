CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_labels_sub_user_id ON public.sub_labels (sub_user_id);
CREATE INDEX IF NOT EXISTS idx_sub_labels_parent_status ON public.sub_labels (parent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tracks_user_id_isrc ON public.tracks (user_id, isrc);
CREATE INDEX IF NOT EXISTS idx_songs_user_id_isrc ON public.songs (user_id, isrc);

CREATE INDEX IF NOT EXISTS idx_releases_user_created_at ON public.releases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_releases_user_status ON public.releases (user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_created_at ON public.withdrawal_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status ON public.withdrawal_requests (user_id, status);

CREATE INDEX IF NOT EXISTS idx_report_entries_user_month ON public.report_entries (user_id, reporting_month DESC);
CREATE INDEX IF NOT EXISTS idx_report_entries_user_frozen ON public.report_entries (user_id, revenue_frozen);
CREATE INDEX IF NOT EXISTS idx_report_entries_isrc_month ON public.report_entries (isrc, reporting_month DESC);

CREATE INDEX IF NOT EXISTS idx_youtube_report_entries_user_month ON public.youtube_report_entries (user_id, reporting_month DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_report_entries_user_frozen ON public.youtube_report_entries (user_id, revenue_frozen);
CREATE INDEX IF NOT EXISTS idx_youtube_report_entries_isrc_month ON public.youtube_report_entries (isrc, reporting_month DESC);

CREATE INDEX IF NOT EXISTS idx_vevo_report_entries_user_month ON public.vevo_report_entries (user_id, reporting_month DESC);
CREATE INDEX IF NOT EXISTS idx_vevo_report_entries_user_frozen ON public.vevo_report_entries (user_id, revenue_frozen);
CREATE INDEX IF NOT EXISTS idx_vevo_report_entries_isrc_month ON public.vevo_report_entries (isrc, reporting_month DESC);

CREATE INDEX IF NOT EXISTS idx_youtube_cms_links_user_status ON public.youtube_cms_links (user_id, status);
CREATE INDEX IF NOT EXISTS idx_youtube_cms_links_channel_status ON public.youtube_cms_links (channel_name, status);
CREATE INDEX IF NOT EXISTS idx_cms_report_entries_channel_month ON public.cms_report_entries (channel_name, reporting_month DESC);
CREATE INDEX IF NOT EXISTS idx_cms_withdrawal_requests_user_created_at ON public.cms_withdrawal_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_withdrawal_requests_user_status ON public.cms_withdrawal_requests (user_id, status);

CREATE INDEX IF NOT EXISTS idx_labels_status_created_at ON public.labels (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_requests_status_created_at ON public.content_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_submissions_type_status_created_at ON public.video_submissions (submission_type, status, created_at DESC);