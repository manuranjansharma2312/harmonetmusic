import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'song_title', label: 'Song Title', placeholder: 'Enter the song title' },
  { name: 'reason_for_takedown', label: 'Message for Your Label Manager', type: 'textarea', placeholder: 'Write a message for your label manager to pitch your song to playlists...' },
];

export default function PlaylistPitching() {
  return <ContentRequestPage title="Playlist Pitching" requestType="playlist_pitching" fields={fields} />;
}
