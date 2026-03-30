import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink, Music } from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';

type LinkData = {
  title: string;
  artist_name: string;
  poster_url: string | null;
  platform_links: Record<string, string>;
  content_type?: string;
  release_date?: string;
  copyright_line?: string | null;
};

interface Platform {
  id: string;
  name: string;
  icon_url: string | null;
  sort_order: number;
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 50%)`;
}

export default function SmartLink() {
  const { slug } = useParams<{ slug: string }>();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    const fetchData = async () => {
      // Fetch platforms
      const { data: platformData } = await supabase
        .from('smart_link_platforms')
        .select('id, name, icon_url, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPlatforms((platformData as any) || []);

      // Try standalone smart_links first (by slug, then id)
      let found: LinkData | null = null;

      const { data: slBySlug } = await supabase
        .from('smart_links')
        .select('title, artist_name, poster_url, platform_links, status')
        .eq('slug', slug)
        .eq('status', 'approved')
        .maybeSingle();

      if (slBySlug && slBySlug.platform_links && Object.keys(slBySlug.platform_links as Record<string, string>).length > 0) {
        found = { ...(slBySlug as any), platform_links: slBySlug.platform_links as Record<string, string> };
      }

      if (!found) {
        const { data: slById } = await supabase
          .from('smart_links')
          .select('title, artist_name, poster_url, platform_links, status')
          .eq('id', slug)
          .eq('status', 'approved')
          .maybeSingle();
        if (slById && slById.platform_links && Object.keys(slById.platform_links as Record<string, string>).length > 0) {
          found = { ...(slById as any), platform_links: slById.platform_links as Record<string, string> };
        }
      }

      // Fallback to releases
      if (!found) {
        const { data: relBySlug } = await supabase
          .from('releases')
          .select('id, album_name, ep_name, content_type, poster_url, release_date, copyright_line, platform_links')
          .eq('status', 'approved')
          .eq('slug', slug)
          .maybeSingle();

        let rel = relBySlug;
        if (!rel) {
          const { data: relById } = await supabase
            .from('releases')
            .select('id, album_name, ep_name, content_type, poster_url, release_date, copyright_line, platform_links')
            .eq('status', 'approved')
            .eq('id', slug)
            .maybeSingle();
          rel = relById;
        }

        if (rel && rel.platform_links && Object.keys(rel.platform_links as Record<string, string>).length > 0) {
          // Fetch first track for artist name
          const { data: tracks } = await supabase
            .from('tracks')
            .select('song_title, primary_artist')
            .eq('release_id', rel.id)
            .order('track_order')
            .limit(1);

          found = {
            title: rel.album_name || rel.ep_name || tracks?.[0]?.song_title || 'Untitled',
            artist_name: tracks?.[0]?.primary_artist || 'Unknown Artist',
            poster_url: rel.poster_url,
            platform_links: rel.platform_links as Record<string, string>,
            content_type: rel.content_type,
            release_date: rel.release_date,
            copyright_line: rel.copyright_line,
          };
        }
      }

      if (!found) { setNotFound(true); setLoading(false); return; }
      setLinkData(found);
      setLoading(false);
    };

    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !linkData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h1>
        <p className="text-muted-foreground">This smart link doesn't exist or hasn't been published yet.</p>
      </div>
    );
  }

  const getPlatformKey = (p: Platform) => p.name.toLowerCase().replace(/\s+/g, '_');
  const availablePlatforms = platforms.filter(p => linkData.platform_links[getPlatformKey(p)]?.trim());

  const year = linkData.release_date ? new Date(linkData.release_date).getFullYear() : null;
  const contentLabel = linkData.content_type === 'album' ? 'Album' : linkData.content_type === 'ep' ? 'EP' : linkData.content_type ? 'Single' : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)' }}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6 animate-fade-in">
        {linkData.poster_url ? (
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl blur-3xl opacity-30" style={{ background: 'hsl(0 67% 25%)' }} />
            <img src={linkData.poster_url} alt={linkData.title} className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl object-cover shadow-2xl border border-white/10" />
          </div>
        ) : (
          <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl bg-muted/30 border border-border flex items-center justify-center">
            <Music className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {linkData.title}
          </h1>
          <p className="text-base text-white/70">{linkData.artist_name}</p>
          {(contentLabel || year) && (
            <p className="text-sm text-white/40">{[contentLabel, year].filter(Boolean).join(' • ')}</p>
          )}
        </div>

        <div className="w-full space-y-3">
          {availablePlatforms.map((platform) => {
            const key = getPlatformKey(platform);
            const color = nameToColor(platform.name);
            return (
              <a
                key={platform.id}
                href={linkData.platform_links[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-5 py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.02] group"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = `${color}22`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${color}44`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${color}20`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="flex items-center gap-3">
                  {platform.icon_url ? (
                    <img src={platform.icon_url} alt={platform.name} className="h-5 w-5 rounded object-contain" />
                  ) : (
                    <Music className="h-5 w-5 text-white/70" />
                  )}
                  <span className="text-white font-medium text-sm sm:text-base">{platform.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/50 group-hover:text-white/80 transition-colors">
                  <span className="text-xs sm:text-sm">Listen</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mt-6 opacity-40 hover:opacity-60 transition-opacity">
          <img src={logoWhite} alt="Harmonet Music" className="h-5 w-auto" />
          <span className="text-xs text-white/60">Powered by Harmonet Music</span>
        </div>
      </div>
    </div>
  );
}
