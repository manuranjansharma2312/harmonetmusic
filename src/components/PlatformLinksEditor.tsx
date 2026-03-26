import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/CopyButton';
import { toast } from 'sonner';
import { Save, Link, ExternalLink, Loader2, Music } from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  icon_url: string | null;
  placeholder: string;
  sort_order: number;
}

interface PlatformLinksEditorProps {
  releaseId: string;
  releaseSlug: string | null;
  initialLinks: Record<string, string>;
  onSaved?: (links: Record<string, string>) => void;
}

export function PlatformLinksEditor({ releaseId, releaseSlug, initialLinks, onSaved }: PlatformLinksEditorProps) {
  const [links, setLinks] = useState<Record<string, string>>(initialLinks || {});
  const [saving, setSaving] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);

  const smartLinkUrl = releaseSlug
    ? `${window.location.origin}/r/${releaseSlug}`
    : `${window.location.origin}/r/${releaseId}`;

  const hasAnyLink = Object.values(links).some(v => v?.trim());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('smart_link_platforms')
        .select('id, name, icon_url, placeholder, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPlatforms((data as any) || []);
      setLoadingPlatforms(false);
    })();
  }, []);

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

  // Use platform name as key for storing links
  const getPlatformKey = (p: Platform) => p.name.toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-muted/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Platform URLs</h3>
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

      {loadingPlatforms ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-6">
          <Music className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No platforms configured. Admin needs to add platforms first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platforms.map(p => {
            const key = getPlatformKey(p);
            return (
              <div key={p.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  {p.icon_url ? (
                    <img src={p.icon_url} alt={p.name} className="h-4 w-4 rounded object-contain" />
                  ) : null}
                  <Label className="text-xs text-muted-foreground">{p.name}</Label>
                </div>
                <Input
                  value={links[key] || ''}
                  onChange={e => setLinks(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={p.placeholder || `https://...`}
                  className="text-xs h-8"
                />
              </div>
            );
          })}
        </div>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
        Save Platform Links
      </Button>
    </div>
  );
}
