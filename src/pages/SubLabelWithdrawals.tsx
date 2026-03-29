import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SubLabelWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  sub_label_name?: string;
}

export default function SubLabelWithdrawals() {
  const { user } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const effectiveUserId = isImpersonating && impersonatedUserId ? impersonatedUserId : user?.id;

  const [withdrawals, setWithdrawals] = useState<SubLabelWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (effectiveUserId) fetchData();
  }, [effectiveUserId]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: subs } = await supabase
        .from('sub_labels')
        .select('sub_user_id, sub_label_name')
        .eq('parent_user_id', effectiveUserId!)
        .eq('status', 'active');

      const subUserIds = (subs || []).map(s => s.sub_user_id).filter(Boolean) as string[];
      if (subUserIds.length === 0) { setWithdrawals([]); setLoading(false); return; }

      const nameMap = new Map<string, string>();
      (subs || []).forEach(s => { if (s.sub_user_id) nameMap.set(s.sub_user_id, s.sub_label_name); });

      const { data: wData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .in('user_id', subUserIds)
        .order('created_at', { ascending: false });

      const enriched: SubLabelWithdrawal[] = (wData || []).map((w: any) => ({
        ...w,
        sub_label_name: nameMap.get(w.user_id) || 'Unknown',
      }));
      setWithdrawals(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Status updated to ${newStatus}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  const filtered = useMemo(() => {
    let result = withdrawals;
    if (statusFilter !== 'all') result = result.filter(w => w.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(w => (w.sub_label_name || '').toLowerCase().includes(q));
    }
    return result;
  }, [withdrawals, statusFilter, search]);

  const paginated = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sub Label Withdraw Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage withdrawal requests from your sub-labels
          </p>
        </div>

        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Withdrawal Requests</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sub-label..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 w-[180px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="responsive-table-wrap">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>Sub Label</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No withdrawal requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="text-sm font-medium">{w.sub_label_name}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(w.amount))}</TableCell>
                      <TableCell>{format(new Date(w.created_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell><StatusBadge status={w.status} /></TableCell>
                      <TableCell>
                        {w.status === 'paid' ? (
                          <StatusBadge status="paid" />
                        ) : (
                          <Select
                            value={w.status}
                            onValueChange={(val) => updateStatus(w.id, val)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            totalItems={filtered.length}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="requests"
          />
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
