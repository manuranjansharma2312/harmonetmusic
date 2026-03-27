import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/GlassCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';

interface TransferLog {
  id: string;
  release_id: string;
  release_name: string;
  from_user_id: string;
  to_user_id: string;
  transferred_at: string;
  isrcs: string[];
  from_name?: string;
  from_display_id?: number;
  to_name?: string;
  to_display_id?: number;
}

export function TransferHistory() {
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('release_transfers')
      .select('*')
      .order('transferred_at', { ascending: false });

    if (!data || data.length === 0) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data as any[]).flatMap((d: any) => [d.from_user_id, d.to_user_id]))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, legal_name, artist_name, record_label_name, display_id, user_type')
      .in('user_id', userIds);

    const nameMap: Record<string, string> = {};
    const displayIdMap: Record<string, number> = {};
    profiles?.forEach((p) => {
      nameMap[p.user_id] = p.user_type === 'label'
        ? (p.record_label_name || p.legal_name)
        : (p.artist_name || p.legal_name);
      displayIdMap[p.user_id] = p.display_id;
    });

    setLogs(
      (data as any[]).map((d: any) => ({
        ...d,
        from_name: nameMap[d.from_user_id] || 'Unknown',
        from_display_id: displayIdMap[d.from_user_id],
        to_name: nameMap[d.to_user_id] || 'Unknown',
        to_display_id: displayIdMap[d.to_user_id],
      }))
    );
    setLoading(false);
  };

  const paged = paginateItems(logs, page, pageSize);

  if (loading) return null;
  if (logs.length === 0) return null;

  return (
    <GlassCard className="p-0 overflow-hidden mt-6">
      <div className="p-4 border-b border-border/50">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Transfer History
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Log of all release ownership transfers</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Release</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>ISRCs</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.release_name}</TableCell>
                <TableCell>
                  <span>{log.from_name}</span>
                  {log.from_display_id && <span className="text-primary font-mono text-xs ml-1">#{log.from_display_id}</span>}
                </TableCell>
                <TableCell>
                  <span>{log.to_name}</span>
                  {log.to_display_id && <span className="text-primary font-mono text-xs ml-1">#{log.to_display_id}</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {(log.isrcs || []).join(', ') || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.transferred_at), 'dd MMM yyyy, hh:mm a')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        totalItems={logs.length}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="transfers"
      />
    </GlassCard>
  );
}
