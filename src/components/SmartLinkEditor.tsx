import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/CopyButton';
import { toast } from 'sonner';
import { Save, Link, ExternalLink, Loader2, Music, ImageIcon, Zap, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  // Auto-fetch & search settings
  const [autoFetchEnabled, setAutoFetchEnabled] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoFetching, setAutoFetching] = useState(false);
  const [searching, setSearching] = useState(false);

  const isEdit = !!smartLink?.id;
  const smartLinkUrl = smartLink?.slug
    ? `${window.location.origin}/r/${smartLink.slug}`
    : smartLink?.id ? `${window.location.origin}/r/${smartLink.id}` : null;

  const hasAnyLink = Object.values(links).some(v => v?.trim());

  useEffect(() => {
    (async () => {
      const [platformsRes, settingsRes] = await Promise.all([
        supabase
          .from('smart_link_platforms')
          .select('id, name, icon_url, placeholder, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('smart_link_settings')
          .select('auto_fetch_enabled, search_enabled')
          .limit(1)
          .single(),
      ]);
      setPlatforms((platformsRes.data as any) || []);
      if (settingsRes.data) {
        setAutoFetchEnabled((settingsRes.data as any).auto_fetch_enabled ?? false);
        setSearchEnabled((settingsRes.data as any).search_enabled ?? false);
      }
      setLoadingPlatforms(false);
    })();
  }, []);

  const handleAutoFetch = async () => {
    if (!searchQuery.trim()) { toast.error('Enter an ISRC, UPC, or link to auto-fetch'); return; }
    setAutoFetching(true);
    try {
      const { data: apis } = await supabase
        .from('smart_link_api_configs')
        .select('api_name, api_key, api_url')
        .eq('is_enabled', true)
        .limit(1)
        .single();
      
      if (!apis || !(apis as any).api_url || !(apis as any).api_key) {
        toast.error('No valid API configured. Ask your admin to set up an API.');
        return;
      }

      const apiUrl = (apis as any).api_url;
      const apiKey = (apis as any).api_key;
      const url = `${apiUrl}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(searchQuery.trim())}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        toast.error(`API returned error: ${response.status}`);
        return;
      }
      
      const result = await response.json();
      
      if (result.linksByPlatform || result.links) {
        const apiLinks = result.linksByPlatform || result.links;
        const newLinks: Record<string, string> = { ...links };
        platforms.forEach(p => {
          const key = getPlatformKey(p);
          const platformName = p.name.toLowerCase();
          for (const [apiKey, value] of Object.entries(apiLinks)) {
            if (apiKey.toLowerCase().includes(platformName) || platformName.includes(apiKey.toLowerCase())) {
              const linkUrl = typeof value === 'string' ? value : (value as any)?.url;
              if (linkUrl) newLinks[key] = linkUrl;
            }
          }
        });
        setLinks(newLinks);
        toast.success('Platform links auto-filled from API!');
      } else {
        toast.info('API responded but no platform links found in the response.');
      }
    } catch (err) {
      toast.error('Failed to fetch from API. Check API configuration.');
    } finally {
      setAutoFetching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast.error('Enter an ISRC, UPC, or link to search'); return; }
    setSearching(true);
    try {
      const { data: apis } = await supabase
        .from('smart_link_api_configs')
        .select('api_name, api_key, api_url')
        .eq('is_enabled', true)
        .limit(1)
        .single();
      
      if (!apis || !(apis as any).api_url || !(apis as any).api_key) {
        toast.error('No valid API configured.');
        return;
      }

      const apiUrl = (apis as any).api_url;
      const apiKey = (apis as any).api_key;
      const url = `${apiUrl}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(searchQuery.trim())}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        toast.error(`API returned error: ${response.status}`);
        return;
      }
      
      const result = await response.json();
      
      if (result.entitiesByUniqueId || result.title || result.name) {
        const entities = result.entitiesByUniqueId ? Object.values(result.entitiesByUniqueId) : [result];
        const firstEntity = (entities as any[])[0];
        if (firstEntity) {
          if (firstEntity.title && !title) setTitle(firstEntity.title);
          if (firstEntity.artistName && !artistName) setArtistName(firstEntity.artistName);
          if (firstEntity.thumbnailUrl && !posterUrl) setPosterUrl(firstEntity.thumbnailUrl);
        }
        toast.success('Song info found!');
      } else {
        toast.info('No song info found in API response.');
      }
    } catch (err) {
      toast.error('Failed to search. Check API configuration.');
    } finally {
      setSearching(false);
    }
  };

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
    <div className="space-y-5 overflow-x-hidden">
      {/* Release Info Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Release Info</h3>
        
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Song / Release Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My Song Name" className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm font-medium">Artist Name</Label>
            <Input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="e.g. Artist Name" className="mt-1.5" />
          </div>
        </div>

        {/* Poster */}
        <div>
          <Label className="text-sm font-medium">Cover Art</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Auto-compressed to 500×500 JPEG</p>
          <div className="flex items-center gap-3">
            {posterUrl ? (
              <img src={posterUrl} alt="poster" className="h-16 w-16 rounded-xl object-cover ring-1 ring-border" />
            ) : (
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Input type="file" accept="image/*" onChange={handlePosterUpload} className="text-xs" disabled={uploadingPoster} />
              {uploadingPoster && <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Link URL (if editing) */}
      {isEdit && smartLinkUrl && hasAnyLink && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
          <Link className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{smartLinkUrl}</span>
          <CopyButton value={smartLinkUrl} />
          <a href={smartLinkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Auto-fetch / Search section */}
      {(autoFetchEnabled || searchEnabled) && (
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {autoFetchEnabled && searchEnabled ? 'Search & Auto-fetch' : autoFetchEnabled ? 'Auto-fetch Links' : 'Search Song'}
            </h3>
            <Badge variant="secondary" className="text-[10px] ml-auto">API Connected</Badge>
          </div>
          <div className="space-y-2">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Enter ISRC, UPC, or song link..."
              className="text-sm"
            />
            <div className="flex gap-2">
              {searchEnabled && (
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                  Search
                </Button>
              )}
              {autoFetchEnabled && (
                <Button size="sm" className="flex-1 text-xs" onClick={handleAutoFetch} disabled={autoFetching || !searchQuery.trim()}>
                  {autoFetching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                  Auto-fill
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {autoFetchEnabled && searchEnabled
              ? 'Search to find song details, or Auto-fill to fetch all platform links automatically.'
              : autoFetchEnabled
              ? 'Paste an ISRC, UPC, or streaming link to auto-fill all platform URLs.'
              : 'Search by ISRC, UPC, or link to find song info.'}
          </p>
        </div>
      )}

      {/* Platform Links */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Link className="h-3.5 w-3.5 text-primary" />
          Platform URLs
        </h3>

        {loadingPlatforms ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : platforms.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-border bg-muted/10">
            <Music className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No platforms configured. Admin needs to add platforms first.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {platforms.map(p => {
              const key = getPlatformKey(p);
              return (
                <div key={p.id} className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 w-24 sm:w-28 shrink-0">
                    {p.icon_url ? (
                      <img src={p.icon_url} alt={p.name} className="h-5 w-5 rounded object-contain shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0">
                        <Music className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-xs text-foreground font-medium truncate">{p.name}</span>
                  </div>
                  <Input
                    value={links[key] || ''}
                    onChange={e => setLinks(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={p.placeholder || `https://...`}
                    className="text-xs flex-1 min-w-0"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isEdit ? 'Save Smart Link' : 'Create Smart Link'}
      </Button>
    </div>
  );
}
