import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Search, Music, Video, Youtube } from 'lucide-react';
import { format } from 'date-fns';

interface ReleaseTransfer {
  id: string;
  release_id: string;
  release_name: string;
  from_user_id: string;
  to_user_id: string;
  transferred_at: string;
  isrcs: string[];
}

interface VideoTransfer {
  id: string;
  submission_id: string;
  submission_type: string;
  submission_name: string;
  from_user_id: string;
  to_user_id: string;
  transferred_at: string;
  linked_video_count: number;
}

interface CmsTransfer {
  id: string;
  cms_link_id: string;
  channel_name: string;
  from_user_id: string;
  to_user_id: string;
  transferred_at: string;
}

export default function MyTransfers() {
  const { user } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const activeUserId = (isImpersonating && impersonatedUserId) ? impersonatedUserId : user?.id;

  const [tab, setTab] = useState('releases');
  const [releaseTransfers, setReleaseTransfers] = useState<ReleaseTransfer[]>([]);
  const [videoTransfers, setVideoTransfers] = useState<VideoTransfer[]>([]);
  const [cmsTransfers, setCmsTransfers] = useState<CmsTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  useEffect(() => {
    if (!activeUserId) return;
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: rt }, { data: vt }, { data: ct }] = await Promise.all([
        supabase.from('release_transfers' as any).select('*')
          .or(`from_user_id.eq.${activeUserId},to_user_id.eq.${activeUserId}`)
          .order('transferred_at', { ascending: false }),
        supabase.from('video_transfers' as any).select('*')
          .or(`from_user_id.eq.${activeUserId},to_user_id.eq.${activeUserId}`)
          .order('transferred_at', { ascending: false }),
        supabase.from('cms_transfers' as any).select('*')
          .or(`from_user_id.eq.${activeUserId},to_user_id.eq.${activeUserId}`)
          .order('transferred_at', { ascending: false }),
      ]);
      setReleaseTransfers((rt as any[]) || []);
      setVideoTransfers((vt as any[]) || []);
      setCmsTransfers((ct as any[]) || []);
      setLoading(false);
    };
    fetchAll();
  }, [activeUserId]);

  const getDirection = (fromId: string) => {
    if (fromId === activeUserId) return 'outgoing';
    return 'incoming';
  };

  const DirectionBadge = ({ fromId }: { fromId: string }) => {
    const dir = getDirection(fromId);
    return (
      <Badge variant={dir === 'incoming' ? 'default' : 'secondary'} className="text-xs">
        {dir === 'incoming' ? 'Received' : 'Transferred'}
      </Badge>
    );
  };

  // Reset page on tab or search change
  useEffect(() => { setPage(0); }, [tab, search]);

  // Release transfers
  const filteredReleases = useMemo(() => {
    if (!search.trim()) return releaseTransfers;
    const q = search.toLowerCase();
    return releaseTransfers.filter(t =>
      t.release_name.toLowerCase().includes(q) || t.isrcs.some(i => i.toLowerCase().includes(q))
    );
  }, [releaseTransfers, search]);

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return videoTransfers;
    const q = search.toLowerCase();
    return videoTransfers.filter(t => t.submission_name.toLowerCase().includes(q));
  }, [videoTransfers, search]);

  const filteredCms = useMemo(() => {
    if (!search.trim()) return cmsTransfers;
    const q = search.toLowerCase();
    return cmsTransfers.filter(t => t.channel_name.toLowerCase().includes(q));
  }, [cmsTransfers, search]);

  const currentItems = tab === 'releases' ? filteredReleases : tab === 'videos' ? filteredVideos : filteredCms;
  const paged = paginateItems(currentItems as any[], page, pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            My Transfers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View ownership transfers involving your account.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 gap-1">
              <TabsTrigger value="releases" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Music className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Releases
                {releaseTransfers.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">{releaseTransfers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Videos
                {videoTransfers.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">{videoTransfers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="cms" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                <Youtube className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> CMS
                {cmsTransfers.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">{cmsTransfers.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-4">
            <div className="relative max-w-xs mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transfers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>

            {loading ? (
              <GlassCard className="p-8 text-center text-muted-foreground">Loading transfers...</GlassCard>
            ) : currentItems.length === 0 ? (
              <GlassCard className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                <ArrowRightLeft className="h-10 w-10 opacity-40" />
                <p>No {tab === 'releases' ? 'release' : tab === 'videos' ? 'video/vevo' : 'CMS'} transfers found.</p>
              </GlassCard>
            ) : (
              <GlassCard className="p-0 overflow-hidden">
                <div className="responsive-table-wrap">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>{tab === 'releases' ? 'Release' : tab === 'videos' ? 'Submission' : 'Channel'}</TableHead>
                        {tab === 'releases' && <TableHead>ISRCs</TableHead>}
                        {tab === 'videos' && <TableHead>Type</TableHead>}
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tab === 'releases' && (paged as unknown as ReleaseTransfer[]).map(t => (
                        <TableRow key={t.id}>
                          <TableCell><DirectionBadge fromId={t.from_user_id} /></TableCell>
                          <TableCell className="font-medium">{t.release_name || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{t.isrcs?.join(', ') || '-'}</TableCell>
                          <TableCell>{format(new Date(t.transferred_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        </TableRow>
                      ))}
                      {tab === 'videos' && (paged as unknown as VideoTransfer[]).map(t => (
                        <TableRow key={t.id}>
                          <TableCell><DirectionBadge fromId={t.from_user_id} /></TableCell>
                          <TableCell className="font-medium">{t.submission_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {t.submission_type === 'vevo_channel' ? 'Vevo Channel' : 'Video'}
                            </Badge>
                            {t.linked_video_count > 0 && (
                              <span className="text-xs text-muted-foreground ml-2">+{t.linked_video_count} linked</span>
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(t.transferred_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        </TableRow>
                      ))}
                      {tab === 'cms' && (paged as CmsTransfer[]).map(t => (
                        <TableRow key={t.id}>
                          <TableCell><DirectionBadge fromId={t.from_user_id} /></TableCell>
                          <TableCell className="font-medium">{t.channel_name || '-'}</TableCell>
                          <TableCell>{format(new Date(t.transferred_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination totalItems={currentItems.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
              </GlassCard>
            )}
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
