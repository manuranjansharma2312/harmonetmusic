import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'artist_name', label: 'Artist Name', placeholder: 'Enter the artist name' },
  { name: 'channel_link', label: 'Channel Link', type: 'url', placeholder: 'https://...' },
  { name: 'topic_channel_link', label: 'Topic Channel Link', type: 'url', placeholder: 'https://...' },
  { name: 'release_link_1', label: 'Release Link 1 (Distributed Through Harmonet Music)', type: 'url', placeholder: 'https://...' },
  { name: 'release_link_2', label: 'Release Link 2 (Distributed Through Harmonet Music)', type: 'url', placeholder: 'https://...' },
  { name: 'release_link_3', label: 'Release Link 3 (Distributed Through Harmonet Music)', type: 'url', placeholder: 'https://...' },
];

export default function OacApply() {
  return <ContentRequestPage title="Official Artist Channel Apply" requestType="oac_apply" fields={fields} />;
}
