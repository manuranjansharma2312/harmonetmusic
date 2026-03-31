import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TransferHistory } from '@/components/TransferHistory';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Search, Loader2, Music, Video, Youtube, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface VideoTransfer {
  id: string;
  submission_id: string;
  submission_type: string;
  submission_name: string;
  from_user_id: string;
  to_user_id: string;
  transferred_by: string;
  transferred_at: string;
  linked_video_count: number;
  from_name?: string;
  from_display_id?: number;
  to_name?: string;
  to_display_id?: number;
}

interface CmsTransfer {
  id: string;
  cms_link_id: string;
  channel_name: string;
  from_user_id: string;
  to_user_id: string;
  transferred_by: string;
  transferred_at: string;
  from_name?: string;
  from_display_id?: number;
  to_name?: string;
  to_display_id?: number;
}

interface ProfileMap {
  [userId: string]: { legal_name: string; display_id: number };
}

const AdminTransferHistory = () => {
  const [tab, setTab] = useState('releases');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            All Transfers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track all ownership transfers across Releases, Videos/Vevo, and CMS Links.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 gap-1">
              <TabsTrigger value="releases" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Music className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">Release</span> Transfers</TabsTrigger>
              <TabsTrigger value="videos" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Video / Vevo</TabsTrigger>
              <TabsTrigger value="cms" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"><Youtube className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> CMS</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="releases" className="mt-4">
            <TransferHistory />
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            <VideoTransferSection />
          </TabsContent>

          <TabsContent value="cms" className="mt-4">
            <CmsTransferSection />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

function VideoTransferSection() {
  const [logs, setLogs] = useState<VideoTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await (supabase.from('video_transfers') as any)
      .select('*')
      .order('transferred_at', { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.flatMap((d: any) => [d.from_user_id, d.to_user_id]))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, legal_name, display_id')
        .in('user_id', userIds);
      const pMap: ProfileMap = {};
      (profiles || []).forEach((p: any) => { pMap[p.user_id] = p; });

      setLogs(data.map((d: any) => ({
        ...d,
        from_name: pMap[d.from_user_id]?.legal_name || '—',
        from_display_id: pMap[d.from_user_id]?.display_id,
        to_name: pMap[d.to_user_id]?.legal_name || '—',
        to_display_id: pMap[d.to_user_id]?.display_id,
      })));
    } else {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.submission_name.toLowerCase().includes(q) ||
      (l.from_name || '').toLowerCase().includes(q) ||
      (l.to_name || '').toLowerCase().includes(q) ||
      l.submission_type.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const paginated = paginateItems(filtered, page, pageSize);

  const exportCSV = () => {
    if (!filtered.length) { toast.error('No data to export'); return; }
    const headers = ['Type', 'Name', 'From User', 'From #ID', 'To User', 'To #ID', 'Linked Videos', 'Date'];
    const rows = [headers.join(',')];
    filtered.forEach(l => {
      rows.push([
        `"${l.submission_type === 'vevo_channel' ? 'Vevo Channel' : 'Video'}"`,
        `"${l.submission_name}"`,
        `"${l.from_name}"`, `"#${l.from_display_id || ''}"`,
        `"${l.to_name}"`, `"#${l.to_display_id || ''}"`,
        `"${l.linked_video_count}"`,
        `"${format(new Date(l.transferred_at), 'dd MMM yyyy, hh:mm a')}"`,
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `video-transfers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} records`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transfers..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <GlassCard className="p-0">
        <div className="responsive-table-wrap">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">From</TableHead>
                <TableHead className="whitespace-nowrap">To</TableHead>
                <TableHead className="whitespace-nowrap">Linked Videos</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No video/vevo transfers found</TableCell></TableRow>
              ) : paginated.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      l.submission_type === 'vevo_channel'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }`}>
                      {l.submission_type === 'vevo_channel' ? 'Vevo Channel' : 'Video'}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{l.submission_name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-foreground">{l.from_name}</span>
                    {l.from_display_id && <span className="text-primary font-mono ml-1 text-xs">#{l.from_display_id}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-foreground">{l.to_name}</span>
                    {l.to_display_id && <span className="text-primary font-mono ml-1 text-xs">#{l.to_display_id}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {l.linked_video_count > 0 ? `${l.linked_video_count} videos` : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {format(new Date(l.transferred_at), 'dd MMM yyyy, hh:mm a')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination totalItems={filtered.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="transfers" />
      </GlassCard>
    </div>
  );
}

function CmsTransferSection() {
  const [logs, setLogs] = useState<CmsTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await (supabase.from('cms_transfers') as any)
      .select('*')
      .order('transferred_at', { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.flatMap((d: any) => [d.from_user_id, d.to_user_id]))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, legal_name, display_id')
        .in('user_id', userIds);
      const pMap: ProfileMap = {};
      (profiles || []).forEach((p: any) => { pMap[p.user_id] = p; });

      setLogs(data.map((d: any) => ({
        ...d,
        from_name: pMap[d.from_user_id]?.legal_name || '—',
        from_display_id: pMap[d.from_user_id]?.display_id,
        to_name: pMap[d.to_user_id]?.legal_name || '—',
        to_display_id: pMap[d.to_user_id]?.display_id,
      })));
    } else {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.channel_name.toLowerCase().includes(q) ||
      (l.from_name || '').toLowerCase().includes(q) ||
      (l.to_name || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const paginated = paginateItems(filtered, page, pageSize);

  const exportCSV = () => {
    if (!filtered.length) { toast.error('No data to export'); return; }
    const headers = ['Channel Name', 'From User', 'From #ID', 'To User', 'To #ID', 'Date'];
    const rows = [headers.join(',')];
    filtered.forEach(l => {
      rows.push([
        `"${l.channel_name}"`,
        `"${l.from_name}"`, `"#${l.from_display_id || ''}"`,
        `"${l.to_name}"`, `"#${l.to_display_id || ''}"`,
        `"${format(new Date(l.transferred_at), 'dd MMM yyyy, hh:mm a')}"`,
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `cms-transfers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} records`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transfers..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <GlassCard className="p-0">
        <div className="responsive-table-wrap">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Channel Name</TableHead>
                <TableHead className="whitespace-nowrap">From</TableHead>
                <TableHead className="whitespace-nowrap">To</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No CMS transfers found</TableCell></TableRow>
              ) : paginated.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                      {l.channel_name}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-foreground">{l.from_name}</span>
                    {l.from_display_id && <span className="text-primary font-mono ml-1 text-xs">#{l.from_display_id}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-foreground">{l.to_name}</span>
                    {l.to_display_id && <span className="text-primary font-mono ml-1 text-xs">#{l.to_display_id}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {format(new Date(l.transferred_at), 'dd MMM yyyy, hh:mm a')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination totalItems={filtered.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="transfers" />
      </GlassCard>
    </div>
  );
}

export default AdminTransferHistory;
