import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { CopyButton } from '@/components/CopyButton';
import { PlatformLinksEditor } from '@/components/PlatformLinksEditor';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Link2, ExternalLink, Search, Music, Plus } from 'lucide-react';

interface SmartLinkRelease {
  id: string;
  album_name: string | null;
  ep_name: string | null;
  poster_url: string | null;
  platform_links: Record<string, string>;
  slug: string | null;
  status: string;
  content_type: string;
  release_date: string;
}

export default function MySmartLinks() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<SmartLinkRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editRelease, setEditRelease] = useState<SmartLinkRelease | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('releases')
        .select('id, album_name, ep_name, poster_url, platform_links, slug, status, content_type, release_date')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('release_date', { ascending: false });
      setReleases((data as any) || []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = releases.filter(r => {
    const name = r.album_name || r.ep_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getSmartLinkUrl = (r: SmartLinkRelease) => {
    const base = window.location.origin;
    return r.slug ? `${base}/r/${r.slug}` : `${base}/r/${r.id}`;
  };

  const hasLinks = (r: SmartLinkRelease) => {
    const links = r.platform_links as Record<string, string>;
    return links && Object.values(links).some(v => v?.trim());
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Smart Links</h1>
          <p className="text-sm text-muted-foreground mt-1">Share one link — fans choose their platform</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search releases..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Music className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No approved releases found</p>
            <p className="text-xs text-muted-foreground mt-1">Smart links are available once your release is approved.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => {
              const name = r.album_name || r.ep_name || 'Untitled';
              const active = hasLinks(r);
              const url = getSmartLinkUrl(r);
              const linkCount = active ? Object.values(r.platform_links).filter(v => v?.trim()).length : 0;

              return (
                <GlassCard key={r.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {r.poster_url ? (
                      <img src={r.poster_url} alt={name} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.content_type} • {r.release_date}</p>
                      {active ? (
                        <Badge variant="default" className="mt-1 text-[10px]">{linkCount} platforms</Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1 text-[10px]">No links yet</Badge>
                      )}
                    </div>
                  </div>

                  {active && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                      <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate font-mono">{url}</span>
                      <CopyButton value={url} />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant={active ? "outline" : "default"}
                    className="w-full text-xs"
                    onClick={() => setEditRelease(r)}
                  >
                    {active ? (
                      <><Link2 className="h-3.5 w-3.5 mr-1" /> Edit Smart Link</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> Create Smart Link</>
                    )}
                  </Button>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editRelease} onOpenChange={open => !open && setEditRelease(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editRelease && hasLinks(editRelease) ? 'Edit' : 'Create'} Smart Link — {editRelease?.album_name || editRelease?.ep_name || 'Untitled'}
            </DialogTitle>
          </DialogHeader>
          {editRelease && (
            <PlatformLinksEditor
              releaseId={editRelease.id}
              releaseSlug={editRelease.slug}
              initialLinks={editRelease.platform_links || {}}
              onSaved={(links) => {
                setReleases(prev => prev.map(r => r.id === editRelease.id ? { ...r, platform_links: links } : r));
                setEditRelease(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
