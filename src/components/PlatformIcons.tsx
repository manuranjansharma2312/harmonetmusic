import { Instagram, Youtube, Facebook, Twitter, Music, Globe } from 'lucide-react';

export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', color: '#E4405F' },
  { value: 'youtube', label: 'YouTube', color: '#FF0000' },
  { value: 'facebook', label: 'Facebook', color: '#1877F2' },
  { value: 'twitter', label: 'X (Twitter)', color: '#1DA1F2' },
  { value: 'spotify', label: 'Spotify', color: '#1DB954' },
  { value: 'tiktok', label: 'TikTok', color: '#000000' },
  { value: 'other', label: 'Other', color: '#888888' },
];

const iconMap: Record<string, React.ElementType> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  spotify: Music,
  tiktok: Globe,
  other: Globe,
};

export function PlatformIcon({ platform, size = 20 }: { platform: string; size?: number }) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  const Icon = iconMap[platform] || Globe;
  return <Icon style={{ color: p?.color || '#888' }} className="flex-shrink-0" width={size} height={size} />;
}
