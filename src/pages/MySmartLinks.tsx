import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { CopyButton } from '@/components/CopyButton';
import { SmartLinkEditor } from '@/components/SmartLinkEditor';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Link2, ExternalLink, Search, Music, Plus, Edit, Share2, Clock, CheckCircle, XCircle, Eye, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SmartLinkItem {
  id: string;
  title: string;
  artist_name: string;
  poster_url: string | null;
  platform_links: Record<string, string>;
  slug: string | null;
  created_at: string;
  status: string;
  rejection_reason: string | null;
}

export default function MySmartLinks() {
  const { user } = useAuth();
  const [smartLinks, setSmartLinks] = useState<SmartLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editLink, setEditLink] = useState<SmartLinkItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const fetchSystemSetting = async () => {
    const { data } = await supabase.from('smart_link_settings').select('is_enabled').limit(1).single();
    setSystemEnabled(data ? (data as any).is_enabled : true);
  };

  const fetchLinks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('smart_links')
      .select('id, title, artist_name, poster_url, platform_links, slug, created_at, status, rejection_reason')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSmartLinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); fetchSystemSetting(); }, [user]);

  const filtered = smartLinks.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artist_name.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = paginateItems(filtered, currentPage, pageSize);

  const getUrl = (s: SmartLinkItem) => {
    const base = window.location.origin;
    return s.slug ? `${base}/r/${s.slug}` : `${base}/r/${s.id}`;
  };

  const hasLinks = (s: SmartLinkItem) => {
    return s.platform_links && Object.values(s.platform_links).some(v => v?.trim());
  };

  if (systemEnabled === false) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Smart Links</h1>
          <GlassCard className="py-12 text-center">
            <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground font-medium text-lg">Smart Links system is currently disabled</p>
            <p className="text-sm text-muted-foreground mt-2">Please check back later or contact your admin.</p>
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <LinkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              My Smart Links
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Create & share one link — fans choose their platform</p>
          </div>
          <Button onClick={() => setCreating(true)} className="w-fit gap-1.5">
            <Plus className="h-4 w-4" /> Create Smart Link
          </Button>
        </div>

        {/* Search + Stats bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by title or artist..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {!loading && smartLinks.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{smartLinks.length} total</span>
              <span className="text-border">•</span>
              <span>{smartLinks.filter(s => s.status === 'approved').length} approved</span>
              <span className="text-border">•</span>
              <span>{smartLinks.filter(s => s.status === 'pending').length} pending</span>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your smart links...</p>
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="py-14 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Music className="h-8 w-8 text-primary" />
            </div>
            <p className="text-foreground font-semibold text-lg">No smart links yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Click the button below to create your first smart link.</p>
            <Button onClick={() => setCreating(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Smart Link
            </Button>
          </GlassCard>
        ) : (
          <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map(s => {
              const active = hasLinks(s);
              const url = getUrl(s);
              const linkCount = active ? Object.values(s.platform_links).filter(v => v?.trim()).length : 0;
              const isApproved = s.status === 'approved';
              const isPending = s.status === 'pending';
              const isRejected = s.status === 'rejected';

              return (
                <GlassCard key={s.id} className="p-0 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-primary/5">
                  {/* Card Header with cover art */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start gap-3">
                      {s.poster_url ? (
                        <img src={s.poster_url} alt={s.title} className="h-16 w-16 rounded-xl object-cover flex-shrink-0 ring-1 ring-border" />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-muted/80 flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                          <Music className="h-7 w-7 text-muted-foreground/60" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate leading-tight">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.artist_name || 'Unknown Artist'}</p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {isPending && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5"><Clock className="h-2.5 w-2.5" /> Pending</Badge>
                          )}
                          {isApproved && (
                            <Badge variant="default" className="text-[10px] gap-0.5 px-1.5 bg-green-600"><CheckCircle className="h-2.5 w-2.5" /> Approved</Badge>
                          )}
                          {isRejected && (
                            <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>
                          )}
                          {active && (
                            <Badge variant="outline" className="text-[10px] px-1.5">{linkCount} platform{linkCount !== 1 ? 's' : ''}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rejection notice */}
                  {isRejected && (
                    <div className="mx-4 mb-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-[11px] text-destructive font-medium">Rejected — will be removed automatically</p>
                      {s.rejection_reason && (
                        <p className="text-[10px] text-destructive/80 mt-0.5 line-clamp-2">Reason: {s.rejection_reason}</p>
                      )}
                    </div>
                  )}

                  {/* Pending notice */}
                  {isPending && (
                    <div className="mx-4 mb-3 p-2.5 rounded-lg bg-muted/50 border border-border">
                      <p className="text-[11px] text-muted-foreground text-center">Waiting for admin approval before sharing.</p>
                    </div>
                  )}

                  {/* Smart Link URL */}
                  {isApproved && active && (
                    <div className="mx-4 mb-3 flex items-center gap-1.5 p-2 rounded-lg bg-primary/5 border border-primary/15">
                      <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate font-mono">{url}</span>
                      <CopyButton value={url} />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center border-t border-border/50 bg-muted/20">
                    <span className="text-[10px] text-muted-foreground/60 px-4 flex-1">
                      {format(new Date(s.created_at), 'dd MMM yyyy')}
                    </span>
                    <div className="flex items-center divide-x divide-border/50">
                      {isApproved && active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-none h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: s.title, url });
                            } else {
                              navigator.clipboard.writeText(url);
                              toast.success('Link copied!');
                            }
                          }}
                        >
                          <Share2 className="h-3.5 w-3.5" /> Share
                        </Button>
                      )}
                      {active && s.slug && (
                        <a href={`/r/${s.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="rounded-none h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-primary">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-none h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                        onClick={() => setEditLink(s)}
                      >
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
          <TablePagination
            totalItems={filtered.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(0); }}
            itemLabel="smart links"
          />
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={open => !open && setCreating(false)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create Smart Link
            </DialogTitle>
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Smart Link
            </DialogTitle>
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
