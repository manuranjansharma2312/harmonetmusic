import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'song_title', label: 'Song Title', placeholder: 'Enter the song title' },
  { name: 'reason_for_takedown', label: 'Reason for Takedown', type: 'textarea', placeholder: 'Describe the reason for takedown...' },
];

export default function Takedown() {
  return <ContentRequestPage title="Takedown" requestType="takedown" fields={fields} />;
}
