import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'isrc', label: 'ISRC of the Track', placeholder: 'Enter ISRC code' },
  { name: 'instagram_audio_link', label: 'Instagram Audio Link', type: 'url', placeholder: 'https://...' },
  { name: 'instagram_profile_link', label: 'Instagram Profile Link', type: 'url', placeholder: 'https://...' },
];

export default function InstagramLinkToSong() {
  return <ContentRequestPage title="Instagram Link To Song" requestType="instagram_link" fields={fields} />;
}
