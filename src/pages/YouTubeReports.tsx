import { ReportBrowserPage } from '@/components/report/ReportBrowserPage';

export default function YouTubeReports() {
  return (
    <ReportBrowserPage
      title="YouTube Reports"
      introText="Monthly YouTube revenue reports"
      emptyMessage="No YouTube reports available yet."
      exportPrefix="youtube-report"
      baseTable="youtube_report_entries"
      formatTable="youtube_report_format"
    />
  );
}
