import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/CopyButton';
import { toast } from 'sonner';
import { Save, Link, ExternalLink, Loader2, Music, Upload, ImageIcon, AlertCircle } from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  icon_url: string | null;
  placeholder: string;
  sort_order: number;
}

interface SmartLinkData {
  id?: string;
  title: string;
  artist_name: string;
  poster_url: string | null;
  slug: string | null;
  platform_links: Record<string, string>;
}

interface SmartLinkEditorProps {
  smartLink?: SmartLinkData | null;
  onSaved?: (link: SmartLinkData) => void;
  userId: string;
}

export function SmartLinkEditor({ smartLink, onSaved, userId }: SmartLinkEditorProps) {
  const [title, setTitle] = useState(smartLink?.title || '');
  const [artistName, setArtistName] = useState(smartLink?.artist_name || '');
  const [posterUrl, setPosterUrl] = useState(smartLink?.poster_url || '');
  const [links, setLinks] = useState<Record<string, string>>(smartLink?.platform_links || {});
  const [saving, setSaving] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const isEdit = !!smartLink?.id;
  const smartLinkUrl = smartLink?.slug
    ? `${window.location.origin}/r/${smartLink.slug}`
    : smartLink?.id ? `${window.location.origin}/r/${smartLink.id}` : null;

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

  const compressImage = (file: File, maxSize: number = 500): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
          'image/jpeg',
          0.8
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploadingPoster(true);
    try {
      const compressed = await compressImage(file, 500);
      const path = `smart-link-posters/${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('posters').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (error) { toast.error('Upload failed'); setUploadingPoster(false); return; }
      const { data: urlData } = supabase.storage.from('posters').getPublicUrl(path);
      setPosterUrl(urlData.publicUrl);
      toast.success('Cover art compressed & uploaded (500×500)');
    } catch {
      toast.error('Failed to process image');
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);

    const cleanLinks: Record<string, string> = {};
    for (const [key, value] of Object.entries(links)) {
      if (value?.trim()) cleanLinks[key] = value.trim();
    }

    if (isEdit && smartLink?.id) {
      const { data, error } = await supabase
        .from('smart_links')
        .update({
          title: title.trim(),
          artist_name: artistName.trim(),
          poster_url: posterUrl || null,
          platform_links: cleanLinks,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', smartLink.id)
        .select('id, title, artist_name, poster_url, slug, platform_links')
        .single();

      setSaving(false);
      if (error) { toast.error('Failed to save'); return; }
      toast.success('Smart link updated!');
      onSaved?.({ ...(data as any), platform_links: cleanLinks });
    } else {
      const { data, error } = await supabase
        .from('smart_links')
        .insert({
          user_id: userId,
          title: title.trim(),
          artist_name: artistName.trim(),
          poster_url: posterUrl || null,
          platform_links: cleanLinks,
        } as any)
        .select('id, title, artist_name, poster_url, slug, platform_links')
        .single();

      setSaving(false);
      if (error) { toast.error('Failed to create smart link'); return; }
      toast.success('Smart link created!');
      onSaved?.({ ...(data as any), platform_links: cleanLinks });
    }
  };

  const getPlatformKey = (p: Platform) => p.name.toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="space-y-4">
      {/* Title & Artist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Song / Release Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My Song Name" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Artist Name</Label>
          <Input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="e.g. Artist Name" className="mt-1" />
        </div>
      </div>

      {/* Poster */}
      <div>
        <Label className="text-xs text-muted-foreground">Cover Art / Poster</Label>
        <div className="flex items-center gap-3 mt-1">
          {posterUrl ? (
            <img src={posterUrl} alt="poster" className="h-16 w-16 rounded-lg object-cover border border-border" />
          ) : (
            <div className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <Input type="file" accept="image/*" onChange={handlePosterUpload} className="text-xs h-8" disabled={uploadingPoster} />
            {uploadingPoster && <p className="text-[10px] text-primary mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</p>}
          </div>
        </div>
      </div>

      {/* Smart Link URL (if editing) */}
      {isEdit && smartLinkUrl && hasAnyLink && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
          <Link className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{smartLinkUrl}</span>
          <CopyButton value={smartLinkUrl} />
          <a href={smartLinkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Platform Links */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Platform URLs</h3>
        </div>

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
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
        {isEdit ? 'Save Smart Link' : 'Create Smart Link'}
      </Button>
    </div>
  );
}
