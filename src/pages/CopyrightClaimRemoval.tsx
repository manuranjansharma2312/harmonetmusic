import { ContentRequestPage, FieldConfig } from '@/components/ContentRequestPage';

const fields: FieldConfig[] = [
  { name: 'song_title', label: 'Song Title', placeholder: 'Enter the song title' },
  { name: 'copyright_company', label: 'Copyright Company', placeholder: 'Enter the copyright company name' },
  { name: 'video_link', label: 'Video Link', type: 'url', placeholder: 'https://...' },
];

export default function CopyrightClaimRemoval() {
  return <ContentRequestPage title="Copyright Claim Removal" requestType="copyright_claim" fields={fields} />;
}
