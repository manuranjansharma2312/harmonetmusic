import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, CheckCircle2, IndianRupee, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  email?: string;
}

export default function AdminRevenue() {
  const [threshold, setThreshold] = useState('');
  const [savedThreshold, setSavedThreshold] = useState(0);
  const [saving, setSaving] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Get threshold
      const { data: settings } = await supabase
        .from('revenue_settings')
        .select('*')
        .limit(1)
        .single();

      if (settings) {
        const t = Number(settings.withdrawal_threshold);
        setSavedThreshold(t);
        setThreshold(String(t));
      }

      // Get all withdrawal requests
      const { data: wData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      const allW = (wData || []) as WithdrawalRow[];

      // Fetch user emails
      const userIds = [...new Set(allW.map(w => w.user_id))];
      if (userIds.length > 0) {
        const { data: emails } = await supabase.rpc('get_auth_emails', { _user_ids: userIds });
        const emailMap = new Map((emails || []).map((e: any) => [e.user_id, e.email]));
        allW.forEach(w => { w.email = emailMap.get(w.user_id) || 'Unknown'; });
      }

      setWithdrawals(allW);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveThreshold() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('revenue_settings')
        .update({ withdrawal_threshold: Number(threshold) })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

      if (error) throw error;
      setSavedThreshold(Number(threshold));
      toast.success('Threshold updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update threshold');
    } finally {
      setSaving(false);
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
    if (statusFilter !== 'all') {
      result = result.filter(w => w.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(w => w.email?.toLowerCase().includes(q));
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
          <h1 className="text-2xl font-bold">Revenue Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage withdrawal threshold and process withdrawal requests
          </p>
        </div>

        {/* Threshold Settings */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Withdrawal Threshold</h2>
              <p className="text-sm text-muted-foreground">
                Current: {formatCurrency(savedThreshold)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="pl-9"
                placeholder="Enter threshold amount"
              />
            </div>
            <Button onClick={saveThreshold} disabled={saving}>
              {saving ? 'Saving...' : 'Update Threshold'}
            </Button>
          </div>
        </GlassCard>

        {/* Withdrawal Requests */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold">All Withdrawal Requests</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[130px]">
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
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
                      <TableCell className="text-sm">{w.email || 'Unknown'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(w.amount))}</TableCell>
                      <TableCell>{format(new Date(w.created_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell>
                        <StatusBadge status={w.status} />
                      </TableCell>
                      <TableCell>
                        {w.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(w.id, 'paid')}
                            className="gap-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark Paid
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Completed</span>
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
