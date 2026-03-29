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
import { Wallet, IndianRupee, ArrowDownToLine, Clock, CheckCircle2, AlertCircle, Landmark, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { applySnapshotCut, calculateAvailableBalance, getEffectiveRevenueCutPercent, shouldApplyRevenueCut, summarizeWithdrawals } from '@/lib/revenueCalculations';

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function Revenue() {
  const { user, role } = useAuth();
  const { impersonatedUserId } = useImpersonate();
  const activeUserId = impersonatedUserId || user?.id;
  const navigate = useNavigate();

  const [hasBankDetails, setHasBankDetails] = useState<boolean | null>(null);
  const [parentBankMissing, setParentBankMissing] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [paidWithdrawals, setPaidWithdrawals] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [threshold, setThreshold] = useState(1000);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [hiddenCut, setHiddenCut] = useState(0);
  const [subLabelCut, setSubLabelCut] = useState(0);
  const [isSubLabelUser, setIsSubLabelUser] = useState(false);

  const effectiveCut = getEffectiveRevenueCutPercent({ hiddenCut, subLabelCut, isSubLabel: isSubLabelUser });
  const applyCut = shouldApplyRevenueCut({ role, currentUserId: user?.id, activeUserId });
  const netRevenue = totalRevenue; // totalRevenue is now already net (computed per-row with snapshots)
  const availableBalance = calculateAvailableBalance(netRevenue, paidWithdrawals, pendingWithdrawals);
  const progressPercent = threshold > 0 ? Math.min((Math.max(availableBalance, 0) / threshold) * 100, 100) : 0;
  const canWithdraw = availableBalance >= threshold;

  useEffect(() => {
    if (!activeUserId) return;
    fetchData();

    // Realtime subscriptions for revenue & withdrawal changes
    const channel = supabase
      .channel('revenue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_entries' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_report_entries' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vevo_report_entries' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeUserId]);

  async function fetchData() {
    setLoading(true);
    try {
      // Check bank details first (skip for sub-labels)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('hidden_cut_percent, user_type')
        .eq('user_id', activeUserId!)
        .maybeSingle();
      
      const isSubLabel = profileData?.user_type === 'sub_label';
      setIsSubLabelUser(isSubLabel);
      if (isSubLabel) {
        // Sub-labels don't need their own bank details, but check if parent has them
        const { data: subLabelInfo } = await supabase
          .from('sub_labels')
          .select('parent_user_id')
          .eq('sub_user_id', activeUserId!)
          .maybeSingle();
        
        if (subLabelInfo?.parent_user_id) {
          const { data: parentBank } = await supabase
            .from('bank_details')
            .select('id')
            .eq('user_id', subLabelInfo.parent_user_id)
            .maybeSingle();
          setParentBankMissing(!parentBank);
        }
        setHasBankDetails(true); // Don't gate sub-labels, but show warning
      } else {
        const { data: bankData } = await supabase
          .from('bank_details')
          .select('id')
          .eq('user_id', activeUserId!)
          .maybeSingle();
        setHasBankDetails(!!bankData);
      }

      // Check if sub-label and get parent's cut
      const { data: subLabelData } = await supabase
        .from('sub_labels')
        .select('percentage_cut, withdrawal_threshold, parent_user_id')
        .eq('sub_user_id', activeUserId!)
        .maybeSingle();

      let localHiddenCut = Number(profileData?.hidden_cut_percent || 0);

      if (subLabelData) {
        setSubLabelCut(Number(subLabelData.percentage_cut) || 0);
        if (isSubLabel) {
          setThreshold(Number(subLabelData.withdrawal_threshold) || 1000);
        }
        // For sub-labels, fetch PARENT's hidden cut for stacked calculation
        if (isSubLabel && subLabelData.parent_user_id) {
          const { data: parentProfile } = await supabase
            .from('profiles')
            .select('hidden_cut_percent')
            .eq('user_id', subLabelData.parent_user_id)
            .maybeSingle();
          localHiddenCut = Number(parentProfile?.hidden_cut_percent) || 0;
          setHiddenCut(localHiddenCut);
        } else {
          setHiddenCut(localHiddenCut);
        }
      } else {
        setSubLabelCut(0);
        setHiddenCut(localHiddenCut);
      }

      // Compute cut locally to avoid stale closure values
      const localSubLabelCut = Number(subLabelData?.percentage_cut || 0);
      const localIsSubLabel = isSubLabel;
      const localEffectiveCut = getEffectiveRevenueCutPercent({ hiddenCut: localHiddenCut, subLabelCut: localSubLabelCut, isSubLabel: localIsSubLabel });
      const localApplyCut = shouldApplyRevenueCut({ role, currentUserId: user?.id, activeUserId });

      // When admin impersonates, we need to filter by user's ISRCs
      // because admin RLS sees all entries
      let ottTotal = 0;
      let ytTotal = 0;

      if (role === 'admin' && impersonatedUserId && impersonatedUserId !== user?.id) {
        // Get sub-label user IDs for this parent user
        const { data: subLabels } = await supabase
          .from('sub_labels')
          .select('sub_user_id')
          .eq('parent_user_id', activeUserId!)
          .eq('status', 'active');

        const subUserIds = (subLabels || [])
          .map(sl => sl.sub_user_id)
          .filter(Boolean) as string[];

        const allUserIds = [activeUserId!, ...subUserIds];

        const [{ data: trackRows }, { data: songRows }] = await Promise.all([
          supabase.from('tracks').select('isrc').in('user_id', allUserIds),
          supabase.from('songs').select('isrc').in('user_id', allUserIds),
        ]);

        const ownedIsrcs = [...new Set(
          [...(trackRows ?? []), ...(songRows ?? [])]
            .map(r => (r.isrc || '').trim().toUpperCase())
            .filter(Boolean)
        )];

        if (ownedIsrcs.length > 0) {
          const [{ data: ottData }, { data: ytData }, { data: vevoData }] = await Promise.all([
            supabase.from('report_entries').select('net_generated_revenue, cut_percent_snapshot').in('isrc', ownedIsrcs).eq('revenue_frozen', false),
            supabase.from('youtube_report_entries').select('net_generated_revenue, cut_percent_snapshot').in('isrc', ownedIsrcs).eq('revenue_frozen', false),
            supabase.from('vevo_report_entries').select('net_generated_revenue, cut_percent_snapshot').in('isrc', ownedIsrcs).eq('revenue_frozen', false),
          ]);
          ottTotal = (ottData || []).reduce((sum, r: any) => sum + applySnapshotCut(Number(r.net_generated_revenue) || 0, r.cut_percent_snapshot, localEffectiveCut, localApplyCut), 0);
          ytTotal = (ytData || []).reduce((sum, r: any) => sum + applySnapshotCut(Number(r.net_generated_revenue) || 0, r.cut_percent_snapshot, localEffectiveCut, localApplyCut), 0);
          const vevoTotal = (vevoData || []).reduce((sum, r: any) => sum + applySnapshotCut(Number(r.net_generated_revenue) || 0, r.cut_percent_snapshot, localEffectiveCut, localApplyCut), 0);
          ottTotal += vevoTotal;
        }
      } else {
        // Regular user or admin not impersonating - rely on RLS
        const [{ data: ottData }, { data: ytData }, { data: vevoData }] = await Promise.all([
          supabase.from('report_entries').select('net_generated_revenue, cut_percent_snapshot').eq('revenue_frozen', false),
          supabase.from('youtube_report_entries').select('net_generated_revenue, cut_percent_snapshot').eq('revenue_frozen', false),
          supabase.from('vevo_report_entries').select('net_generated_revenue, cut_percent_snapshot').eq('revenue_frozen', false),
        ]);
        ottTotal = (ottData || []).reduce((sum, r: any) => sum + applySnapshotCut(Number(r.net_generated_revenue) || 0, r.cut_percent_snapshot, localEffectiveCut, localApplyCut), 0);
        ytTotal = (ytData || []).reduce((sum, r: any) => sum + applySnapshotCut(Number(r.net_generated_revenue) || 0, r.cut_percent_snapshot, localEffectiveCut, localApplyCut), 0);
        const vevoTotal = (vevoData || []).reduce((sum, r: any) => sum + applySnapshotCut(Number(r.net_generated_revenue) || 0, r.cut_percent_snapshot, localEffectiveCut, localApplyCut), 0);
        ottTotal += vevoTotal;
      }

      setTotalRevenue(ottTotal + ytTotal);

      // Fetch threshold (skip for sub-labels, they use parent-defined threshold)
      if (!isSubLabel) {
        const { data: settings } = await supabase
          .from('revenue_settings')
          .select('withdrawal_threshold')
          .limit(1)
          .single();

        if (settings) setThreshold(Number(settings.withdrawal_threshold));
      }

      // Fetch withdrawals
      const { data: wData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      const allWithdrawals = (wData || []) as WithdrawalRequest[];
      setWithdrawals(allWithdrawals);

      const { paid, pending } = summarizeWithdrawals(allWithdrawals);
      setPaidWithdrawals(paid);
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
        amount: Math.max(availableBalance, 0),
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Clock className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const showBankDetailsNotice = hasBankDetails === false && (role !== 'admin' || (role === 'admin' && impersonatedUserId && impersonatedUserId !== user?.id));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Revenue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your earnings and request withdrawals
          </p>
        </div>

        {showBankDetailsNotice && (
          <GlassCard className="p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Landmark className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Bank Details Required</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You need to add your bank details before you can request withdrawals. Please add them to proceed.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/bank-details')}
                className="gap-1.5 shrink-0"
              >
                <Landmark className="h-3.5 w-3.5" /> Add Bank Details
              </Button>
            </div>
          </GlassCard>
        )}

        {parentBankMissing && (
          <GlassCard className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Main Label Bank Details Missing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your main label hasn't added bank details yet. Withdrawals won't be processed until they do. Please contact your main label admin.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Available Balance</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
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
              {loading ? '...' : formatCurrency(netRevenue)}
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
              {isSubLabelUser && (
                <p className="text-xs text-primary mt-1">
                  Your withdrawal limit is set by your Main Record Label.
                </p>
              )}
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={!canWithdraw || withdrawing || loading || showBankDetailsNotice}
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
            {isSubLabelUser && (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Your withdrawals are entirely managed by your Main Record Label.
                </p>
                <p className="text-xs text-muted-foreground">
                  Harmonet Music is not responsible for your withdraw delay problem. Because Harmonet Music pay to the Main Record Label after requesting within 7-10 working days.
                </p>
              </div>
            )}
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
