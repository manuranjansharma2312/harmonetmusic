import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/CopyButton';
import { toast } from 'sonner';
import { Save, Link, ExternalLink, Loader2 } from 'lucide-react';

const PLATFORMS = [
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/...' },
  { key: 'apple_music', label: 'Apple Music', placeholder: 'https://music.apple.com/...' },
  { key: 'youtube_music', label: 'YouTube Music', placeholder: 'https://music.youtube.com/...' },
  { key: 'jiosaavn', label: 'JioSaavn', placeholder: 'https://www.jiosaavn.com/...' },
  { key: 'gaana', label: 'Gaana', placeholder: 'https://gaana.com/...' },
  { key: 'amazon_music', label: 'Amazon Music', placeholder: 'https://music.amazon.com/...' },
  { key: 'wynk', label: 'Wynk Music', placeholder: 'https://wynk.in/...' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/...' },
  { key: 'hungama', label: 'Hungama', placeholder: 'https://www.hungama.com/...' },
  { key: 'resso', label: 'Resso', placeholder: 'https://m.resso.com/...' },
] as const;

interface PlatformLinksEditorProps {
  releaseId: string;
  releaseSlug: string | null;
  initialLinks: Record<string, string>;
  onSaved?: (links: Record<string, string>) => void;
}

export function PlatformLinksEditor({ releaseId, releaseSlug, initialLinks, onSaved }: PlatformLinksEditorProps) {
  const [links, setLinks] = useState<Record<string, string>>(initialLinks || {});
  const [saving, setSaving] = useState(false);

  const smartLinkUrl = releaseSlug
    ? `${window.location.origin}/r/${releaseSlug}`
    : `${window.location.origin}/r/${releaseId}`;

  const hasAnyLink = Object.values(links).some(v => v?.trim());

  const handleSave = async () => {
    setSaving(true);
    // Clean empty values
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
