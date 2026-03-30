
-- Server-side aggregation function for admin dashboard
-- Replaces fetching ALL report rows client-side

CREATE OR REPLACE FUNCTION public.admin_dashboard_report_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow admins
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH ott_agg AS (
    SELECT
      COALESCE(SUM(net_generated_revenue), 0) AS total_revenue,
      COALESCE(SUM(streams), 0) AS total_streams,
      COALESCE(SUM(downloads), 0) AS total_downloads
    FROM report_entries
  ),
  yt_agg AS (
    SELECT
      COALESCE(SUM(net_generated_revenue), 0) AS total_revenue,
      COALESCE(SUM(streams), 0) AS total_streams,
      COALESCE(SUM(downloads), 0) AS total_downloads
    FROM youtube_report_entries
  ),
  vevo_agg AS (
    SELECT
      COALESCE(SUM(net_generated_revenue), 0) AS total_revenue,
      COALESCE(SUM(streams), 0) AS total_streams,
      COALESCE(SUM(downloads), 0) AS total_downloads
    FROM vevo_report_entries
  ),
  cms_agg AS (
    SELECT COALESCE(SUM(net_generated_revenue), 0) AS total_revenue
    FROM cms_report_entries
  ),
  -- Monthly revenue trend (last 8 months across all report types)
  monthly_trend AS (
    SELECT reporting_month AS month,
      SUM(net_generated_revenue) AS revenue,
      SUM(streams) AS streams,
      SUM(downloads) AS downloads
    FROM (
      SELECT reporting_month, COALESCE(net_generated_revenue, 0) AS net_generated_revenue, COALESCE(streams, 0) AS streams, COALESCE(downloads, 0) AS downloads FROM report_entries
      UNION ALL
      SELECT reporting_month, COALESCE(net_generated_revenue, 0), COALESCE(streams, 0), COALESCE(downloads, 0) FROM youtube_report_entries
      UNION ALL
      SELECT reporting_month, COALESCE(net_generated_revenue, 0), COALESCE(streams, 0), COALESCE(downloads, 0) FROM vevo_report_entries
    ) combined
    GROUP BY reporting_month
    ORDER BY reporting_month DESC
    LIMIT 8
  ),
  -- Top stores by streams
  top_stores AS (
    SELECT store AS name, SUM(streams) AS streams, SUM(net_generated_revenue) AS revenue
    FROM (
      SELECT COALESCE(store, 'Unknown') AS store, COALESCE(streams, 0) AS streams, COALESCE(net_generated_revenue, 0) AS net_generated_revenue FROM report_entries
      UNION ALL
      SELECT COALESCE(store, 'Unknown'), COALESCE(streams, 0), COALESCE(net_generated_revenue, 0) FROM youtube_report_entries
      UNION ALL
      SELECT COALESCE(store, 'Unknown'), COALESCE(streams, 0), COALESCE(net_generated_revenue, 0) FROM vevo_report_entries
    ) combined
    GROUP BY store
    ORDER BY streams DESC
    LIMIT 8
  ),
  -- Top tracks
  top_tracks AS (
    SELECT track AS name, SUM(streams) AS streams
    FROM (
      SELECT track, COALESCE(streams, 0) AS streams FROM report_entries WHERE track IS NOT NULL
      UNION ALL
      SELECT track, COALESCE(streams, 0) FROM youtube_report_entries WHERE track IS NOT NULL
      UNION ALL
      SELECT track, COALESCE(streams, 0) FROM vevo_report_entries WHERE track IS NOT NULL
    ) combined
    GROUP BY track
    ORDER BY streams DESC
    LIMIT 5
  ),
  -- Top artists
  top_artists AS (
    SELECT artist AS name, SUM(streams) AS streams
    FROM (
      SELECT artist, COALESCE(streams, 0) AS streams FROM report_entries WHERE artist IS NOT NULL
      UNION ALL
      SELECT artist, COALESCE(streams, 0) FROM youtube_report_entries WHERE artist IS NOT NULL
      UNION ALL
      SELECT artist, COALESCE(streams, 0) FROM vevo_report_entries WHERE artist IS NOT NULL
    ) combined
    GROUP BY artist
    ORDER BY streams DESC
    LIMIT 5
  ),
  -- Top countries
  top_countries AS (
    SELECT country AS name, SUM(streams) AS streams
    FROM (
      SELECT country, COALESCE(streams, 0) AS streams FROM report_entries WHERE country IS NOT NULL
      UNION ALL
      SELECT country, COALESCE(streams, 0) FROM youtube_report_entries WHERE country IS NOT NULL
      UNION ALL
      SELECT country, COALESCE(streams, 0) FROM vevo_report_entries WHERE country IS NOT NULL
    ) combined
    GROUP BY country
    ORDER BY streams DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'ott', (SELECT row_to_json(ott_agg) FROM ott_agg),
    'youtube', (SELECT row_to_json(yt_agg) FROM yt_agg),
    'vevo', (SELECT row_to_json(vevo_agg) FROM vevo_agg),
    'cms_total_revenue', (SELECT total_revenue FROM cms_agg),
    'monthly_trend', (SELECT COALESCE(jsonb_agg(row_to_json(mt)::jsonb ORDER BY mt.month), '[]'::jsonb) FROM monthly_trend mt),
    'top_stores', (SELECT COALESCE(jsonb_agg(row_to_json(ts)::jsonb ORDER BY ts.streams DESC), '[]'::jsonb) FROM top_stores ts),
    'top_tracks', (SELECT COALESCE(jsonb_agg(row_to_json(tt)::jsonb ORDER BY tt.streams DESC), '[]'::jsonb) FROM top_tracks tt),
    'top_artists', (SELECT COALESCE(jsonb_agg(row_to_json(ta)::jsonb ORDER BY ta.streams DESC), '[]'::jsonb) FROM top_artists ta),
    'top_countries', (SELECT COALESCE(jsonb_agg(row_to_json(tc)::jsonb ORDER BY tc.streams DESC), '[]'::jsonb) FROM top_countries tc)
  ) INTO result;

  RETURN result;
END;
$$;

-- Counts function for admin dashboard
CREATE OR REPLACE FUNCTION public.admin_dashboard_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM profiles),
    'labels', (SELECT COUNT(*) FROM labels),
    'sub_labels', (SELECT COUNT(*) FROM sub_labels),
    'releases_total', (SELECT COUNT(*) FROM releases),
    'releases_pending', (SELECT COUNT(*) FROM releases WHERE status = 'pending'),
    'releases_approved', (SELECT COUNT(*) FROM releases WHERE status = 'approved'),
    'releases_rejected', (SELECT COUNT(*) FROM releases WHERE status = 'rejected'),
    'content_requests_pending', (SELECT COUNT(*) FROM content_requests WHERE status = 'pending'),
    'withdrawals_pending', (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending'),
    'withdrawals_paid', (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'paid'),
    'withdrawals_total_amount', (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'paid'),
    'withdrawals_pending_amount', (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'pending'),
    'cms_links_linked', (SELECT COUNT(*) FROM youtube_cms_links WHERE status = 'linked'),
    'cms_links_pending', (SELECT COUNT(*) FROM youtube_cms_links WHERE status IN ('pending_review', 'reviewing')),
    'cms_withdrawals_pending', (SELECT COUNT(*) FROM cms_withdrawal_requests WHERE status = 'pending'),
    'video_submissions', (SELECT COUNT(*) FROM video_submissions WHERE submission_type = 'upload_video'),
    'video_pending', (SELECT COUNT(*) FROM video_submissions WHERE submission_type = 'upload_video' AND status = 'pending'),
    'vevo_channels', (SELECT COUNT(*) FROM video_submissions WHERE submission_type = 'vevo_channel'),
    'vevo_pending', (SELECT COUNT(*) FROM video_submissions WHERE submission_type = 'vevo_channel' AND status = 'pending'),
    'signature_docs', (SELECT COUNT(*) FROM signature_documents),
    'transfers', (SELECT COUNT(*) FROM release_transfers)
  ) INTO result;

  RETURN result;
END;
$$;
