import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'song_title', label: 'Song Title', placeholder: 'Enter the song title' },
  { name: 'official_artist_channel_link', label: 'Official Artist Channel Link', type: 'url', placeholder: 'https://...' },
  { name: 'release_topic_video_link', label: 'Release Topic Video Link', type: 'url', placeholder: 'https://...' },
];

export default function ContentIdMerge() {
  return <ContentRequestPage title="Content ID Merge" requestType="content_id_merge" fields={fields} />;
}
