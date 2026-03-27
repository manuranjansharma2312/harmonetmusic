import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/GlassCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRightLeft, Undo2, Loader2, Search, X, CalendarIcon } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

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

interface TransferHistoryProps {
  onReversed?: () => void;
}

export function TransferHistory({ onReversed }: TransferHistoryProps = {}) {
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [confirmLog, setConfirmLog] = useState<TransferLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = log.release_name.toLowerCase().includes(q)
          || (log.from_name || '').toLowerCase().includes(q)
          || (log.to_name || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (dateFrom || dateTo) {
        const d = new Date(log.transferred_at);
        if (dateFrom && d < startOfDay(dateFrom)) return false;
        if (dateTo && d > endOfDay(dateTo)) return false;
      }
      return true;
    });
  }, [logs, searchQuery, dateFrom, dateTo]);

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

  const handleReverse = async (log: TransferLog) => {
    setReversingId(log.id);
    try {
      const originalOwner = log.from_user_id;
      const currentOwner = log.to_user_id;

      // 1. Transfer release back
      const { error: relErr } = await supabase
        .from('releases')
        .update({ user_id: originalOwner })
        .eq('id', log.release_id);
      if (relErr) throw relErr;

      // 2. Transfer tracks back
      const { error: trkErr } = await supabase
        .from('tracks')
        .update({ user_id: originalOwner })
        .eq('release_id', log.release_id);
      if (trkErr) throw trkErr;

      // 3. Move report entries back & unfreeze
      if (log.isrcs.length > 0) {
        await supabase
          .from('report_entries')
          .update({ user_id: originalOwner, revenue_frozen: false } as any)
          .eq('user_id', currentOwner)
          .in('isrc', log.isrcs);

        await supabase
          .from('youtube_report_entries')
          .update({ user_id: originalOwner, revenue_frozen: false } as any)
          .eq('user_id', currentOwner)
          .in('isrc', log.isrcs);
      }

      // 4. Log the reverse as a new transfer
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id || originalOwner;
      await supabase.from('release_transfers').insert({
        release_id: log.release_id,
        from_user_id: currentOwner,
        to_user_id: originalOwner,
        transferred_by: adminId,
        release_name: `[Reversed] ${log.release_name}`,
        isrcs: log.isrcs,
      } as any);

      // 5. Delete original log entry
      await supabase.from('release_transfers').delete().eq('id', log.id);

      toast.success(`Transfer reversed — ${log.release_name} returned to ${log.from_name}`);
      fetchLogs();
      onReversed?.();
    } catch (err: any) {
      toast.error(err.message || 'Reverse failed');
    }
    setReversingId(null);
    setConfirmLog(null);
  };

  const paged = paginateItems(filteredLogs, page, pageSize);
  const hasFilters = searchQuery || dateFrom || dateTo;

  if (loading) return null;
  if (logs.length === 0) return null;

  return (
    <>
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border/50 space-y-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Transfer History
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Log of all release ownership transfers</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search release, user..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="pl-9 h-9"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", dateFrom && "text-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", dateTo && "text-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={() => { setSearchQuery(''); setDateFrom(undefined); setDateTo(undefined); setPage(0); }}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
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
                <TableHead className="w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((log) => {
                const isReversed = log.release_name.startsWith('[Reversed]');
                return (
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
                    <TableCell>
                      {!isReversed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={reversingId === log.id}
                          onClick={() => setConfirmLog(log)}
                          title="Reverse this transfer"
                        >
                          {reversingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          totalItems={filteredLogs.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="transfers"
        />
      </GlassCard>

      <AlertDialog open={!!confirmLog} onOpenChange={(v) => !v && setConfirmLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse Transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will return <strong>{confirmLog?.release_name}</strong> back to{' '}
              <strong>{confirmLog?.from_name} #{confirmLog?.from_display_id}</strong> and unfreeze all historical report entries. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmLog && handleReverse(confirmLog)}
            >
              Reverse Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
