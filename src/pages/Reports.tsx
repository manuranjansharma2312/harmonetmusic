import { ReportBrowserPage } from '@/components/report/ReportBrowserPage';

export default function Reports() {
  return (
    <ReportBrowserPage
      title="Reports & Analytics"
      introText="Monthly revenue reports"
      emptyMessage="No reports available yet."
      exportPrefix="ott-report"
      baseTable="report_entries"
      formatTable="ott_report_format"
    />
  );
}
