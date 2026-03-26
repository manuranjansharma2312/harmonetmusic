import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { CopyButton } from '@/components/CopyButton';
import { SmartLinkEditor } from '@/components/SmartLinkEditor';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Link2, ExternalLink, Search, Music, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SmartLinkItem {
  id: string;
  title: string;
  artist_name: string;
  poster_url: string | null;
  platform_links: Record<string, string>;
  slug: string | null;
  created_at: string;
}

export default function MySmartLinks() {
  const { user } = useAuth();
  const [smartLinks, setSmartLinks] = useState<SmartLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editLink, setEditLink] = useState<SmartLinkItem | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchLinks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('smart_links')
      .select('id, title, artist_name, poster_url, platform_links, slug, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSmartLinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, [user]);

  const filtered = smartLinks.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artist_name.toLowerCase().includes(search.toLowerCase())
  );

  const getUrl = (s: SmartLinkItem) => {
    const base = window.location.origin;
    return s.slug ? `${base}/r/${s.slug}` : `${base}/r/${s.id}`;
  };

  const hasLinks = (s: SmartLinkItem) => {
    return s.platform_links && Object.values(s.platform_links).some(v => v?.trim());
  };

  const deleteSmartLink = async (id: string) => {
    if (!confirm('Delete this smart link?')) return;
    await supabase.from('smart_links').delete().eq('id', id);
    toast.success('Smart link deleted');
    fetchLinks();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Smart Links</h1>
            <p className="text-sm text-muted-foreground mt-1">Create & share one link — fans choose their platform</p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Smart Link
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search smart links..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Music className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No smart links yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Create Smart Link" to get started.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => {
              const active = hasLinks(s);
              const url = getUrl(s);
              const linkCount = active ? Object.values(s.platform_links).filter(v => v?.trim()).length : 0;

              return (
                <GlassCard key={s.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {s.poster_url ? (
                      <img src={s.poster_url} alt={s.title} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.artist_name || 'Unknown Artist'}</p>
                      {active ? (
                        <Badge variant="default" className="mt-1 text-[10px]">{linkCount} platforms</Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1 text-[10px]">No links yet</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditLink(s)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSmartLink(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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

                  {!active && (
                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setEditLink(s)}>
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Add Platform Links
                    </Button>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={open => !open && setCreating(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Smart Link</DialogTitle>
          </DialogHeader>
          {user && (
            <SmartLinkEditor
              userId={user.id}
              onSaved={() => { setCreating(false); fetchLinks(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editLink} onOpenChange={open => !open && setEditLink(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Smart Link — {editLink?.title}</DialogTitle>
          </DialogHeader>
          {editLink && user && (
            <SmartLinkEditor
              smartLink={editLink}
              userId={user.id}
              onSaved={() => { setEditLink(null); fetchLinks(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
