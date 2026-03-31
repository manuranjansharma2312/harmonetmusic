import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';
import { Wallet, ArrowDownToLine, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  paid: 'approved',
  rejected: 'rejected',
};

export default function CmsBalance() {
  const { user } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const activeUserId = (isImpersonating && impersonatedUserId) ? impersonatedUserId : user?.id;

  const [loading, setLoading] = useState(true);
  const [totalNetPayable, setTotalNetPayable] = useState(0);
  const [threshold, setThreshold] = useState(1000);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);

      // Get user's linked channels with cut_percent
      const { data: links } = await supabase
        .from('youtube_cms_links' as any)
        .select('channel_name, cut_percent')
        .eq('user_id', activeUserId)
        .eq('status', 'linked');

      const cmsLinks = (links as any[]) || [];

      // Get all CMS report entries (RLS filters by channel), exclude frozen
      const { data: entries } = await supabase
        .from('cms_report_entries' as any)
        .select('channel_name, net_generated_revenue')
        .eq('revenue_frozen', false);

      let total = 0;
      ((entries as any[]) || []).forEach((e: any) => {
        const revenue = Number(e.net_generated_revenue) || 0;
        const link = cmsLinks.find((l: any) => l.channel_name === e.channel_name);
        const cut = Number(link?.cut_percent) || 0;
        total += revenue - (revenue * cut / 100);
      });

      // Get settings
      const { data: settings } = await supabase.from('cms_settings' as any).select('withdrawal_threshold').limit(1).maybeSingle();
      setThreshold(Number((settings as any)?.withdrawal_threshold) || 1000);

      // Get withdrawals
      const { data: wds } = await supabase
        .from('cms_withdrawal_requests' as any)
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      setWithdrawals((wds as any[]) || []);
      setTotalNetPayable(Number(total.toFixed(4)));
      setLoading(false);
    };
    fetchData();
  }, [user, activeUserId]);

  const paidTotal = useMemo(() => withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0), [withdrawals]);
  const pendingTotal = useMemo(() => withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0), [withdrawals]);
  const availableBalance = Math.max(0, totalNetPayable - paidTotal - pendingTotal);
  const progress = Math.min(100, (availableBalance / threshold) * 100);
  const canWithdraw = availableBalance >= threshold;
  const amountNeeded = Math.max(0, threshold - availableBalance);

  const handleWithdraw = async () => {
    if (!canWithdraw || !activeUserId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('cms_withdrawal_requests' as any).insert({
        user_id: activeUserId,
        amount: availableBalance,
        status: 'pending',
      } as any);
      if (error) throw error;
      toast.success('Withdrawal request submitted');
      // Refresh
      const { data: wds } = await supabase
        .from('cms_withdrawal_requests' as any)
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });
      setWithdrawals((wds as any[]) || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const pagedWithdrawals = paginateItems(withdrawals, page, pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">CMS Revenue</h1>
          <p className="text-muted-foreground text-sm">Your YouTube CMS revenue balance and withdrawal requests</p>
        </div>

        {loading ? (
          <GlassCard className="p-8 text-center text-muted-foreground">Loading balance...</GlassCard>
        ) : (
          <>
            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GlassCard className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Net Payable</span>
                </div>
                <p className="text-2xl font-bold">₹{totalNetPayable.toFixed(2)}</p>
              </GlassCard>
              <GlassCard className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Paid</span>
                </div>
                <p className="text-2xl font-bold">₹{paidTotal.toFixed(2)}</p>
              </GlassCard>
              <GlassCard className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Wallet className="h-5 w-5 text-accent-foreground" />
                  <span className="text-sm text-muted-foreground">Available Balance</span>
                </div>
                <p className="text-2xl font-bold">₹{availableBalance.toFixed(2)}</p>
              </GlassCard>
            </div>

            {/* Threshold Progress */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Withdrawal Threshold</p>
                  <p className="text-xs text-muted-foreground">
                    {canWithdraw
                      ? 'You can withdraw your CMS revenue'
                      : `₹${amountNeeded.toFixed(2)} more needed to reach ₹${threshold.toFixed(2)} threshold`}
                  </p>
                </div>
                <Button onClick={handleWithdraw} disabled={!canWithdraw || submitting}>
                  <Wallet className="h-4 w-4 mr-2" /> {submitting ? 'Submitting...' : 'Withdraw'}
                </Button>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>₹0</span>
                <span>₹{availableBalance.toFixed(2)} / ₹{threshold.toFixed(2)}</span>
              </div>
            </GlassCard>

            {/* Withdrawal History */}
            <GlassCard className="p-0 overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <h3 className="font-semibold">Withdrawal History</h3>
              </div>
              <div className="responsive-table-wrap">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedWithdrawals.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No withdrawal requests yet.</TableCell></TableRow>
                  ) : pagedWithdrawals.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell>{format(new Date(w.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium">₹{Number(w.amount).toFixed(2)}</TableCell>
                      <TableCell><StatusBadge status={STATUS_MAP[w.status] || w.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.rejection_reason || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
               </Table>
               </div>
              <TablePagination totalItems={withdrawals.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </GlassCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
