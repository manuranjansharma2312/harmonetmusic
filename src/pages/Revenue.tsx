import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Wallet, IndianRupee, ArrowDownToLine, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function Revenue() {
  const { user, role } = useAuth();
  const { effectiveUserId } = useImpersonate();
  const activeUserId = effectiveUserId || user?.id;

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [paidWithdrawals, setPaidWithdrawals] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [threshold, setThreshold] = useState(1000);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const availableBalance = totalRevenue - paidWithdrawals - pendingWithdrawals;
  const progressPercent = threshold > 0 ? Math.min((availableBalance / threshold) * 100, 100) : 0;
  const canWithdraw = availableBalance >= threshold;

  useEffect(() => {
    if (!activeUserId) return;
    fetchData();
  }, [activeUserId]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch total revenue from OTT reports
      const { data: ottData } = await supabase
        .from('report_entries')
        .select('net_generated_revenue');

      const ottTotal = (ottData || []).reduce((sum, r) => sum + (Number(r.net_generated_revenue) || 0), 0);

      // Fetch total revenue from YouTube reports
      const { data: ytData } = await supabase
        .from('youtube_report_entries')
        .select('net_generated_revenue');

      const ytTotal = (ytData || []).reduce((sum, r) => sum + (Number(r.net_generated_revenue) || 0), 0);

      setTotalRevenue(ottTotal + ytTotal);

      // Fetch threshold
      const { data: settings } = await supabase
        .from('revenue_settings')
        .select('withdrawal_threshold')
        .limit(1)
        .single();

      if (settings) setThreshold(Number(settings.withdrawal_threshold));

      // Fetch withdrawals
      const { data: wData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      const allWithdrawals = (wData || []) as WithdrawalRequest[];
      setWithdrawals(allWithdrawals);

      const paid = allWithdrawals
        .filter(w => w.status === 'paid')
        .reduce((sum, w) => sum + Number(w.amount), 0);
      setPaidWithdrawals(paid);

      const pending = allWithdrawals
        .filter(w => w.status === 'pending')
        .reduce((sum, w) => sum + Number(w.amount), 0);
      setPendingWithdrawals(pending);
    } catch (err) {
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!activeUserId || !canWithdraw) return;
    setWithdrawing(true);
    try {
      const { error } = await supabase.from('withdrawal_requests').insert({
        user_id: activeUserId,
        amount: availableBalance,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Withdrawal request submitted successfully!');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit withdrawal request');
    } finally {
      setWithdrawing(false);
    }
  }

  const paginatedWithdrawals = useMemo(
    () => paginateItems(withdrawals, page, pageSize),
    [withdrawals, page, pageSize]
  );

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Revenue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your earnings and request withdrawals
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Available Balance</span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">
              {loading ? '...' : formatCurrency(Math.max(availableBalance, 0))}
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <IndianRupee className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Total Earned</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">
              {loading ? '...' : formatCurrency(totalRevenue)}
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Pending Withdrawals</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">
              {loading ? '...' : formatCurrency(pendingWithdrawals)}
            </p>
          </GlassCard>
        </div>

        {/* Threshold & Withdraw */}
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Withdrawal Threshold</h2>
              <p className="text-sm text-muted-foreground">
                You need at least {formatCurrency(threshold)} to withdraw
              </p>
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={!canWithdraw || withdrawing || loading}
              className="gap-2"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {withdrawing ? 'Submitting...' : 'Withdraw Now'}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(Math.max(availableBalance, 0))} / {formatCurrency(threshold)}
              </span>
              <span className={canWithdraw ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}>
                {canWithdraw ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Threshold reached
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {formatCurrency(Math.max(threshold - availableBalance, 0))} more needed
                  </span>
                )}
              </span>
            </div>
            <Progress
              value={progressPercent}
              className="h-3"
            />
          </div>
        </GlassCard>

        {/* Withdrawal History */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-semibold">Withdrawal History</h2>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : paginatedWithdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No withdrawal requests yet
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWithdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{formatCurrency(Number(w.amount))}</TableCell>
                      <TableCell>{format(new Date(w.created_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell>
                        <StatusBadge status={w.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            totalItems={withdrawals.length}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="withdrawals"
          />
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
