import { useState, useEffect } from 'react';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';
import { Wallet, Search } from 'lucide-react';
import { format } from 'date-fns';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  legal_name: string;
  email: string;
  display_id: number;
}

const STATUS_MAP: Record<string, string> = { pending: 'pending', paid: 'approved', rejected: 'rejected' };
const STATUSES = ['pending', 'paid', 'rejected'];

export default function AdminCmsWithdrawals() {
  const { canChangeSettings } = useTeamPermissions();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [rejectItem, setRejectItem] = useState<WithdrawalRequest | null>(null);
  const [threshold, setThreshold] = useState(1000);
  const [editThreshold, setEditThreshold] = useState('1000');

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: settings }] = await Promise.all([
      supabase.from('cms_withdrawal_requests' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('cms_settings' as any).select('withdrawal_threshold').limit(1).maybeSingle(),
    ]);
    const items = (reqs as any[]) || [];
    setRequests(items);
    setThreshold(Number((settings as any)?.withdrawal_threshold) || 1000);
    setEditThreshold(String(Number((settings as any)?.withdrawal_threshold) || 1000));

    const userIds = [...new Set(items.map(i => i.user_id))];
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, legal_name, email, display_id').in('user_id', userIds);
      if (profs) {
        const map: Record<string, Profile> = {};
        profs.forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search) {
      const prof = profiles[r.user_id];
      const searchLower = search.toLowerCase();
      if (
        !prof?.legal_name?.toLowerCase().includes(searchLower) &&
        !prof?.email?.toLowerCase().includes(searchLower) &&
        !`#${prof?.display_id}`.includes(search)
      ) return false;
    }
    return true;
  });

  const pagedItems = paginateItems(filtered, page, pageSize);

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (newStatus === 'rejected') {
      setRejectItem(requests.find(r => r.id === id) || null);
      return;
    }
    const { error } = await supabase.from('cms_withdrawal_requests' as any)
      .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Status updated'); fetchAll(); }
  };

  const handleReject = async (reason: string) => {
    if (!rejectItem) return;
    const { error } = await supabase.from('cms_withdrawal_requests' as any)
      .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() } as any)
      .eq('id', rejectItem.id);
    if (error) toast.error(error.message);
    else { toast.success('Request rejected'); setRejectItem(null); fetchAll(); }
  };

  const saveThreshold = async () => {
    const val = parseFloat(editThreshold);
    if (isNaN(val) || val < 0) { toast.error('Invalid threshold'); return; }
    const { data: row } = await supabase.from('cms_settings' as any).select('id').limit(1).single();
    const settingsId = (row as any)?.id;
    if (!settingsId) { toast.error('Settings not found'); return; }
    const { error } = await supabase.from('cms_settings' as any)
      .update({ withdrawal_threshold: val, updated_at: new Date().toISOString() } as any)
      .eq('id', settingsId);
    if (error) toast.error(error.message);
    else { toast.success('Threshold updated'); setThreshold(val); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> CMS Withdrawal Requests</h1>
          <p className="text-muted-foreground text-sm">Manage YouTube CMS withdrawal requests</p>
        </div>

        {canChangeSettings && (
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-3">CMS Withdrawal Threshold</h3>
          <div className="flex gap-3 items-center">
            <span className="text-sm text-muted-foreground">Minimum balance for withdrawal:</span>
            <Input type="number" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} className="w-32" />
            <Button size="sm" onClick={saveThreshold}>Save</Button>
          </div>
        </GlassCard>
        )}

        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex gap-3 flex-wrap">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="responsive-table-wrap">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No withdrawal requests.</TableCell></TableRow>
                  ) : pagedItems.map((r: any) => {
                    const prof = profiles[r.user_id];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div>{prof?.legal_name || '—'} <span className="text-xs text-muted-foreground">#{prof?.display_id}</span></div>
                          <div className="text-xs text-muted-foreground">{prof?.email}</div>
                        </TableCell>
                        <TableCell className="font-medium">₹{Number(r.amount).toFixed(2)}</TableCell>
                        <TableCell>{format(new Date(r.created_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell><StatusBadge status={STATUS_MAP[r.status] || r.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.rejection_reason || '—'}</TableCell>
                        <TableCell>
                          <Select value={r.status} onValueChange={v => handleStatusChange(r.id, v)}>
                            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination totalItems={filtered.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </>
          )}
        </GlassCard>
      </div>

      <RejectReasonModal open={!!rejectItem} title="Reject CMS Withdrawal" onConfirm={handleReject} onCancel={() => setRejectItem(null)} />
    </DashboardLayout>
  );
}
