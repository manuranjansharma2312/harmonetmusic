import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'song_title', label: 'Subject', placeholder: 'Enter the subject' },
  { name: 'reason_for_takedown', label: 'Details', type: 'textarea', placeholder: 'Describe your issue in detail...' },
];

export default function CustomSupport() {
  return <ContentRequestPage title="Custom Support" requestType="custom_support" fields={fields} />;
}
