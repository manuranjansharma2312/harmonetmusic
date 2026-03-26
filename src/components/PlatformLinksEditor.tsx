import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/CopyButton';
import { toast } from 'sonner';
import { Save, Link, ExternalLink, Loader2, Wand2 } from 'lucide-react';

const PLATFORMS = [
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/...', odesliKey: 'spotify' },
  { key: 'apple_music', label: 'Apple Music', placeholder: 'https://music.apple.com/...', odesliKey: 'appleMusic' },
  { key: 'youtube_music', label: 'YouTube Music', placeholder: 'https://music.youtube.com/...', odesliKey: 'youtubeMusic' },
  { key: 'jiosaavn', label: 'JioSaavn', placeholder: 'https://www.jiosaavn.com/...', odesliKey: '' },
  { key: 'gaana', label: 'Gaana', placeholder: 'https://gaana.com/...', odesliKey: '' },
  { key: 'amazon_music', label: 'Amazon Music', placeholder: 'https://music.amazon.com/...', odesliKey: 'amazonMusic' },
  { key: 'wynk', label: 'Wynk Music', placeholder: 'https://wynk.in/...', odesliKey: '' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/...', odesliKey: '' },
  { key: 'hungama', label: 'Hungama', placeholder: 'https://www.hungama.com/...', odesliKey: '' },
  { key: 'resso', label: 'Resso', placeholder: 'https://m.resso.com/...', odesliKey: '' },
] as const;

// Map Odesli platform keys to our platform keys
const ODESLI_TO_LOCAL: Record<string, string> = {
  spotify: 'spotify',
  appleMusic: 'apple_music',
  youtubeMusic: 'youtube_music',
  amazonMusic: 'amazon_music',
  youtube: 'youtube_music',
  amazonStore: 'amazon_music',
  itunes: 'apple_music',
  deezer: '',
  tidal: '',
  pandora: '',
  soundcloud: '',
  napster: '',
};

interface PlatformLinksEditorProps {
  releaseId: string;
  releaseSlug: string | null;
  initialLinks: Record<string, string>;
  onSaved?: (links: Record<string, string>) => void;
}

export function PlatformLinksEditor({ releaseId, releaseSlug, initialLinks, onSaved }: PlatformLinksEditorProps) {
  const [links, setLinks] = useState<Record<string, string>>(initialLinks || {});
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [autoFetchUrl, setAutoFetchUrl] = useState('');

  const smartLinkUrl = releaseSlug
    ? `${window.location.origin}/r/${releaseSlug}`
    : `${window.location.origin}/r/${releaseId}`;

  const hasAnyLink = Object.values(links).some(v => v?.trim());

  const handleAutoFetch = async () => {
    if (!autoFetchUrl.trim()) {
      toast.error('Please paste a music URL first');
      return;
    }

    setFetching(true);
    try {
      const response = await fetch(
        `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(autoFetchUrl.trim())}&userCountry=IN`
      );

      if (!response.ok) {
        throw new Error('Could not find this song on Songlink/Odesli');
      }

      const data = await response.json();
      const fetchedLinks: Record<string, string> = { ...links };
      let count = 0;

      if (data.linksByPlatform) {
        for (const [platform, info] of Object.entries(data.linksByPlatform)) {
          const localKey = ODESLI_TO_LOCAL[platform];
          if (localKey && (info as any)?.url) {
            fetchedLinks[localKey] = (info as any).url;
            count++;
          }
        }
      }

      setLinks(fetchedLinks);
      if (count > 0) {
        toast.success(`Auto-filled ${count} platform links!`);
      } else {
        toast.warning('Song found but no matching platform links detected');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch links from Songlink/Odesli');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const cleanLinks: Record<string, string> = {};
    for (const [key, value] of Object.entries(links)) {
      if (value?.trim()) cleanLinks[key] = value.trim();
    }

    const { error } = await supabase
      .from('releases')
      .update({ platform_links: cleanLinks } as any)
      .eq('id', releaseId);

    setSaving(false);
    if (error) {
      toast.error('Failed to save platform links');
      return;
    }
    toast.success('Platform links saved! Smart link is now live.');
    onSaved?.(cleanLinks);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-muted/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Smart Link — Platform URLs</h3>
        </div>
        {hasAnyLink && (
          <div className="flex items-center gap-2">
            <a href={smartLinkUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1">
              Preview <ExternalLink className="h-3 w-3" />
            </a>
            <CopyButton value={smartLinkUrl} />
          </div>
        )}
      </div>

      {/* Auto-fetch section */}
      <div className="p-3 rounded-md bg-primary/5 border border-primary/20 space-y-2">
        <Label className="text-xs font-medium text-primary">🪄 Auto-fill — Paste any one music link</Label>
        <div className="flex gap-2">
          <Input
            value={autoFetchUrl}
            onChange={e => setAutoFetchUrl(e.target.value)}
            placeholder="Paste Spotify, Apple Music, or any music URL here..."
            className="text-xs h-8 flex-1"
          />
          <Button size="sm" variant="secondary" onClick={handleAutoFetch} disabled={fetching} className="h-8">
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            {fetching ? 'Fetching...' : 'Auto-fill'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Powered by Songlink/Odesli — paste one link and all other platform links are auto-detected. Indian platforms (JioSaavn, Gaana, Wynk, Hungama) must be added manually.
        </p>
      </div>

      {hasAnyLink && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
          <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{smartLinkUrl}</span>
          <CopyButton value={smartLinkUrl} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLATFORMS.map(p => (
          <div key={p.key}>
            <Label className="text-xs text-muted-foreground">{p.label}</Label>
            <Input
              value={links[p.key] || ''}
              onChange={e => setLinks(prev => ({ ...prev, [p.key]: e.target.value }))}
              placeholder={p.placeholder}
              className="text-xs h-8 mt-1"
            />
          </div>
        ))}
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
        Save Platform Links
      </Button>
    </div>
  );
}
