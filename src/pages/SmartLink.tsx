import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink } from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';

type PlatformKey = 'spotify' | 'apple_music' | 'youtube_music' | 'jiosaavn' | 'gaana' | 'amazon_music' | 'wynk' | 'instagram' | 'hungama' | 'resso';

const PLATFORMS: { key: PlatformKey; label: string; color: string; icon: string }[] = [
  { key: 'spotify', label: 'Spotify', color: '#1DB954', icon: '🟢' },
  { key: 'apple_music', label: 'Apple Music', color: '#FA2D48', icon: '🍎' },
  { key: 'youtube_music', label: 'YouTube Music', color: '#FF0000', icon: '🔴' },
  { key: 'jiosaavn', label: 'JioSaavn', color: '#2BC5B4', icon: '🎵' },
  { key: 'gaana', label: 'Gaana', color: '#E72C30', icon: '🎶' },
  { key: 'amazon_music', label: 'Amazon Music', color: '#00A8E1', icon: '🔷' },
  { key: 'wynk', label: 'Wynk Music', color: '#1E90FF', icon: '🎧' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C', icon: '📱' },
  { key: 'hungama', label: 'Hungama', color: '#009933', icon: '🎼' },
  { key: 'resso', label: 'Resso', color: '#FF2D55', icon: '🎹' },
];

type ReleaseData = {
  id: string;
  album_name: string | null;
  ep_name: string | null;
  content_type: string;
  poster_url: string | null;
  release_date: string;
  copyright_line: string | null;
  platform_links: Record<string, string>;
  tracks?: { song_title: string; primary_artist: string | null }[];
};

export default function SmartLink() {
  const { slug } = useParams<{ slug: string }>();
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    const fetchRelease = async () => {
      // Try slug first, then ID
      let query = supabase
        .from('releases')
        .select('id, album_name, ep_name, content_type, poster_url, release_date, copyright_line, platform_links')
        .eq('status', 'approved');

      const { data: bySlug } = await query.eq('slug', slug).maybeSingle();
      
      let releaseData = bySlug;
      if (!releaseData) {
        const { data: byId } = await supabase
          .from('releases')
          .select('id, album_name, ep_name, content_type, poster_url, release_date, copyright_line, platform_links')
          .eq('status', 'approved')
          .eq('id', slug)
          .maybeSingle();
        releaseData = byId;
      }

      if (!releaseData || !releaseData.platform_links || Object.keys(releaseData.platform_links as Record<string, string>).length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Fetch tracks for artist/title info
      const { data: tracks } = await supabase
        .from('tracks')
        .select('song_title, primary_artist')
        .eq('release_id', releaseData.id)
        .order('track_order');

      setRelease({
        ...releaseData,
        platform_links: releaseData.platform_links as Record<string, string>,
        tracks: tracks || [],
      });
      setLoading(false);
    };

    fetchRelease();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !release) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h1>
        <p className="text-muted-foreground">This smart link doesn't exist or the release hasn't been published yet.</p>
      </div>
    );
  }

  const releaseName = release.album_name || release.ep_name || release.tracks?.[0]?.song_title || 'Untitled';
  const artistName = release.tracks?.[0]?.primary_artist || 'Unknown Artist';
  const year = new Date(release.release_date).getFullYear();
  const contentLabel = release.content_type === 'album' ? 'Album' : release.content_type === 'ep' ? 'EP' : 'Single';
  const links = release.platform_links;
  const availablePlatforms = PLATFORMS.filter(p => links[p.key]?.trim());

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)' }}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6 animate-fade-in">
        {/* Poster */}
        {release.poster_url ? (
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl blur-3xl opacity-30"
              style={{ background: 'hsl(0 67% 25%)' }}
            />
            <img
              src={release.poster_url}
              alt={releaseName}
              className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl object-cover shadow-2xl border border-white/10"
            />
          </div>
        ) : (
          <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl bg-muted/30 border border-border flex items-center justify-center">
            <span className="text-5xl">🎵</span>
          </div>
        )}

        {/* Title & Artist */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {releaseName}
          </h1>
          <p className="text-base text-white/70">{artistName}</p>
          <p className="text-sm text-white/40">{contentLabel} • {year}</p>
        </div>

        {/* Platform Buttons */}
        <div className="w-full space-y-3">
          {availablePlatforms.map((platform) => (
            <a
              key={platform.key}
              href={links[platform.key]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-5 py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.02] group"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${platform.color}22`;
                (e.currentTarget as HTMLElement).style.borderColor = `${platform.color}44`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${platform.color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{platform.icon}</span>
                <span className="text-white font-medium text-sm sm:text-base">{platform.label}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 group-hover:text-white/80 transition-colors">
                <span className="text-xs sm:text-sm">Listen</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-6 opacity-40 hover:opacity-60 transition-opacity">
          <img src={logoWhite} alt="Harmonet Music" className="h-5 w-auto" />
          <span className="text-xs text-white/60">Powered by Harmonet Music</span>
        </div>
      </div>
    </div>
  );
}
