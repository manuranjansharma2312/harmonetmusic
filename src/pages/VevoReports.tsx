import { ReportBrowserPage } from '@/components/report/ReportBrowserPage';

export default function VevoReports() {
  return (
    <ReportBrowserPage
      title="Vevo Reports"
      introText="Monthly Vevo revenue reports"
      emptyMessage="No Vevo reports available yet."
      exportPrefix="vevo-report"
      baseTable="vevo_report_entries"
      formatTable="vevo_report_format"
    />
  );
}
